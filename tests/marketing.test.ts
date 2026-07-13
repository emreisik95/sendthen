import { describe, expect, it } from "vitest";
import {
  comparisonCaveat,
  comparisonDate,
  comparisonProducts,
  comparisonRows,
  featureGroups,
  forbiddenMarketingClaims,
  landingCtaPaths,
  landingCopy,
  outcomePillars,
} from "@/lib/marketing";

const requiredForbiddenClaims = [
  "inbox confirmed",
  "better deliverability",
  "zero vendors",
  "unlimited everything",
  "drop-in replacement",
] as const;

const officialProductHosts = {
  sendthen: ["github.com", "sendthen.net"],
  resend: ["resend.com"],
  postmark: ["postmarkapp.com"],
  sendGrid: ["twilio.com"],
  mailgun: ["mailgun.com"],
} as const;

function isSameOrSubdomain(hostname: string, rootHost: string): boolean {
  return hostname === rootHost || hostname.endsWith(`.${rootHost}`);
}

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
    expect(forbiddenMarketingClaims).toEqual(requiredForbiddenClaims);

    const serialized = JSON.stringify({
      landingCtaPaths,
      landingCopy,
      outcomePillars,
      featureGroups,
      comparisonProducts,
      comparisonRows,
      comparisonCaveat,
    }).toLowerCase();

    for (const claim of requiredForbiddenClaims) {
      expect(serialized).not.toContain(claim);
    }
  });

  it("pins the five named comparison products", () => {
    expect(
      comparisonProducts.map(({ key, name }) => ({ key, name })),
    ).toEqual([
      { key: "sendthen", name: "Sendthen" },
      { key: "resend", name: "Resend" },
      { key: "postmark", name: "Postmark" },
      { key: "sendGrid", name: "SendGrid" },
      { key: "mailgun", name: "Mailgun" },
    ]);
  });

  it("uses HTTPS official sources for every comparison product", () => {
    for (const product of comparisonProducts) {
      expect(product.sources.length).toBeGreaterThan(0);

      for (const source of product.sources) {
        const url = new URL(source.url);
        expect(url.protocol).toBe("https:");
        expect(
          officialProductHosts[product.key].some((rootHost) =>
            isSameOrSubdomain(url.hostname, rootHost),
          ),
        ).toBe(true);
      }
    }
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
  });

  it("defines three distinct, concrete outcome pillars", () => {
    expect(outcomePillars.map((pillar) => pillar.key)).toEqual([
      "controlPlane",
      "transportFreedom",
      "fullEmailLoop",
    ]);

    const titles = outcomePillars.map((pillar) => pillar.title.trim());
    const descriptions = outcomePillars.map((pillar) =>
      pillar.description.trim(),
    );

    for (const title of titles) expect(title).not.toBe("");
    for (const description of descriptions) expect(description).not.toBe("");
    expect(new Set(titles).size).toBe(outcomePillars.length);
    expect(new Set(descriptions).size).toBe(outcomePillars.length);
  });
});
