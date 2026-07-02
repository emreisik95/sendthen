import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { db, emails, inboundEmails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import {
  PageHeader,
  StatusPill,
  Card,
  fmtDate,
  inputCls,
  btnSecondary,
} from "@/components/ui";
import { Select } from "@/components/select";
import { EmailTabs } from "./tabs";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  "queued",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "canceled",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

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

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
  }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const sp = await searchParams;
  // Repeated query params arrive as arrays at runtime — take the first.
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status = STATUS_FILTERS.includes(statusParam as StatusFilter)
    ? (statusParam as StatusFilter)
    : undefined;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();
  const hasFilters = Boolean(status || q);

  let rows = await db
    .select()
    .from(emails)
    .where(
      and(
        eq(emails.teamId, team.id),
        status ? eq(emails.status, status) : undefined,
      ),
    )
    .orderBy(desc(emails.createdAt))
    .limit(hasFilters ? 500 : 100);

  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (e) =>
        e.subject.toLowerCase().includes(needle) ||
        e.to.some((addr) => addr.toLowerCase().includes(needle)),
    );
  }

  const [{ value: unreadCount }] = await db
    .select({ value: count() })
    .from(inboundEmails)
    .where(
      and(eq(inboundEmails.teamId, team.id), eq(inboundEmails.read, false)),
    );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Emails" />
      <EmailTabs active="sending" unread={unreadCount} />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          name="status"
          submitOnChange
          defaultValue={status ?? ""}
          className="w-44"
          options={[
            { value: "", label: "All statuses" },
            ...STATUS_FILTERS.map((s) => ({ value: s, label: s })),
          ]}
        />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search to-address or subject…"
          className={`${inputCls} w-64`}
        />
        <button type="submit" className={btnSecondary}>
          Filter
        </button>
      </form>

      {hasFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          {status && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 font-mono text-fg-muted">
              status: <span className="text-fg">{status}</span>
            </span>
          )}
          {q && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 font-mono text-fg-muted">
              search: <span className="text-fg">{q}</span>
            </span>
          )}
          <Link href="/emails" className="text-fg-muted underline hover:text-fg">
            clear
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        hasFilters ? (
          <Card className="px-6 py-12 text-center text-sm text-fg-muted">
            No emails match these filters.{" "}
            <Link href="/emails" className="text-fg underline hover:text-lime">
              Clear filters
            </Link>
          </Card>
        ) : (
          <Card className="px-6 py-12 text-center">
            <p className="mb-1 text-sm font-medium text-fg">No emails yet</p>
            <p className="mb-5 text-sm text-fg-muted">
              Send your first email with an API key — it will show up here.
            </p>
            <pre className="mx-auto mb-5 max-w-xl overflow-x-auto rounded-md border border-line bg-surface-2 p-4 text-left font-mono text-xs leading-relaxed text-fg-muted">
              {`curl -X POST https://your-host/api/v1/emails \\
  -H "Authorization: Bearer st_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "you@yourdomain.com",
    "to": ["hello@example.com"],
    "subject": "Hello from sendthen",
    "html": "<p>It works.</p>"
  }'`}
            </pre>
            <Link
              href="/docs"
              className="text-sm text-fg-muted underline hover:text-fg"
            >
              Read the docs →
            </Link>
          </Card>
        )
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left">
              <tr className="text-xs uppercase tracking-wider text-fg-faint">
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-hairline transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/emails/${e.id}`} className="block">
                      {e.to[0]}
                      {e.to.length > 1 && (
                        <span className="ml-1 text-fg-faint">
                          +{e.to.length - 1} more
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="max-w-64 truncate px-4 py-3">
                    <Link href={`/emails/${e.id}`} className="block">
                      {e.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={e.status} />
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs tabular-nums text-fg-muted"
                    title={fmtDate(e.sentAt ?? e.createdAt)}
                  >
                    {fmtAgo(e.sentAt ?? e.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
