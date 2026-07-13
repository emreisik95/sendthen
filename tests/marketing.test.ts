import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  comparisonCaveat,
  comparisonDate,
  comparisonMethodology,
  comparisonProducts,
  comparisonRows,
  featureGroups,
  forbiddenMarketingClaims,
  landingCtaPaths,
  landingCopy,
  operationsNote,
  outcomePillars,
  primaryNavigation,
  proofStages,
  quickstartLines,
  socialPreviewImage,
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

const userFacingMarketingContent = {
  landingCtaPaths,
  socialPreviewImage,
  primaryNavigation,
  proofStages,
  quickstartLines,
  operationsNote,
  landingCopy,
  outcomePillars,
  featureGroups,
  comparisonDate,
  comparisonProducts,
  comparisonRows,
  comparisonCaveat,
  comparisonMethodology,
};

const userFacingSourceFiles = [
  {
    path: "app/page.tsx",
    source: readFileSync(
      new URL("../app/page.tsx", import.meta.url),
      "utf8",
    ),
  },
  {
    path: "app/layout.tsx",
    source: readFileSync(
      new URL("../app/layout.tsx", import.meta.url),
      "utf8",
    ),
  },
] as const;

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

    const serialized = JSON.stringify(userFacingMarketingContent).toLowerCase();

    for (const claim of requiredForbiddenClaims) {
      expect(serialized).not.toContain(claim);
      for (const { path, source } of userFacingSourceFiles) {
        expect(source.toLowerCase(), `${path} contains ${claim}`).not.toContain(
          claim,
        );
      }
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

  it("orders the product proof stages from request through events", () => {
    expect(proofStages.map((stage) => stage.key)).toEqual([
      "request",
      "queue",
      "dkim",
      "transport",
      "events",
    ]);
  });

  it("provides a three-line local quickstart", () => {
    expect(quickstartLines).toHaveLength(3);
    expect(quickstartLines.some((line) => /git clone/i.test(line))).toBe(true);
    expect(quickstartLines).toContain("docker compose up -d");
    expect(quickstartLines.some((line) => /localhost/i.test(line))).toBe(true);
  });

  it("states self-hosting and transport cost responsibilities", () => {
    expect(operationsNote).toMatch(/infrastructure|hosting/i);
    expect(operationsNote).toMatch(/responsib|operate|manage/i);
    expect(operationsNote).toMatch(/transport|delivery/i);
    expect(operationsNote).toMatch(/cost|charge/i);
  });

  it("provides primary anchors for Product and Compare", () => {
    expect(primaryNavigation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Product", href: "#product" }),
        expect.objectContaining({ label: "Compare", href: "#compare" }),
      ]),
    );
  });

  it("describes Sendthen state as a portable data volume", () => {
    const stateRow = comparisonRows.find((row) => row.key === "portableState");

    expect(stateRow?.values.sendthen).toBe("Portable /data volume");
  });

  it("links Resend's official test-address documentation", () => {
    const resend = comparisonProducts.find((product) => product.key === "resend");

    expect(resend?.sources.map((source) => source.url)).toContain(
      "https://resend.com/docs/knowledge-base/what-email-addresses-to-use-for-testing",
    );
  });

  it("qualifies the comparison methodology", () => {
    expect(comparisonMethodology).toMatch(/managed-service cells/i);
    expect(comparisonMethodology).toMatch(/publicly documented offerings/i);
    expect(comparisonMethodology).toContain(comparisonDate);
    expect(comparisonMethodology).toMatch(/undocumented|private options/i);
  });

  it("limits provider charges to selected provider transports", () => {
    expect(operationsNote).toMatch(/when.*provider.*selected/i);
  });

  it("defines an ownership-focused social preview image", () => {
    expect(socialPreviewImage.url).toBe("/og.png");
    expect(socialPreviewImage.alt.trim()).not.toBe("");
    expect(socialPreviewImage.alt).toMatch(/own/i);
  });
});
