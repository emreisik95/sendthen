import { and, desc, eq, isNull } from "drizzle-orm";
import { db, invites, teamMembers, users } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { publicUrl } from "@/lib/tracking";
import {
  createInviteAction,
  createTeamAction,
  removeMemberAction,
  renameTeamAction,
  revokeInviteAction,
} from "@/app/actions";
import {
  Card,
  PageHeader,
  btnDanger,
  btnPrimary,
  btnSecondary,
  fmtDate,
  inputCls,
} from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { team, role } = await getActiveTeam(user);
  const { invited, error } = await searchParams;

  const members = await db
    .select({ member: teamMembers, user: users })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, team.id));

  const pending = await db
    .select()
    .from(invites)
    .where(and(eq(invites.teamId, team.id), isNull(invites.acceptedAt)))
    .orderBy(desc(invites.createdAt));

  const base = publicUrl() ?? "http://localhost:3000";
  const isOwner = role === "owner";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Team" />

      {error === "owner_only" && (
        <Card className="mb-6 border-danger/40 px-4 py-3 text-sm text-danger">
          Only team owners can do that.
        </Card>
      )}

      {invited && (
        <Card className="mb-6 border-lime/40 p-4">
          <p className="mb-2 text-sm">
            Invite created — share this link (valid until revoked):
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1.5 font-mono text-xs text-lime">
              {base}/invite/{invited}
            </code>
            <CopyButton value={`${base}/invite/${invited}`} />
          </div>
        </Card>
      )}

      {/* team name */}
      <Card className="mb-6 p-4">
        <form action={renameTeamAction} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint">
              Team name
            </label>
            <input
              name="name"
              defaultValue={team.name}
              disabled={!isOwner}
              className={inputCls}
            />
          </div>
          {isOwner && (
            <button type="submit" className={btnSecondary}>
              Rename
            </button>
          )}
        </form>
      </Card>

      {/* members */}
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
        Members
      </h2>
      <Card className="mb-6 divide-y divide-hairline">
        {members.map(({ member, user: u }) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm">{u.name}</div>
              <div className="font-mono text-xs text-fg-faint">{u.email}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-xs ${
                member.role === "owner"
                  ? "bg-lime/14 text-lime"
                  : "bg-surface-3 text-fg-muted"
              }`}
            >
              {member.role}
            </span>
            {isOwner && member.userId !== user.id && (
              <form action={removeMemberAction}>
                <input type="hidden" name="id" value={member.id} />
                <button type="submit" className={btnDanger}>
                  Remove
                </button>
              </form>
            )}
          </div>
        ))}
      </Card>

      {/* invites */}
      {isOwner && (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Invite someone
          </h2>
          <form action={createInviteAction} className="mb-6 flex gap-2">
            <input
              name="email"
              type="email"
              placeholder="teammate@company.com"
              required
              className={`${inputCls} max-w-sm font-mono`}
            />
            <button type="submit" className={btnPrimary}>
              Create invite link
            </button>
          </form>

          {pending.length > 0 && (
            <Card className="mb-8 divide-y divide-hairline">
              {pending.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">
                    {inv.email}
                  </span>
                  <span className="font-mono text-xs text-fg-faint">
                    {fmtDate(inv.createdAt)}
                  </span>
                  <CopyButton value={`${base}/invite/${inv.token}`} />
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="id" value={inv.id} />
                    <button type="submit" className={btnDanger}>
                      Revoke
                    </button>
                  </form>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* new team */}
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
        Create another team
      </h2>
      <form action={createTeamAction} className="flex gap-2">
        <input
          name="name"
          placeholder="new team name"
          required
          className={`${inputCls} max-w-sm`}
        />
        <button type="submit" className={btnSecondary}>
          Create team
        </button>
      </form>
    </div>
  );
}
