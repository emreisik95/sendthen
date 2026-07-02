import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, domains } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { dnsRecordsForDomain } from "@/lib/dkim";
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

export const dynamic = "force-dynamic";

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.userId, user.id)));
  if (!domain) notFound();

  const records = dnsRecordsForDomain(
    domain.name,
    domain.dkimSelector,
    domain.dkimPublicKey,
  );

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

      <p className="mb-6 text-sm text-fg-muted">
        Publish these DNS records, then hit verify. Last check:{" "}
        <span className="font-mono text-xs tabular-nums">
          {fmtDate(domain.lastCheckedAt)}
        </span>
      </p>

      <div className="mb-6 space-y-4">
        {records.map((r) => {
          const verified =
            r.purpose === "dkim" ? domain.dkimVerified : domain.spfVerified;
          return (
            <Card key={r.name} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-fg-faint">
                  {r.purpose} · {r.type}
                </span>
                <StatusPill status={verified ? "verified" : "pending"} />
              </div>
              <div className="mb-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                  {r.name}
                </code>
                <CopyButton value={r.name} />
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1.5 font-mono text-xs text-fg-muted">
                  {r.value}
                </code>
                <CopyButton value={r.value} />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <form action={verifyDomainAction}>
          <input type="hidden" name="id" value={domain.id} />
          <button type="submit" className={btnPrimary}>
            Verify DNS records
          </button>
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
