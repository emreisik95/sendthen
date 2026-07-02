import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, emails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { Empty, PageHeader, StatusPill, Card, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(emails)
    .where(eq(emails.userId, user.id))
    .orderBy(desc(emails.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Emails" />
      {rows.length === 0 ? (
        <Empty>
          No emails yet. Send one via{" "}
          <code className="font-mono text-fg">POST /api/v1/emails</code> with
          your API key.
        </Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left">
              <tr className="text-xs uppercase tracking-wider text-fg-faint">
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
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
                      {e.to.join(", ")}
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
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-fg-muted">
                    {fmtDate(e.createdAt)}
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
