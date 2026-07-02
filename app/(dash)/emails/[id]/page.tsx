import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, emailEvents, emails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { Card, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

const EVENT_DOT_COLORS: Record<string, string> = {
  "email.queued": "bg-fg-faint",
  "email.sent": "bg-info",
  "email.delivered": "bg-lime",
  "email.opened": "bg-lime",
  "email.clicked": "bg-lime",
  "email.bounced": "bg-danger",
  "email.failed": "bg-danger",
  "email.complained": "bg-danger",
  "email.canceled": "bg-fg-faint",
};

function fmtAgo(d: Date | null | undefined): string {
  if (!d) return "—";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { id } = await params;
  const [email] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.teamId, team.id)));
  if (!email) notFound();

  const events = await db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.emailId, id))
    .orderBy(asc(emailEvents.createdAt));

  const tags = email.tags ? Object.entries(email.tags) : [];
  const attachments = email.attachments ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/emails"
        className="mb-4 inline-block text-sm text-fg-muted hover:text-fg"
      >
        ← Emails
      </Link>
      <PageHeader title={email.subject}>
        <StatusPill status={email.status} />
      </PageHeader>

      <Card className="mb-6 divide-y divide-hairline text-sm">
        <Row label="ID">
          <span className="font-mono text-xs">{email.id}</span>
          <CopyButton value={email.id} />
        </Row>
        <Row label="From">
          <span className="font-mono text-xs">{email.from}</span>
        </Row>
        <Row label="To">
          <span className="font-mono text-xs">{email.to.join(", ")}</span>
        </Row>
        {email.cc && email.cc.length > 0 && (
          <Row label="CC">
            <span className="font-mono text-xs">{email.cc.join(", ")}</span>
          </Row>
        )}
        {email.bcc && email.bcc.length > 0 && (
          <Row label="BCC">
            <span className="font-mono text-xs">{email.bcc.join(", ")}</span>
          </Row>
        )}
        {tags.length > 0 && (
          <Row label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {tags.map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg-muted"
                >
                  {k}
                  <span className="mx-1 text-fg-faint">=</span>
                  <span className="text-fg">{v}</span>
                </span>
              ))}
            </div>
          </Row>
        )}
        {attachments.length > 0 && (
          <Row label="Attachments">
            <div className="flex flex-col gap-1">
              {attachments.map((a, i) => (
                <span key={i} className="font-mono text-xs">
                  {a.filename}
                  <span className="ml-2 text-fg-faint">
                    {fmtSize(Math.floor((a.content.length * 3) / 4))}
                  </span>
                </span>
              ))}
            </div>
          </Row>
        )}
        {email.messageId && (
          <Row label="Message-ID">
            <span className="font-mono text-xs">{email.messageId}</span>
          </Row>
        )}
        {email.lastError && (
          <Row label="Last error">
            <span className="font-mono text-xs text-danger">
              {email.lastError}
            </span>
          </Row>
        )}
        <Row label="Created">
          <span className="font-mono text-xs tabular-nums">
            {fmtDate(email.createdAt)}
          </span>
        </Row>
      </Card>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
        Events
      </h2>
      <Card className="mb-6 px-4 py-4">
        {events.length === 0 ? (
          <p className="text-sm text-fg-muted">No events recorded yet.</p>
        ) : (
          <ol className="relative ml-1.5 border-l border-line">
            {events.map((ev) => {
              const clickUrl =
                ev.type === "email.clicked" &&
                ev.data &&
                typeof ev.data.url === "string"
                  ? ev.data.url
                  : null;
              return (
                <li key={ev.id} className="relative pb-5 pl-5 last:pb-0">
                  <span
                    aria-hidden
                    className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ${
                      EVENT_DOT_COLORS[ev.type] ?? "bg-fg-faint"
                    }`}
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-xs text-fg">{ev.type}</span>
                    <span
                      className="shrink-0 font-mono text-xs tabular-nums text-fg-muted"
                      title={fmtDate(ev.createdAt)}
                    >
                      {fmtAgo(ev.createdAt)}
                      <span className="ml-2 text-fg-faint">
                        {fmtDate(ev.createdAt)}
                      </span>
                    </span>
                  </div>
                  {clickUrl && (
                    <p className="mt-1 break-all font-mono text-xs text-fg-muted">
                      {clickUrl}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {email.html && (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Preview
          </h2>
          <Card className="mb-6 overflow-hidden">
            <iframe
              srcDoc={email.html}
              sandbox=""
              title="Email preview"
              className="h-96 w-full bg-white"
            />
          </Card>
          <details className="mb-6">
            <summary className="cursor-pointer text-sm text-fg-muted hover:text-fg">
              View source
            </summary>
            <Card className="mt-3 overflow-hidden">
              <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed text-fg-muted">
                {email.html}
              </pre>
            </Card>
          </details>
        </>
      )}
      {!email.html && email.text && (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Text
          </h2>
          <Card className="p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs text-fg-muted">
              {email.text}
            </pre>
          </Card>
        </>
      )}
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
