import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, inboundEmails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import {
  deleteInboundAction,
  forwardInboundAction,
} from "@/app/actions";
import {
  Card,
  PageHeader,
  btnDanger,
  btnPrimary,
  fmtDate,
  inputCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  domain_not_verified:
    "Forwarding failed: the sending domain is not verified yet. Verify it on the Domains page first.",
  recipients_suppressed:
    "Forwarding failed: that recipient is on your suppression list.",
};

export default async function InboundEmailDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ forwarded?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { id } = await params;
  const { forwarded, error } = await searchParams;
  const [email] = await db
    .select()
    .from(inboundEmails)
    .where(and(eq(inboundEmails.id, id), eq(inboundEmails.teamId, team.id)));
  if (!email) notFound();

  if (!email.read) {
    // fire-and-forget: don't block render on the read flag
    void db
      .update(inboundEmails)
      .set({ read: true })
      .where(eq(inboundEmails.id, email.id))
      .catch(() => {});
  }

  const headers = email.headers ?? {};
  const attachments = email.attachments ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/emails/inbound"
        className="mb-4 inline-block text-sm text-fg-muted hover:text-fg"
      >
        ← Receiving
      </Link>
      <PageHeader title={email.subject || "(no subject)"}>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-info/14 px-2.5 py-0.5 font-mono text-xs text-info">
            <span aria-hidden>↓</span>
            received
          </span>
          {email.forwardedTo && (
            <Link
              href={`/emails/${email.forwardedTo}`}
              className="inline-flex items-center gap-1 rounded-full bg-lime/14 px-2.5 py-0.5 font-mono text-xs text-lime hover:bg-lime/20"
            >
              <span aria-hidden>→</span>
              forwarded
            </Link>
          )}
        </div>
      </PageHeader>

      {forwarded === "1" && (
        <div className="mb-4 rounded-md border border-lime/40 bg-lime/10 px-4 py-3 text-sm text-lime">
          Forwarded. View it under Sending.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {ERROR_MESSAGES[error] ?? `Forwarding failed (${error}).`}
        </div>
      )}

      <Card className="mb-6 divide-y divide-hairline text-sm">
        <Row label="From">
          <span className="font-mono text-xs">{email.from}</span>
        </Row>
        <Row label="To">
          <span className="font-mono text-xs">{email.to.join(", ")}</span>
        </Row>
        <Row label="Date">
          <span className="font-mono text-xs tabular-nums">
            {fmtDate(email.createdAt)}
          </span>
        </Row>
        {email.messageId && (
          <Row label="Message-ID">
            <span className="font-mono text-xs">{email.messageId}</span>
          </Row>
        )}
      </Card>

      {email.html ? (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Preview
          </h2>
          <Card className="mb-6 overflow-hidden">
            <iframe
              srcDoc={email.html}
              sandbox=""
              title="Inbound email preview"
              className="h-96 w-full bg-white"
            />
          </Card>
        </>
      ) : email.text ? (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Text
          </h2>
          <Card className="mb-6 p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs text-fg-muted">
              {email.text}
            </pre>
          </Card>
        </>
      ) : null}

      {Object.keys(headers).length > 0 && (
        <details className="mb-6">
          <summary className="cursor-pointer text-sm font-medium uppercase tracking-wider text-fg-faint hover:text-fg-muted">
            Headers
          </summary>
          <Card className="mt-3 p-4">
            <div className="space-y-1 font-mono text-xs text-fg-muted">
              {Object.entries(headers).map(([key, value]) => (
                <div key={key} className="break-all">
                  <span className="text-fg">{key}</span>: {value}
                </div>
              ))}
            </div>
          </Card>
        </details>
      )}

      {attachments.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Attachments
          </h2>
          <Card className="mb-6 divide-y divide-hairline">
            {attachments.map((a, i) => (
              <div
                key={`${a.filename}-${i}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="min-w-0 truncate font-mono text-xs">
                  {a.filename}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs tabular-nums text-fg-muted">
                    {(a.size / 1024).toFixed(1)} KB
                  </span>
                  {a.content ? (
                    <a
                      href={`data:${a.contentType};base64,${a.content}`}
                      download={a.filename}
                      className="text-xs text-lime hover:underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-fg-faint">
                      (too large, not stored)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </Card>
        </>
      )}

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
        Forward
      </h2>
      <Card className="mb-6 p-4">
        <form action={forwardInboundAction} className="flex items-center gap-3">
          <input type="hidden" name="id" value={email.id} />
          <input
            type="email"
            name="to"
            required
            placeholder="someone@example.com"
            className={inputCls}
          />
          <button type="submit" className={`${btnPrimary} shrink-0`}>
            Forward
          </button>
        </form>
      </Card>

      <form action={deleteInboundAction}>
        <input type="hidden" name="id" value={email.id} />
        <button type="submit" className={btnDanger}>
          Delete
        </button>
      </form>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-28 shrink-0 text-xs uppercase tracking-wider text-fg-faint">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
