import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  apiKeys,
  audiences,
  broadcasts,
  domains,
  emails,
  suppressions,
  teamMembers,
  teams,
  templates,
  userSettings,
  webhooks,
  type Team,
  type TeamMember,
  type User,
} from "./db";
import { newMemberId, newTeamId } from "./id";

const TEAM_COOKIE = "st_team";

export async function createTeam(
  name: string,
  ownerId: string,
): Promise<Team> {
  const [team] = await db
    .insert(teams)
    .values({ id: newTeamId(), name, createdAt: new Date() })
    .returning();
  await db.insert(teamMembers).values({
    id: newMemberId(),
    teamId: team.id,
    userId: ownerId,
    role: "owner",
    createdAt: new Date(),
  });
  return team;
}

/** Attach any of the user's pre-teams rows (team_id NULL) to this team. */
async function adoptUserRows(userId: string, teamId: string): Promise<void> {
  const owned = and(eq(apiKeys.userId, userId), isNull(apiKeys.teamId));
  await db.update(apiKeys).set({ teamId }).where(owned);
  await db
    .update(domains)
    .set({ teamId })
    .where(and(eq(domains.userId, userId), isNull(domains.teamId)));
  await db
    .update(emails)
    .set({ teamId })
    .where(and(eq(emails.userId, userId), isNull(emails.teamId)));
  await db
    .update(webhooks)
    .set({ teamId })
    .where(and(eq(webhooks.userId, userId), isNull(webhooks.teamId)));
  await db
    .update(suppressions)
    .set({ teamId })
    .where(and(eq(suppressions.userId, userId), isNull(suppressions.teamId)));
  await db
    .update(templates)
    .set({ teamId })
    .where(and(eq(templates.userId, userId), isNull(templates.teamId)));
  await db
    .update(audiences)
    .set({ teamId })
    .where(and(eq(audiences.userId, userId), isNull(audiences.teamId)));
  await db
    .update(broadcasts)
    .set({ teamId })
    .where(and(eq(broadcasts.userId, userId), isNull(broadcasts.teamId)));
  await db
    .update(userSettings)
    .set({ teamId })
    .where(and(eq(userSettings.userId, userId), isNull(userSettings.teamId)));
}

export async function membershipsOf(
  userId: string,
): Promise<{ team: Team; member: TeamMember }[]> {
  const rows = await db
    .select({ team: teams, member: teamMembers })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId));
  return rows;
}

/**
 * Resolve the user's active team from the st_team cookie (validated
 * against membership). Users without any team get a personal one, and
 * their pre-teams rows are adopted into it.
 */
export async function getActiveTeam(
  user: User,
): Promise<{ team: Team; role: TeamMember["role"] }> {
  let memberships = await membershipsOf(user.id);
  if (memberships.length === 0) {
    const personal = await createTeam(`${user.name}'s team`, user.id);
    await adoptUserRows(user.id, personal.id);
    memberships = await membershipsOf(user.id);
  }

  const wanted = (await cookies()).get(TEAM_COOKIE)?.value;
  const active =
    memberships.find((m) => m.team.id === wanted) ?? memberships[0];
  return { team: active.team, role: active.member.role };
}

export async function setActiveTeamCookie(teamId: string): Promise<void> {
  (await cookies()).set(TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
  });
}

export async function isMember(
  teamId: string,
  userId: string,
): Promise<TeamMember | undefined> {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    );
  return member;
}
