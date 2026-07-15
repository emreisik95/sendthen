import { desc, eq } from "drizzle-orm";
import { db, suppressions } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import {
  addSuppressionAction,
  removeSuppressionAction,
} from "@/app/actions";
import {
  Card,
  EmptyState,
  PageHeader,
  btnDanger,
  btnPrimary,
  fmtDate,
  inputCls,
} from "@/components/ui";
import { IconBan } from "@/components/nav-icons";

export const dynamic = "force-dynamic";

export default async function SuppressionsPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const rows = await db
    .select()
    .from(suppressions)
    .where(eq(suppressions.teamId, team.id))
    .orderBy(desc(suppressions.createdAt))
    .limit(200);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Blocked recipients" />
      <p className="mb-6 text-sm text-fg-muted">
        Addresses here never receive email from you. Hard bounces and
        complaints are added automatically.
      </p>

      <form action={addSuppressionAction} className="mb-6 flex gap-2">
        <input
          name="email"
          type="email"
          placeholder="blocked@example.com"
          required
          className={`${inputCls} max-w-sm font-mono`}
        />
        <button type="submit" className={btnPrimary}>
          Block recipient
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconBan />}
          title="No blocked recipients — that's good."
          description="Hard bounces and spam complaints land here automatically so those addresses are never emailed again. You can also block an address manually with the form above."
        >
          <a
            href="/docs#suppressions"
            className="text-sm text-fg-muted underline hover:text-fg"
          >
            Blocked recipients guide →
          </a>
        </EmptyState>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-sm">
                {s.email}
              </span>
              <span className="font-mono text-xs text-fg-faint">
                {s.reason} · {fmtDate(s.createdAt)}
              </span>
              <form action={removeSuppressionAction}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className={btnDanger}>
                  Remove
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
