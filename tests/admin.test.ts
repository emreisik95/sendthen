import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
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
  sessions,
  suppressions,
  teamMembers,
  teams,
  templates,
  userSettings,
  users,
  webhookDeliveries,
  webhooks,
  type Team,
  type User,
} from "@/lib/db";
import { registerUser } from "@/lib/auth-user";
import { createTeam } from "@/lib/team";
import {
  newApiKeyId,
  newAudienceId,
  newBroadcastId,
  newContactId,
  newDeliveryId,
  newDomainId,
  newEmailId,
  newEventId,
  newInboundId,
  newMemberId,
  newSettingsId,
  newSuppressionId,
  newTemplateId,
  newWebhookId,
} from "@/lib/id";
import {
  AdminOperationError,
  changeUserRole,
  deleteUser,
  loadAdminDashboard,
} from "@/lib/admin";

let admin: User;
let member: User;
let secondMember: User;
let sharedTeam: Team;
let personalTeam: Team;

beforeAll(async () => {
  admin = await registerUser(
    "admin-dashboard-owner@sendthen.dev",
    "Admin Dashboard Owner",
    "password123",
  );
  await db
    .update(users)
    .set({ role: "admin", createdAt: new Date("2026-01-01T00:00:00Z") })
    .where(eq(users.id, admin.id));
  [admin] = await db.select().from(users).where(eq(users.id, admin.id));

  member = await registerUser(
    "ada@admin-dashboard.test",
    "Ada Lovelace",
    "password123",
  );
  await db
    .update(users)
    .set({ createdAt: new Date("2026-02-01T00:00:00Z") })
    .where(eq(users.id, member.id));
  [member] = await db.select().from(users).where(eq(users.id, member.id));

  secondMember = await registerUser(
    "grace@admin-dashboard.test",
    "Grace Hopper",
    "password123",
  );
  await db
    .update(users)
    .set({ createdAt: new Date("2026-03-01T00:00:00Z") })
    .where(eq(users.id, secondMember.id));
  [secondMember] = await db
    .select()
    .from(users)
    .where(eq(users.id, secondMember.id));

  sharedTeam = await createTeam("Shared Operators", admin.id);
  await db.insert(teamMembers).values([
    {
      id: newMemberId(),
      teamId: sharedTeam.id,
      userId: member.id,
      role: "member",
      createdAt: new Date("2026-02-02T00:00:00Z"),
    },
    {
      id: newMemberId(),
      teamId: sharedTeam.id,
      userId: secondMember.id,
      role: "member",
      createdAt: new Date("2026-03-02T00:00:00Z"),
    },
  ]);
  personalTeam = await createTeam("Ada Personal", member.id);

  await db.insert(domains).values([
    {
      id: newDomainId(),
      userId: admin.id,
      teamId: sharedTeam.id,
      name: "verified.admin-dashboard.test",
      status: "verified",
      dkimPrivateKey: "private",
      dkimPublicKey: "public",
      createdAt: new Date("2026-02-03T00:00:00Z"),
    },
    {
      id: newDomainId(),
      userId: member.id,
      teamId: personalTeam.id,
      name: "pending.admin-dashboard.test",
      status: "pending",
      dkimPrivateKey: "private",
      dkimPublicKey: "public",
      createdAt: new Date("2026-02-04T00:00:00Z"),
    },
  ]);
});

describe("admin dashboard data", () => {
  it("rejects a non-admin actor", async () => {
    await expect(loadAdminDashboard(member.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("loads every user with workspace roles and workspace domains", async () => {
    const dashboard = await loadAdminDashboard(admin.id);

    expect(dashboard.summary.users).toBeGreaterThanOrEqual(3);
    expect(dashboard.summary.admins).toBeGreaterThanOrEqual(1);
    expect(dashboard.summary.workspaces).toBeGreaterThanOrEqual(2);
    expect(dashboard.summary.domains).toBeGreaterThanOrEqual(2);
    expect(dashboard.summary.verifiedDomains).toBeGreaterThanOrEqual(1);

    const ada = dashboard.users.find((user) => user.id === member.id);
    expect(ada).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@admin-dashboard.test",
      role: "member",
      isCurrent: false,
    });
    expect(ada?.workspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: sharedTeam.id,
          name: "Shared Operators",
          role: "member",
          domains: [
            expect.objectContaining({
              name: "verified.admin-dashboard.test",
              status: "verified",
            }),
          ],
        }),
        expect.objectContaining({
          id: personalTeam.id,
          name: "Ada Personal",
          role: "owner",
          domains: [
            expect.objectContaining({
              name: "pending.admin-dashboard.test",
              status: "pending",
            }),
          ],
        }),
      ]),
    );
    expect(dashboard.users[0].id).toBe(secondMember.id);
    expect(dashboard.users.find((user) => user.id === admin.id)?.isCurrent).toBe(
      true,
    );
  });

  it("searches identity, workspace, and domain text without changing totals", async () => {
    const all = await loadAdminDashboard(admin.id);
    const byIdentity = await loadAdminDashboard(admin.id, "ADA@ADMIN");
    const byWorkspace = await loadAdminDashboard(admin.id, "ada personal");
    const byDomain = await loadAdminDashboard(
      admin.id,
      "verified.admin-dashboard.test",
    );

    expect(byIdentity.summary).toEqual(all.summary);
    expect(byIdentity.users.map((user) => user.id)).toEqual([member.id]);
    expect(byWorkspace.users.map((user) => user.id)).toEqual([member.id]);
    expect(byDomain.users.map((user) => user.id)).toEqual(
      expect.arrayContaining([admin.id, member.id, secondMember.id]),
    );
  });

  it("exposes typed operational errors", () => {
    const error = new AdminOperationError("forbidden");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("forbidden");
  });
});

describe("admin role management", () => {
  it("rejects role changes from a non-admin actor", async () => {
    await expect(
      changeUserRole(member.id, secondMember.id, "admin"),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects an invalid role without changing the target", async () => {
    await expect(
      changeUserRole(admin.id, member.id, "owner"),
    ).rejects.toMatchObject({ code: "invalid_role" });
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, member.id));
    expect(target.role).toBe("member");
  });

  it("rejects an unknown target", async () => {
    await expect(
      changeUserRole(admin.id, "usr_missing", "admin"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects changing the current administrator's own role", async () => {
    await expect(
      changeUserRole(admin.id, admin.id, "member"),
    ).rejects.toMatchObject({ code: "self_management" });
    const [actor] = await db
      .select()
      .from(users)
      .where(eq(users.id, admin.id));
    expect(actor.role).toBe("admin");
  });

  it("promotes and demotes another user", async () => {
    await expect(
      changeUserRole(admin.id, secondMember.id, "admin"),
    ).resolves.toEqual({
      userId: secondMember.id,
      role: "admin",
      changed: true,
    });
    let [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, secondMember.id));
    expect(target.role).toBe("admin");

    await expect(
      changeUserRole(admin.id, secondMember.id, "member"),
    ).resolves.toEqual({
      userId: secondMember.id,
      role: "member",
      changed: true,
    });
    [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, secondMember.id));
    expect(target.role).toBe("member");
  });

  it("reports a no-op when the requested role is already assigned", async () => {
    await expect(
      changeUserRole(admin.id, member.id, "member"),
    ).resolves.toEqual({
      userId: member.id,
      role: "member",
      changed: false,
    });
  });
});

describe("admin account deletion", () => {
  it("rejects deletion from a non-admin actor", async () => {
    await expect(deleteUser(member.id, secondMember.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("rejects deleting the current administrator", async () => {
    await expect(deleteUser(admin.id, admin.id)).rejects.toMatchObject({
      code: "self_management",
    });
    const [actor] = await db
      .select()
      .from(users)
      .where(eq(users.id, admin.id));
    expect(actor).toBeDefined();
  });

  it("rejects an unknown target", async () => {
    await expect(
      deleteUser(admin.id, "usr_missing_for_delete"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("removes the account while repairing and cleaning up its workspaces", async () => {
    const target = await registerUser(
      "delete-target@admin-dashboard.test",
      "Delete Target",
      "password123",
    );
    const oldestRemaining = await registerUser(
      "oldest-owner@admin-dashboard.test",
      "Oldest Remaining",
      "password123",
    );
    const newestRemaining = await registerUser(
      "newest-member@admin-dashboard.test",
      "Newest Remaining",
      "password123",
    );
    const shared = await createTeam("Deletion Shared", target.id);
    const personal = await createTeam("Deletion Personal", target.id);
    await db.insert(teamMembers).values([
      {
        id: newMemberId(),
        teamId: shared.id,
        userId: oldestRemaining.id,
        role: "member",
        createdAt: new Date("2026-04-01T00:00:00Z"),
      },
      {
        id: newMemberId(),
        teamId: shared.id,
        userId: newestRemaining.id,
        role: "member",
        createdAt: new Date("2026-05-01T00:00:00Z"),
      },
    ]);

    const targetSharedDomainId = newDomainId();
    const retainedSharedDomainId = newDomainId();
    const personalDomainId = newDomainId();
    await db.insert(domains).values([
      {
        id: targetSharedDomainId,
        userId: target.id,
        teamId: shared.id,
        name: "target-owned.admin-delete.test",
        dkimPrivateKey: "private",
        dkimPublicKey: "public",
        createdAt: new Date(),
      },
      {
        id: retainedSharedDomainId,
        userId: oldestRemaining.id,
        teamId: shared.id,
        name: "retained.admin-delete.test",
        status: "verified",
        dkimPrivateKey: "private",
        dkimPublicKey: "public",
        createdAt: new Date(),
      },
      {
        id: personalDomainId,
        userId: target.id,
        teamId: personal.id,
        name: "personal.admin-delete.test",
        dkimPrivateKey: "private",
        dkimPublicKey: "public",
        createdAt: new Date(),
      },
    ]);
    await db.insert(sessions).values({
      id: "admin-dashboard-delete-session",
      userId: target.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(deleteUser(admin.id, target.id)).resolves.toEqual({
      userId: target.id,
      deletedWorkspaces: 1,
      transferredWorkspaces: 1,
    });

    expect(
      await db.select().from(users).where(eq(users.id, target.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(sessions).where(eq(sessions.userId, target.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(teams).where(eq(teams.id, personal.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(domains).where(eq(domains.id, personalDomainId)),
    ).toHaveLength(0);

    expect(
      await db.select().from(teams).where(eq(teams.id, shared.id)),
    ).toHaveLength(1);
    const [newOwner] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, shared.id),
          eq(teamMembers.userId, oldestRemaining.id),
        ),
      );
    expect(newOwner.role).toBe("owner");
    expect(
      await db
        .select()
        .from(domains)
        .where(eq(domains.id, targetSharedDomainId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(domains)
        .where(eq(domains.id, retainedSharedDomainId)),
    ).toHaveLength(1);
  });

  it("removes the complete dependent resource graph on legacy schemas", async () => {
    const target = await registerUser(
      "delete-graph@admin-dashboard.test",
      "Delete Resource Graph",
      "password123",
    );
    const team = await createTeam("Deletion Resource Graph", target.id);
    const domainId = newDomainId();
    const apiKeyId = newApiKeyId();
    const emailId = newEmailId();
    const eventId = newEventId();
    const webhookId = newWebhookId();
    const deliveryId = newDeliveryId();
    const audienceId = newAudienceId();

    await db.insert(domains).values({
      id: domainId,
      userId: target.id,
      teamId: team.id,
      name: "resource-graph.admin-delete.test",
      dkimPrivateKey: "private",
      dkimPublicKey: "public",
      createdAt: new Date(),
    });
    await db.insert(apiKeys).values({
      id: apiKeyId,
      userId: target.id,
      teamId: team.id,
      name: "Resource graph key",
      tokenHash: "admin-delete-resource-graph-key",
      tokenPrefix: "st_delete_gr",
      permission: "full",
      createdAt: new Date(),
    });
    await db.insert(emails).values({
      id: emailId,
      userId: target.id,
      teamId: team.id,
      domainId,
      apiKeyId,
      from: "sender@resource-graph.admin-delete.test",
      to: ["receiver@example.com"],
      subject: "Resource graph",
      createdAt: new Date(),
    });
    await db.insert(emailEvents).values({
      id: eventId,
      emailId,
      type: "email.queued",
      createdAt: new Date(),
    });
    await db.insert(webhooks).values({
      id: webhookId,
      userId: target.id,
      teamId: team.id,
      url: "https://example.com/admin-delete-hook",
      secret: "whsec_admin_delete",
      events: ["email.queued"],
      createdAt: new Date(),
    });
    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId,
      eventId,
      createdAt: new Date(),
    });
    await db.insert(inboundEmails).values({
      id: newInboundId(),
      teamId: team.id,
      domainId,
      from: "inbound@example.com",
      to: ["hello@resource-graph.admin-delete.test"],
      subject: "Inbound resource",
      createdAt: new Date(),
    });
    await db.insert(audiences).values({
      id: audienceId,
      userId: target.id,
      teamId: team.id,
      name: "Resource graph audience",
      createdAt: new Date(),
    });
    await db.insert(contacts).values({
      id: newContactId(),
      audienceId,
      email: "contact@example.com",
      createdAt: new Date(),
    });
    await db.insert(broadcasts).values({
      id: newBroadcastId(),
      userId: target.id,
      teamId: team.id,
      audienceId,
      from: "sender@resource-graph.admin-delete.test",
      subject: "Resource graph campaign",
      createdAt: new Date(),
    });
    await db.insert(suppressions).values({
      id: newSuppressionId(),
      userId: target.id,
      teamId: team.id,
      email: "suppressed@example.com",
      reason: "manual",
      createdAt: new Date(),
    });
    await db.insert(templates).values({
      id: newTemplateId(),
      userId: target.id,
      teamId: team.id,
      name: "Resource graph template",
      subject: "Hello",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(userSettings).values({
      id: newSettingsId(),
      userId: target.id,
      teamId: team.id,
      updatedAt: new Date(),
    });

    await expect(deleteUser(admin.id, target.id)).resolves.toMatchObject({
      userId: target.id,
      deletedWorkspaces: 1,
    });

    const remnants = await Promise.all([
      db.select().from(users).where(eq(users.id, target.id)),
      db.select().from(teams).where(eq(teams.id, team.id)),
      db.select().from(domains).where(eq(domains.id, domainId)),
      db.select().from(apiKeys).where(eq(apiKeys.id, apiKeyId)),
      db.select().from(emails).where(eq(emails.id, emailId)),
      db.select().from(emailEvents).where(eq(emailEvents.id, eventId)),
      db.select().from(webhooks).where(eq(webhooks.id, webhookId)),
      db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId)),
      db.select().from(audiences).where(eq(audiences.id, audienceId)),
    ]);
    for (const rows of remnants) {
      expect(rows).toHaveLength(0);
    }
  });
});
