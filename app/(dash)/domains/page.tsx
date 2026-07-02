import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, domains } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { createDomainAction } from "@/app/actions";
import {
  Card,
  Empty,
  PageHeader,
  StatusPill,
  btnPrimary,
  fmtDate,
  inputCls,
} from "@/components/ui";
import { LiveVerify } from "@/components/domains/live-verify";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const rows = await db
    .select()
    .from(domains)
    .where(eq(domains.teamId, team.id))
    .orderBy(desc(domains.createdAt));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Domains" />

      <form action={createDomainAction} className="mb-6 flex gap-2">
        <input
          name="name"
          placeholder="mail.example.com"
          required
          className={`${inputCls} max-w-sm font-mono`}
        />
        <button type="submit" className={btnPrimary}>
          Add domain
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>
          Add a sending domain to get DKIM + SPF records for deliverability.
        </Empty>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map((d) => (
            <Link
              key={d.id}
              href={`/domains/${d.id}`}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <span className="font-mono text-sm">{d.name}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs tabular-nums text-fg-faint">
                  {fmtDate(d.createdAt)}
                </span>
                {d.status === "pending" && (
                  <LiveVerify domainId={d.id} compact />
                )}
                <StatusPill status={d.status} />
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
