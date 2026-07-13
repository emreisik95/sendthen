import { describe, expect, it } from "vitest";
import {
  comparisonCaveat,
  comparisonDate,
  comparisonProducts,
  comparisonRows,
  featureGroups,
  forbiddenMarketingClaims,
  landingCopy,
  outcomePillars,
} from "@/lib/marketing";

describe("landing marketing model", () => {
  it("leads with ownership", () => {
    expect(landingCopy.headline).toMatch(/own/i);
    expect(landingCopy.primaryCta.href).toBe("#self-host");
  });

  it("compares only evidenced architectural properties", () => {
    expect(comparisonRows.map((row) => row.key)).toEqual([
      "selfHost",
      "openSource",
      "transportChoice",
      "localSandbox",
      "portableState",
      "softwareUsageFee",
    ]);
  });

  it("does not ship rejected claims", () => {
    const serialized = JSON.stringify({
      landingCopy,
      featureGroups,
      comparisonRows,
    }).toLowerCase();

    for (const claim of forbiddenMarketingClaims) {
      expect(serialized).not.toContain(claim);
    }
  });

  it("uses HTTPS for every official comparison source", () => {
    const sourceUrls = comparisonProducts.flatMap((product) =>
      product.sources.map((source) => source.url),
    );

    expect(sourceUrls.length).toBeGreaterThan(0);
    for (const url of sourceUrls) expect(url).toMatch(/^https:\/\//);
  });

  it("lists at least three concrete capabilities per product group", () => {
    expect(featureGroups.map((group) => group.key)).toEqual([
      "transactionalSending",
      "campaignsAndContacts",
      "inboundMail",
      "visualTemplates",
    ]);

    for (const group of featureGroups) {
      expect(group.capabilities.length).toBeGreaterThanOrEqual(3);
      for (const capability of group.capabilities) {
        expect(capability.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("provides distinct primary and secondary CTA paths", () => {
    expect(landingCopy.primaryCta.href).toBeTruthy();
    expect(landingCopy.secondaryCta.href).toBeTruthy();
    expect(landingCopy.primaryCta.href).not.toBe(
      landingCopy.secondaryCta.href,
    );
  });

  it("pins the comparison date, caveat, and three outcome pillars", () => {
    expect(comparisonDate).toBe("2026-07-13");
    expect(comparisonCaveat).toBe(
      "Self-hosting removes Sendthen software usage fees. Infrastructure and delivery-provider charges still apply.",
    );
    expect(outcomePillars).toHaveLength(3);
  });
});
