import { asc, count, desc, eq } from "drizzle-orm";
import {
  db,
  domains,
  teamMembers,
  teams,
  users,
  type Domain,
  type TeamMember,
  type User,
} from "./db";

export type AdminOperationErrorCode =
  | "forbidden"
  | "invalid_role"
  | "not_found"
  | "self_management"
  | "final_admin";

const ERROR_MESSAGES: Record<AdminOperationErrorCode, string> = {
  forbidden: "Administrator access is required.",
  invalid_role: "Choose a valid account role.",
  not_found: "That user no longer exists.",
  self_management: "You cannot manage your own account here.",
  final_admin: "The final administrator must remain an administrator.",
};

export class AdminOperationError extends Error {
  constructor(public readonly code: AdminOperationErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "AdminOperationError";
  }
}

export type AdminDomainSummary = Pick<Domain, "id" | "name" | "status">;

export interface AdminWorkspaceSummary {
  id: string;
  name: string;
  role: TeamMember["role"];
  domains: AdminDomainSummary[];
}

export interface AdminUserSummary
  extends Pick<User, "id" | "name" | "email" | "role" | "createdAt"> {
  isCurrent: boolean;
  workspaces: AdminWorkspaceSummary[];
}

export interface AdminDashboardData {
  summary: {
    users: number;
    admins: number;
    workspaces: number;
    domains: number;
    verifiedDomains: number;
  };
  users: AdminUserSummary[];
}

async function requireAdminActor(actorId: string): Promise<User> {
  const [actor] = await db.select().from(users).where(eq(users.id, actorId));
  if (!actor || actor.role !== "admin") {
    throw new AdminOperationError("forbidden");
  }
  return actor;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesSearch(user: AdminUserSummary, search: string): boolean {
  if (!search) return true;
  return [
    user.name,
    user.email,
    ...user.workspaces.flatMap((workspace) => [
      workspace.name,
      ...workspace.domains.map((domain) => domain.name),
    ]),
  ].some((value) => normalized(value).includes(search));
}

export async function loadAdminDashboard(
  actorId: string,
  search = "",
): Promise<AdminDashboardData> {
  const actor = await requireAdminActor(actorId);
  const [allUsers, allTeams, memberships, allDomains] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt), asc(users.email)),
    db.select({ id: teams.id }).from(teams),
    db
      .select({
        userId: teamMembers.userId,
        role: teamMembers.role,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .orderBy(asc(teams.name)),
    db
      .select({
        id: domains.id,
        teamId: domains.teamId,
        name: domains.name,
        status: domains.status,
      })
      .from(domains)
      .orderBy(asc(domains.name)),
  ]);

  const domainsByTeam = new Map<string, AdminDomainSummary[]>();
  for (const domain of allDomains) {
    if (!domain.teamId) continue;
    const grouped = domainsByTeam.get(domain.teamId) ?? [];
    grouped.push({ id: domain.id, name: domain.name, status: domain.status });
    domainsByTeam.set(domain.teamId, grouped);
  }

  const workspacesByUser = new Map<string, AdminWorkspaceSummary[]>();
  for (const membership of memberships) {
    const grouped = workspacesByUser.get(membership.userId) ?? [];
    grouped.push({
      id: membership.teamId,
      name: membership.teamName,
      role: membership.role,
      domains: domainsByTeam.get(membership.teamId) ?? [],
    });
    workspacesByUser.set(membership.userId, grouped);
  }

  const userSummaries = allUsers.map<AdminUserSummary>((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    isCurrent: user.id === actor.id,
    workspaces: workspacesByUser.get(user.id) ?? [],
  }));
  const query = normalized(search);

  return {
    summary: {
      users: allUsers.length,
      admins: allUsers.filter((user) => user.role === "admin").length,
      workspaces: allTeams.length,
      domains: allDomains.length,
      verifiedDomains: allDomains.filter((domain) => domain.status === "verified")
        .length,
    },
    users: userSummaries.filter((user) => matchesSearch(user, query)),
  };
}

export interface ChangeUserRoleResult {
  userId: string;
  role: User["role"];
  changed: boolean;
}

export async function changeUserRole(
  actorId: string,
  targetId: string,
  requestedRole: string,
): Promise<ChangeUserRoleResult> {
  return db.transaction((tx) => {
    const actor = tx.select().from(users).where(eq(users.id, actorId)).get();
    if (!actor || actor.role !== "admin") {
      throw new AdminOperationError("forbidden");
    }
    if (requestedRole !== "admin" && requestedRole !== "member") {
      throw new AdminOperationError("invalid_role");
    }

    const target = tx.select().from(users).where(eq(users.id, targetId)).get();
    if (!target) throw new AdminOperationError("not_found");
    if (target.id === actor.id) {
      throw new AdminOperationError("self_management");
    }
    if (target.role === requestedRole) {
      return { userId: target.id, role: requestedRole, changed: false };
    }

    if (target.role === "admin" && requestedRole === "member") {
      const adminCount = tx
        .select({ value: count() })
        .from(users)
        .where(eq(users.role, "admin"))
        .get();
      if (!adminCount || adminCount.value <= 1) {
        throw new AdminOperationError("final_admin");
      }
    }

    tx.update(users)
      .set({ role: requestedRole })
      .where(eq(users.id, target.id))
      .run();
    return { userId: target.id, role: requestedRole, changed: true };
  });
}
