import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatHomePercentage,
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
