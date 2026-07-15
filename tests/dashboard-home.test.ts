import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildHomeDailySeries,
  compareHomeWindows,
  formatHomeChange,
  formatHomePercentage,
  homeAttentionItems,
  homeReadinessSteps,
  nextHomeAction,
  summarizeHomeStatuses,
} from "@/lib/dashboard-home";

describe("dashboard Home readiness", () => {
  it.each([
    [
      { domain: "missing", hasApiKey: false, hasSentEmail: false },
      "add-domain",
    ],
    [
      { domain: "pending", hasApiKey: false, hasSentEmail: false },
      "verify-domain",
    ],
    [
      { domain: "failed", hasApiKey: true, hasSentEmail: true },
      "verify-domain",
    ],
    [
      { domain: "verified", hasApiKey: false, hasSentEmail: false },
      "create-key",
    ],
    [
      { domain: "verified", hasApiKey: true, hasSentEmail: false },
      "send-first-email",
    ],
    [
      { domain: "verified", hasApiKey: true, hasSentEmail: true },
      "ready",
    ],
  ] as const)("selects %s before later work", (readiness, expectedKey) => {
    expect(nextHomeAction(readiness).key).toBe(expectedKey);
  });

  it("links every action to a real destination", () => {
    expect(
      nextHomeAction({
        domain: "pending",
        domainId: "domain_123",
        hasApiKey: false,
        hasSentEmail: false,
      }).href,
    ).toBe("/domains/domain_123");
    expect(
      nextHomeAction({
        domain: "verified",
        hasApiKey: false,
        hasSentEmail: false,
      }).href,
    ).toBe("/api-keys");
    expect(
      nextHomeAction({
        domain: "verified",
        hasApiKey: true,
        hasSentEmail: false,
      }).href,
    ).toBe("/docs#emails");
  });

  it("keeps adding and verifying a domain as separate checklist steps", () => {
    const steps = homeReadinessSteps({
      domain: "pending",
      domainId: "domain_123",
      hasApiKey: true,
      hasSentEmail: false,
    });

    expect(steps).toHaveLength(4);
    expect(steps.map(({ key }) => key)).toEqual([
      "add-domain",
      "verify-domain",
      "create-key",
      "send-first-email",
    ]);
    expect(steps.map(({ complete }) => complete)).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(steps[1]?.href).toBe("/domains/domain_123");
  });
});

describe("dashboard Home delivery metrics", () => {
  it("groups final delivery states without describing queued work as sent", () => {
    expect(
      summarizeHomeStatuses([
        { status: "queued", count: 3 },
        { status: "sending", count: 2 },
        { status: "sent", count: 5 },
        { status: "delivered", count: 7 },
        { status: "bounced", count: 2 },
        { status: "failed", count: 4 },
        { status: "canceled", count: 1 },
      ]),
    ).toEqual({
      sent: 14,
      delivered: 7,
      bouncedOrFailed: 6,
    });
  });

  it("formats an unavailable ratio as an em dash", () => {
    expect(formatHomePercentage(0, 0)).toBe("—");
    expect(formatHomePercentage(1, 3)).toBe("33%");
    expect(formatHomePercentage(3, 2)).toBe("100%");
  });

  it("fills a stable daily series and ignores malformed rows", () => {
    const end = new Date(2026, 6, 15, 12);
    const series = buildHomeDailySeries(
      [
        { day: "2026-07-14", status: "delivered", count: 3 },
        { day: "2026-07-14", status: "bounced", count: 1 },
        { day: "2026-07-15", status: "failed", count: 2 },
        { day: "not-a-day", status: "delivered", count: 99 },
        { day: "2026-07-15", status: "delivered", count: -4 },
      ],
      [{ day: "2026-07-14", count: 2 }],
      end,
      3,
    );

    expect(series.map(({ day }) => day)).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
    ]);
    expect(series[0]).toMatchObject({ sent: 0, delivered: 0, opened: 0, issues: 0 });
    expect(series[1]).toMatchObject({ sent: 4, delivered: 3, opened: 2, issues: 1 });
    expect(series[2]).toMatchObject({ sent: 0, delivered: 0, opened: 0, issues: 2 });
  });

  it("compares the latest seven days with the prior seven", () => {
    const series = buildHomeDailySeries(
      [
        { day: "2026-07-02", status: "delivered", count: 4 },
        { day: "2026-07-10", status: "delivered", count: 8 },
        { day: "2026-07-10", status: "bounced", count: 2 },
      ],
      [
        { day: "2026-07-02", count: 1 },
        { day: "2026-07-10", count: 5 },
      ],
      new Date(2026, 6, 15, 12),
      14,
    );

    expect(compareHomeWindows(series)).toEqual({
      current: { sent: 10, delivered: 8, opened: 5, issues: 2 },
      previous: { sent: 4, delivered: 4, opened: 1, issues: 0 },
    });
  });

  it("describes changes without inventing a zero baseline percentage", () => {
    expect(formatHomeChange(0, 0)).toBe("No activity yet");
    expect(formatHomeChange(5, 0)).toBe("New this week");
    expect(formatHomeChange(10, 8)).toBe("+25% vs prior 7d");
    expect(formatHomeChange(4, 8)).toBe("−50% vs prior 7d");
  });

  it("surfaces blockers and delivery risk without making webhooks required", () => {
    expect(
      homeAttentionItems({
        readiness: {
          domain: "verified",
          hasApiKey: true,
          hasSentEmail: true,
        },
        bouncedOrFailed: 2,
        todayUsage: 81,
        dailyLimit: 100,
        webhookCount: 0,
      }),
    ).toEqual([
      expect.objectContaining({ key: "delivery-issues", tone: "danger" }),
      expect.objectContaining({ key: "daily-limit", tone: "warning" }),
    ]);
  });
});

describe("dashboard Home server page", () => {
  const source = readFileSync(
    new URL("../app/(dash)/overview/page.tsx", import.meta.url),
    "utf8",
  );
  const dataSource = readFileSync(
    new URL("../lib/dashboard-home-data.ts", import.meta.url),
    "utf8",
  );

  it("loads bounded operational data instead of rebuilding Analytics", () => {
    expect(source).toContain("nextHomeAction");
    expect(source).toContain("homeReadinessSteps");
    expect(source).toContain("loadDashboardHome(team, since)");
    expect(source).toContain("requireUser()");
    expect(source).toContain("getActiveTeam(user)");
    expect(dataSource).toContain("teamUsage(team)");
    expect(dataSource).toContain("countDistinct(emailEvents.emailId)");
    expect(dataSource).toContain(".groupBy(emails.status)");
    expect(dataSource).toMatch(
      /orderBy\(desc\(emails\.createdAt\)\)[\s\S]{0,120}\.limit\(5\)/,
    );
    expect(source).not.toContain("Daily volume");
    expect(source).not.toContain("maxTotal");
  });

  it("answers readiness, metrics, recent activity, and next destinations", () => {
    for (const text of [
      'title="Home"',
      "Setup checklist",
      "Last 14 days",
      "Recent activity",
      "Shortcuts",
      "Bounced / failed",
      "No email activity yet",
    ]) {
      expect(source).toContain(text);
    }

    for (const href of [
      "/emails",
      "/emails/inbound",
      "/audiences",
      "/domains",
    ]) {
      expect(source).toContain(`href=\"${href}\"`);
    }
  });

  it("keeps quota labels on the essential muted contrast token", () => {
    expect(source).toMatch(
      /<dt className="text-fg-muted">Today<\/dt>/,
    );
    expect(source).toMatch(
      /<dt className="text-fg-muted">This month<\/dt>/,
    );
  });
});
