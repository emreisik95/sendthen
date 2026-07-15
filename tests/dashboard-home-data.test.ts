import { describe, expect, it } from "vitest";
import {
  apiKeys,
  audiences,
  broadcasts,
  db,
  domains,
  emailEvents,
  emails,
  webhooks,
} from "@/lib/db";
import { registerUser } from "@/lib/auth-user";
import {
  loadDashboardHome,
  resolveHomeReadiness,
} from "@/lib/dashboard-home-data";
import { createTeam } from "@/lib/team";
import {
  newApiKeyId,
  newAudienceId,
  newBroadcastId,
  newDomainId,
  newEmailId,
  newEventId,
  newWebhookId,
} from "@/lib/id";

describe("dashboard Home data", () => {
  it("prefers any verified domain over the newest pending domain", () => {
    expect(
      resolveHomeReadiness({
        latestDomain: { id: "dom_pending", status: "pending" },
        verifiedDomain: { id: "dom_verified" },
        activeKeys: [],
        hasSentEmail: false,
      }),
    ).toEqual({
      domain: "verified",
      domainId: "dom_verified",
      hasApiKey: false,
      hasSentEmail: false,
    });
  });

  it("does not treat a management-only API key as send-ready", () => {
    expect(
      resolveHomeReadiness({
        verifiedDomain: { id: "dom_verified" },
        activeKeys: [
          { permission: "full", scopes: ["domains.manage"] },
        ],
        hasSentEmail: false,
      }).hasApiKey,
    ).toBe(false);
  });

  it("loads operational data only for the requested team", async () => {
    const user = await registerUser(
      "home-data@sendthen.dev",
      "Home data",
      "password123",
    );
    const team = await createTeam("Home team", user.id);
    const otherTeam = await createTeam("Other Home team", user.id);
    const now = new Date();
    const earlier = new Date(now.getTime() - 60_000);
    const verifiedDomainId = newDomainId();
    const audienceId = newAudienceId();
    const otherAudienceId = newAudienceId();
    const emailId = newEmailId();
    const otherEmailId = newEmailId();

    await db.insert(domains).values([
      {
        id: verifiedDomainId,
        userId: user.id,
        teamId: team.id,
        name: "verified.home-data.test",
        status: "verified",
        dkimPrivateKey: "private",
        dkimPublicKey: "public",
        createdAt: earlier,
      },
      {
        id: newDomainId(),
        userId: user.id,
        teamId: team.id,
        name: "pending.home-data.test",
        status: "pending",
        dkimPrivateKey: "private",
        dkimPublicKey: "public",
        createdAt: now,
      },
      {
        id: newDomainId(),
        userId: user.id,
        teamId: otherTeam.id,
        name: "verified.other-home-data.test",
        status: "verified",
        dkimPrivateKey: "private",
        dkimPublicKey: "public",
        createdAt: now,
      },
    ]);
    await db.insert(apiKeys).values([
      {
        id: newApiKeyId(),
        userId: user.id,
        teamId: team.id,
        name: "Management only",
        tokenHash: "home-data-management-key",
        tokenPrefix: "st_home_data",
        permission: "full",
        scopes: ["domains.manage"],
        createdAt: now,
      },
      {
        id: newApiKeyId(),
        userId: user.id,
        teamId: otherTeam.id,
        name: "Sending",
        tokenHash: "other-home-data-sending-key",
        tokenPrefix: "st_other_ho",
        permission: "sending",
        createdAt: now,
      },
    ]);
    await db.insert(emails).values([
      {
        id: emailId,
        userId: user.id,
        teamId: team.id,
        from: "hello@verified.home-data.test",
        to: ["reader@example.com"],
        subject: "Requested team email",
        status: "delivered",
        sentAt: now,
        createdAt: now,
      },
      {
        id: otherEmailId,
        userId: user.id,
        teamId: otherTeam.id,
        from: "hello@verified.other-home-data.test",
        to: ["reader@example.com"],
        subject: "Other team email",
        status: "delivered",
        sentAt: now,
        createdAt: now,
      },
    ]);
    await db.insert(emailEvents).values({
      id: newEventId(),
      emailId: otherEmailId,
      type: "email.opened",
      createdAt: now,
    });
    await db.insert(webhooks).values([
      {
        id: newWebhookId(),
        userId: user.id,
        teamId: team.id,
        url: "https://example.com/home-hook",
        secret: "whsec_home",
        events: ["email.sent"],
        createdAt: now,
      },
      {
        id: newWebhookId(),
        userId: user.id,
        teamId: otherTeam.id,
        url: "https://example.com/other-home-hook",
        secret: "whsec_other_home",
        events: ["email.sent"],
        createdAt: now,
      },
    ]);
    await db.insert(audiences).values([
      {
        id: audienceId,
        userId: user.id,
        teamId: team.id,
        name: "Requested contacts",
        createdAt: now,
      },
      {
        id: otherAudienceId,
        userId: user.id,
        teamId: otherTeam.id,
        name: "Other contacts",
        createdAt: now,
      },
    ]);
    await db.insert(broadcasts).values([
      {
        id: newBroadcastId(),
        userId: user.id,
        teamId: team.id,
        audienceId,
        from: "hello@verified.home-data.test",
        subject: "Requested campaign",
        createdAt: now,
      },
      {
        id: newBroadcastId(),
        userId: user.id,
        teamId: otherTeam.id,
        audienceId: otherAudienceId,
        from: "hello@verified.other-home-data.test",
        subject: "Other campaign",
        createdAt: now,
      },
    ]);

    const result = await loadDashboardHome(
      team,
      new Date(now.getTime() - 14 * 24 * 60 * 60 * 1_000),
    );

    expect(result.readiness).toEqual({
      domain: "verified",
      domainId: verifiedDomainId,
      hasApiKey: false,
      hasSentEmail: true,
    });
    expect(result.activeKeyCount).toBe(1);
    expect(result.recentEmails.map(({ subject }) => subject)).toEqual([
      "Requested team email",
    ]);
    expect(result.statusRows).toEqual([{ status: "delivered", count: 1 }]);
    expect(result.openedCount).toBe(0);
    expect(result.webhookCount).toBe(1);
    expect(result.audienceCount).toBe(1);
    expect(result.campaignCount).toBe(1);
    expect(result.usage.today).toBe(1);
  });

  it.each([
    [
      "domains_team_created_idx",
      "SELECT id FROM domains WHERE team_id = ? ORDER BY created_at DESC LIMIT 1",
    ],
    [
      "api_keys_team_revoked_idx",
      "SELECT id FROM api_keys WHERE team_id = ? AND revoked_at IS NULL",
    ],
    ["webhooks_team_idx", "SELECT count(*) FROM webhooks WHERE team_id = ?"],
    ["audiences_team_idx", "SELECT count(*) FROM audiences WHERE team_id = ?"],
    [
      "broadcasts_team_idx",
      "SELECT count(*) FROM broadcasts WHERE team_id = ?",
    ],
  ])("uses the %s Home-query index", (indexName, query) => {
    const plan = db.$client
      .prepare(`EXPLAIN QUERY PLAN ${query}`)
      .all("team_for_query_plan") as { detail: string }[];
    const detail = plan.map((row) => row.detail).join("\n");

    expect(detail).toContain(indexName);
    expect(detail).not.toContain("USE TEMP B-TREE");
  });
});
