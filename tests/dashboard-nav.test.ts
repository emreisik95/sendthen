import { describe, expect, it } from "vitest";
import {
  campaignCompanionNavigation,
  configurationNavigation,
  isConfigurationNavigationActive,
  isNavigationItemActive,
  primaryNavigation,
} from "@/lib/dashboard-nav";

describe("dashboard navigation model", () => {
  it("defines exactly five primary jobs in the approved order", () => {
    expect(primaryNavigation).toEqual([
      { key: "home", label: "Home", href: "/overview" },
      { key: "activity", label: "Activity", href: "/emails" },
      { key: "campaigns", label: "Campaigns", href: "/broadcasts" },
      { key: "templates", label: "Templates", href: "/templates" },
      { key: "analytics", label: "Analytics", href: "/metrics" },
    ]);
  });

  it("defines configuration routes in the approved order", () => {
    expect(configurationNavigation).toEqual([
      { key: "domains", label: "Domains", href: "/domains" },
      { key: "apiKeys", label: "API keys", href: "/api-keys" },
      { key: "webhooks", label: "Webhooks", href: "/webhooks" },
      {
        key: "blockedRecipients",
        label: "Blocked recipients",
        href: "/suppressions",
      },
      {
        key: "deliveryAndTracking",
        label: "Delivery & tracking",
        href: "/settings",
      },
    ]);
  });

  it("keeps Contacts as the exact campaigns companion route", () => {
    expect(campaignCompanionNavigation).toEqual([
      { key: "contacts", label: "Contacts", href: "/audiences" },
    ]);
    expect(primaryNavigation).not.toContainEqual(
      expect.objectContaining({ href: "/audiences" }),
    );
  });

  it("excludes account-only routes from primary and configuration navigation", () => {
    const navigationHrefs = [
      ...primaryNavigation,
      ...configurationNavigation,
    ].map((item) => item.href);

    expect(navigationHrefs).not.toContain("/team");
    expect(navigationHrefs).not.toContain("/billing");
    expect(navigationHrefs).not.toContain("/profile");
  });

  it("keeps navigation items serializable and icon agnostic", () => {
    const navigation = [
      ...primaryNavigation,
      ...configurationNavigation,
      ...campaignCompanionNavigation,
    ];

    for (const item of navigation) {
      expect(Object.keys(item)).toEqual(["key", "label", "href"]);
    }
    expect(JSON.parse(JSON.stringify(navigation))).toEqual(navigation);
  });
});

describe("isNavigationItemActive", () => {
  it("matches the exact route", () => {
    expect(isNavigationItemActive("/emails", "/emails")).toBe(true);
  });

  it("matches a nested route", () => {
    expect(isNavigationItemActive("/emails/message-123", "/emails")).toBe(
      true,
    );
  });

  it("does not match a route that only shares a prefix", () => {
    expect(isNavigationItemActive("/emails-archive", "/emails")).toBe(false);
  });

  it("ignores query strings", () => {
    expect(isNavigationItemActive("/emails?status=sent", "/emails")).toBe(
      true,
    );
  });

  it("ignores hashes", () => {
    expect(isNavigationItemActive("/emails#delivery", "/emails")).toBe(true);
  });

  it("normalizes a trailing slash", () => {
    expect(isNavigationItemActive("/emails/", "/emails")).toBe(true);
  });

  it("does not activate navigation at the root path", () => {
    expect(isNavigationItemActive("/", "/emails")).toBe(false);
  });
});

describe("isConfigurationNavigationActive", () => {
  it("activates for an exact configuration route", () => {
    expect(isConfigurationNavigationActive("/domains")).toBe(true);
  });

  it("activates for nested configuration routes", () => {
    expect(isConfigurationNavigationActive("/domains/example.com")).toBe(
      true,
    );
    expect(isConfigurationNavigationActive("/settings/tracking")).toBe(true);
  });

  it("uses boundary-safe matching for the configuration group", () => {
    expect(isConfigurationNavigationActive("/domains-archive")).toBe(false);
    expect(isConfigurationNavigationActive("/")).toBe(false);
  });
});
