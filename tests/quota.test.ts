import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, emails, teams, users } from "@/lib/db";
import { registerUser } from "@/lib/auth-user";
import { createTeam } from "@/lib/team";
import { enforceQuota, teamUsage, PLANS } from "@/lib/quota";
import { newEmailId } from "@/lib/id";

let teamId: string;
let userId: string;

beforeAll(async () => {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, "quota@sendthen.dev"));
  const user =
    existing ?? (await registerUser("quota@sendthen.dev", "Q", "password123"));
  userId = user.id;
  const team = await createTeam("quota team", userId);
  teamId = team.id;
});

describe("plan quotas", () => {
  it("free plan blocks past the daily limit; pro overage passes", async () => {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    await expect(enforceQuota(team)).resolves.toBeUndefined();

    // fill today's allowance
    const now = new Date();
    await db.insert(emails).values(
      Array.from({ length: PLANS.free.dailyLimit }, () => ({
        id: newEmailId(),
        teamId,
        userId,
        from: "q@x.dev",
        to: ["a@b.c"],
        subject: "q",
        text: "q",
        status: "delivered" as const,
        createdAt: now,
      })),
    );

    const usage = await teamUsage(team);
    expect(usage.today).toBe(PLANS.free.dailyLimit);
    await expect(enforceQuota(team)).rejects.toMatchObject({
      code: "quota_exceeded",
      statusCode: 429,
    });

    // pro: same volume is fine (overage billed, not blocked)
    await db.update(teams).set({ plan: "pro" }).where(eq(teams.id, teamId));
    const [pro] = await db.select().from(teams).where(eq(teams.id, teamId));
    await expect(enforceQuota(pro)).resolves.toBeUndefined();
  });
});
