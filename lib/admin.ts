import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import {
  db,
  apiKeys,
  audiences,
  broadcasts,
  contacts,
  domains,
  emailEvents,
  emails,
  inboundEmails,
  invites,
  sessions,
  suppressions,
  teamMembers,
  teams,
  templates,
  userSettings,
  users,
  webhookDeliveries,
  webhooks,
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

export interface DeleteUserResult {
  userId: string;
  deletedWorkspaces: number;
  transferredWorkspaces: number;
}

export async function deleteUser(
  actorId: string,
  targetId: string,
): Promise<DeleteUserResult> {
  return db.transaction((tx) => {
    const actor = tx.select().from(users).where(eq(users.id, actorId)).get();
    if (!actor || actor.role !== "admin") {
      throw new AdminOperationError("forbidden");
    }

    const target = tx.select().from(users).where(eq(users.id, targetId)).get();
    if (!target) throw new AdminOperationError("not_found");
    if (target.id === actor.id) {
      throw new AdminOperationError("self_management");
    }
    if (target.role === "admin") {
      const adminCount = tx
        .select({ value: count() })
        .from(users)
        .where(eq(users.role, "admin"))
        .get();
      if (!adminCount || adminCount.value <= 1) {
        throw new AdminOperationError("final_admin");
      }
    }

    const memberships = tx
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, target.id))
      .all();
    let deletedWorkspaces = 0;
    let transferredWorkspaces = 0;

    const deleteEmailRecord = (emailId: string) => {
      const events = tx
        .select({ id: emailEvents.id })
        .from(emailEvents)
        .where(eq(emailEvents.emailId, emailId))
        .all();
      for (const event of events) {
        tx.delete(webhookDeliveries)
          .where(eq(webhookDeliveries.eventId, event.id))
          .run();
      }
      tx.delete(emailEvents).where(eq(emailEvents.emailId, emailId)).run();
      tx.delete(emails).where(eq(emails.id, emailId)).run();
    };

    const deleteWebhookRecord = (webhookId: string) => {
      tx.delete(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId))
        .run();
      tx.delete(webhooks).where(eq(webhooks.id, webhookId)).run();
    };

    const deleteDomainRecord = (domainId: string) => {
      const domainEmails = tx
        .select({ id: emails.id })
        .from(emails)
        .where(eq(emails.domainId, domainId))
        .all();
      for (const email of domainEmails) deleteEmailRecord(email.id);
      tx.delete(inboundEmails)
        .where(eq(inboundEmails.domainId, domainId))
        .run();
      tx.delete(domains).where(eq(domains.id, domainId)).run();
    };

    const deleteApiKeyRecord = (apiKeyId: string) => {
      const keyEmails = tx
        .select({ id: emails.id })
        .from(emails)
        .where(eq(emails.apiKeyId, apiKeyId))
        .all();
      for (const email of keyEmails) deleteEmailRecord(email.id);
      tx.delete(apiKeys).where(eq(apiKeys.id, apiKeyId)).run();
    };

    const deleteAudienceRecord = (audienceId: string) => {
      tx.delete(broadcasts).where(eq(broadcasts.audienceId, audienceId)).run();
      tx.delete(contacts).where(eq(contacts.audienceId, audienceId)).run();
      tx.delete(audiences).where(eq(audiences.id, audienceId)).run();
    };

    const deleteWorkspace = (teamId: string) => {
      const teamEmails = tx
        .select({ id: emails.id })
        .from(emails)
        .where(eq(emails.teamId, teamId))
        .all();
      for (const email of teamEmails) deleteEmailRecord(email.id);

      const teamWebhooks = tx
        .select({ id: webhooks.id })
        .from(webhooks)
        .where(eq(webhooks.teamId, teamId))
        .all();
      for (const webhook of teamWebhooks) deleteWebhookRecord(webhook.id);

      tx.delete(broadcasts).where(eq(broadcasts.teamId, teamId)).run();
      const teamAudiences = tx
        .select({ id: audiences.id })
        .from(audiences)
        .where(eq(audiences.teamId, teamId))
        .all();
      for (const audience of teamAudiences) deleteAudienceRecord(audience.id);

      tx.delete(inboundEmails).where(eq(inboundEmails.teamId, teamId)).run();
      const teamDomains = tx
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.teamId, teamId))
        .all();
      for (const domain of teamDomains) deleteDomainRecord(domain.id);

      const teamKeys = tx
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.teamId, teamId))
        .all();
      for (const key of teamKeys) deleteApiKeyRecord(key.id);

      tx.delete(suppressions).where(eq(suppressions.teamId, teamId)).run();
      tx.delete(templates).where(eq(templates.teamId, teamId)).run();
      tx.delete(userSettings).where(eq(userSettings.teamId, teamId)).run();
      tx.delete(invites).where(eq(invites.teamId, teamId)).run();
      tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId)).run();
      tx.delete(teams).where(eq(teams.id, teamId)).run();
    };

    for (const membership of memberships) {
      if (membership.role !== "owner") continue;
      const remaining = tx
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, membership.teamId),
            ne(teamMembers.userId, target.id),
          ),
        )
        .orderBy(asc(teamMembers.createdAt), asc(teamMembers.id))
        .all();

      if (remaining.length === 0) {
        deleteWorkspace(membership.teamId);
        deletedWorkspaces += 1;
        continue;
      }

      if (!remaining.some((candidate) => candidate.role === "owner")) {
        tx.update(teamMembers)
          .set({ role: "owner" })
          .where(eq(teamMembers.id, remaining[0].id))
          .run();
        transferredWorkspaces += 1;
      }
    }

    const targetEmails = tx
      .select({ id: emails.id })
      .from(emails)
      .where(eq(emails.userId, target.id))
      .all();
    for (const email of targetEmails) deleteEmailRecord(email.id);

    const targetWebhooks = tx
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(eq(webhooks.userId, target.id))
      .all();
    for (const webhook of targetWebhooks) deleteWebhookRecord(webhook.id);

    tx.delete(broadcasts).where(eq(broadcasts.userId, target.id)).run();
    const targetAudiences = tx
      .select({ id: audiences.id })
      .from(audiences)
      .where(eq(audiences.userId, target.id))
      .all();
    for (const audience of targetAudiences) deleteAudienceRecord(audience.id);

    const targetDomains = tx
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.userId, target.id))
      .all();
    for (const domain of targetDomains) deleteDomainRecord(domain.id);

    const targetKeys = tx
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.userId, target.id))
      .all();
    for (const key of targetKeys) deleteApiKeyRecord(key.id);

    tx.delete(suppressions).where(eq(suppressions.userId, target.id)).run();
    tx.delete(templates).where(eq(templates.userId, target.id)).run();
    tx.delete(userSettings).where(eq(userSettings.userId, target.id)).run();
    tx.delete(sessions).where(eq(sessions.userId, target.id)).run();

    tx.delete(users).where(eq(users.id, target.id)).run();
    return {
      userId: target.id,
      deletedWorkspaces,
      transferredWorkspaces,
    };
  });
}
