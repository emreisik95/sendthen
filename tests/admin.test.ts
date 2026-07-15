import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  domains,
  teamMembers,
  users,
  type Team,
  type User,
} from "@/lib/db";
import { registerUser } from "@/lib/auth-user";
import { createTeam } from "@/lib/team";
import { newDomainId, newMemberId } from "@/lib/id";
import {
  AdminOperationError,
  changeUserRole,
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
