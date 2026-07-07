import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, domains, inboundEmails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { dnsRecordsForDomain } from "@/lib/dkim";
import { publicUrl } from "@/lib/tracking";
import { deleteDomainAction, verifyDomainAction } from "@/app/actions";
import {
  Card,
  PageHeader,
  StatusPill,
  btnDanger,
  btnPrimary,
  fmtDate,
} from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { LiveVerify } from "@/components/domains/live-verify";
import { VerifyMx } from "@/components/domains/verify-mx";
import { InboundPoll } from "@/components/domains/inbound-poll";

export const dynamic = "force-dynamic";

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { id } = await params;
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.teamId, team.id)));
  if (!domain) notFound();

  const records = dnsRecordsForDomain(
    domain.name,
    domain.dkimSelector,
    domain.dkimPublicKey,
  );

  const base = publicUrl();
  const mxHost = base ? new URL(base).hostname : "your-server-hostname";
  const sesEndpoint = base ? `${base}/api/inbound/ses` : null;

  const [lastInbound] = await db
    .select()
    .from(inboundEmails)
    .where(eq(inboundEmails.domainId, domain.id))
    .orderBy(desc(inboundEmails.createdAt))
    .limit(1);

  const fullyVerified =
    domain.status === "verified" && domain.dkimVerified && domain.spfVerified;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/domains"
        className="mb-4 inline-block text-sm text-fg-muted hover:text-fg"
      >
        ← Domains
      </Link>
      <PageHeader title={domain.name}>
        <StatusPill status={domain.status} />
      </PageHeader>

      <p className="mb-2 text-sm text-fg-muted">
        Publish these DNS records, then hit verify. Last check:{" "}
        <span className="font-mono text-xs tabular-nums">
          {fmtDate(domain.lastCheckedAt)}
        </span>
      </p>

      {domain.status === "pending" && (
        <div className="mb-6">
          <LiveVerify domainId={domain.id} />
        </div>
      )}

      <div className="mb-6 space-y-4">
        {records.map((r) => {
          const verified =
            r.purpose === "dkim" ? domain.dkimVerified : domain.spfVerified;
          return (
            <Card
              key={r.name}
              className={`p-4 ${verified ? "border-lime/50 bg-lime/5" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-fg-faint">
                  {r.purpose} · {r.type}
                </span>
                <StatusPill status={verified ? "verified" : "pending"} />
              </div>
              <div className="mb-1 flex items-center gap-2">
                <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  Host
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                  {r.name}
                </code>
                <CopyButton value={r.name} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  Value
                </span>
                <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1.5 font-mono text-xs text-fg-muted">
                  {r.value}
                </code>
                <CopyButton value={r.value} />
              </div>
              <p className="mt-2 text-[11px] text-fg-faint">
                At your DNS provider: create a <b>TXT</b> record, paste the{" "}
                <b>Host</b> into the name field and the <b>Value</b> into the
                content field — don&apos;t swap them.
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="mb-6 p-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-faint">
          Receiving email
        </h2>
        <p className="mb-4 text-sm text-fg-muted">
          Want to receive mail on this domain? Two ways to get it in:
        </p>

        <div className="mb-4">
          <p className="mb-2 text-sm text-fg">
            1. Point MX records at this instance
          </p>
          <p className="mb-2 text-xs text-fg-muted">
            Add this MX record so mail for {domain.name} is delivered straight
            here. Your operator needs to enable the SMTP listener for this to
            work.
          </p>
          <div className="mb-1 flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs uppercase tracking-wider text-fg-faint">
              Host
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
              {domain.name}
            </code>
            <CopyButton value={domain.name} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs uppercase tracking-wider text-fg-faint">
              Value
            </span>
            <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1.5 font-mono text-xs text-fg-muted">
              10 {mxHost}
            </code>
            <CopyButton value={`10 ${mxHost}`} />
          </div>
          <VerifyMx
            domainId={domain.id}
            initialVerified={domain.mxVerified}
            initialCheckedAt={domain.mxCheckedAt?.getTime() ?? null}
          />
        </div>

        <div className="mb-4">
          <p className="mb-2 text-sm text-fg">2. Amazon SES receiving</p>
          <p className="mb-2 text-xs text-fg-muted">
            Already receiving through SES? Create a receipt rule that publishes
            to an SNS topic, and subscribe this endpoint to the topic:
          </p>
          {sesEndpoint ? (
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1.5 font-mono text-xs text-fg-muted">
                {sesEndpoint}
              </code>
              <CopyButton value={sesEndpoint} />
            </div>
          ) : (
            <p className="text-xs text-fg-faint">
              Set your instance&apos;s public URL to see the exact endpoint —
              it lives at /api/inbound/ses.
            </p>
          )}
        </div>

        <div className="border-t border-hairline pt-4">
          <p className="mb-2 text-sm text-fg">Test receiving</p>
          {lastInbound ? (
            <p className="text-xs text-fg-muted">
              Last received:{" "}
              <Link
                href={`/emails/inbound/${lastInbound.id}`}
                className="text-lime hover:underline"
              >
                {lastInbound.from} → {lastInbound.subject || "(no subject)"}
              </Link>{" "}
              <span className="font-mono text-[11px] tabular-nums">
                {fmtDate(lastInbound.createdAt)}
              </span>
            </p>
          ) : (
            <>
              <p className="text-xs text-fg-muted">
                No inbound mail received yet for this domain. Once one of the
                methods above is set up, send a test message to any address
                at{" "}
                <code className="font-mono text-fg">{domain.name}</code> — e.g.{" "}
                <code className="font-mono text-fg">
                  probe@{domain.name}
                </code>{" "}
                — and it&apos;ll show up here, or in{" "}
                <Link
                  href="/emails/inbound"
                  className="text-lime hover:underline"
                >
                  Emails → Receiving
                </Link>
                . This panel checks for it automatically.
              </p>
              <InboundPoll />
            </>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <form action={verifyDomainAction}>
          <input type="hidden" name="id" value={domain.id} />
          {fullyVerified ? (
            <button
              type="submit"
              className="text-sm text-fg-muted hover:text-fg hover:underline"
              title="All records verified — re-check if you suspect DNS drift"
            >
              Re-check DNS records
            </button>
          ) : (
            <button type="submit" className={btnPrimary}>
              Verify DNS records
            </button>
          )}
        </form>
        <form action={deleteDomainAction}>
          <input type="hidden" name="id" value={domain.id} />
          <button type="submit" className={btnDanger}>
            Delete domain
          </button>
        </form>
      </div>
    </div>
  );
}
