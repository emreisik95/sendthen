import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, emailEvents, emails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { Card, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [email] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.userId, user.id)));
  if (!email) notFound();

  const events = await db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.emailId, id))
    .orderBy(asc(emailEvents.createdAt));

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
      <Card className="mb-6 divide-y divide-hairline">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="font-mono text-xs">{ev.type}</span>
            <span className="font-mono text-xs tabular-nums text-fg-muted">
              {fmtDate(ev.createdAt)}
            </span>
          </div>
        ))}
      </Card>

      {email.html && (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Preview
          </h2>
          <Card className="overflow-hidden">
            <iframe
              srcDoc={email.html}
              sandbox=""
              title="Email preview"
              className="h-96 w-full bg-white"
            />
          </Card>
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
