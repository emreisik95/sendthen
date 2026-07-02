import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { db, inboundEmails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { markAllInboundReadAction } from "@/app/actions";
import {
  Card,
  Empty,
  PageHeader,
  btnSecondary,
  fmtDate,
} from "@/components/ui";
import { EmailTabs } from "../tabs";

export const dynamic = "force-dynamic";

export default async function InboundEmailsPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const rows = await db
    .select()
    .from(inboundEmails)
    .where(eq(inboundEmails.teamId, team.id))
    .orderBy(desc(inboundEmails.createdAt))
    .limit(100);
  const [{ value: unreadCount }] = await db
    .select({ value: count() })
    .from(inboundEmails)
    .where(
      and(eq(inboundEmails.teamId, team.id), eq(inboundEmails.read, false)),
    );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Emails">
        {unreadCount > 0 && (
          <form action={markAllInboundReadAction}>
            <button type="submit" className={btnSecondary}>
              Mark all read
            </button>
          </form>
        )}
      </PageHeader>
      <EmailTabs active="receiving" unread={unreadCount} />
      {rows.length === 0 ? (
        <Empty>
          No inbound email yet. Point your domain&apos;s MX records here or
          connect SES receiving — see the Domains page.
        </Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left">
              <tr className="text-xs uppercase tracking-wider text-fg-faint">
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  className={`border-t border-hairline transition-colors hover:bg-surface-2 ${
                    e.read ? "" : "font-medium"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/emails/inbound/${e.id}`}
                      className="flex items-center gap-2"
                    >
                      {!e.read && (
                        <span
                          aria-label="unread"
                          className="size-1.5 shrink-0 rounded-full bg-lime"
                        />
                      )}
                      {e.from}
                    </Link>
                  </td>
                  <td className="max-w-64 truncate px-4 py-3">
                    <Link
                      href={`/emails/inbound/${e.id}`}
                      className="flex items-center gap-2"
                    >
                      <span className="truncate">{e.subject || "(no subject)"}</span>
                      {e.forwardedTo && (
                        <span className="shrink-0 rounded-full bg-info/14 px-2 py-0.5 font-mono text-[10px] font-normal text-info">
                          forwarded
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-fg-muted">
                    <Link href={`/emails/inbound/${e.id}`} className="block">
                      {fmtDate(e.createdAt)}
                    </Link>
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
