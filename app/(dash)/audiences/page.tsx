import Link from "next/link";
import { desc, eq, count } from "drizzle-orm";
import { db, audiences, contacts } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { createAudienceAction } from "@/app/actions";
import {
  Card,
  Empty,
  PageHeader,
  btnPrimary,
  fmtDate,
  inputCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AudiencesPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const rows = await db
    .select({
      audience: audiences,
      contactCount: count(contacts.id),
    })
    .from(audiences)
    .leftJoin(contacts, eq(contacts.audienceId, audiences.id))
    .where(eq(audiences.teamId, team.id))
    .groupBy(audiences.id)
    .orderBy(desc(audiences.createdAt));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Audiences" />
      <form action={createAudienceAction} className="mb-6 flex gap-2">
        <input
          name="name"
          placeholder="audience name (e.g. newsletter)"
          required
          className={`${inputCls} max-w-sm`}
        />
        <button type="submit" className={btnPrimary}>
          Create audience
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>No audiences. Create one to collect contacts.</Empty>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map(({ audience, contactCount }) => (
            <Link
              key={audience.id}
              href={`/audiences/${audience.id}`}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <span className="text-sm">{audience.name}</span>
              <span className="flex items-center gap-4 font-mono text-xs text-fg-faint">
                <span>{contactCount} contacts</span>
                <span>{fmtDate(audience.createdAt)}</span>
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
