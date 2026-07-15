import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const marketingTestSource = readFileSync(
  new URL("./marketing.test.ts", import.meta.url),
  "utf8",
);

const userFacingMarketingExports = [
  "landingCtaPaths",
  "socialPreviewImage",
  "primaryNavigation",
  "proofStages",
  "quickstartLines",
  "operationsNote",
  "landingCopy",
  "outcomePillars",
  "featureGroups",
  "comparisonDate",
  "comparisonProducts",
  "comparisonRows",
  "comparisonCaveat",
  "comparisonMethodology",
] as const;

describe("landing source invariants", () => {
  it("keeps Sign in discoverable below the sm breakpoint", () => {
    const signIn = pageSource.match(
      /<Link\s+className="([^"]+)"\s+href="\/login"/,
    );

    expect(signIn, "missing /login navigation control").not.toBeNull();
    const classes = signIn?.[1]?.split(/\s+/) ?? [];
    expect(classes).toContain("inline-flex");
    expect(classes).not.toContain("hidden");
  });

  it("gives the focusable comparison scroller an inset focus ring", () => {
    const focusRule = cssSource.match(
      /\.landing-table-scroll:focus-visible\s*\{([^}]*)\}/,
    );

    expect(focusRule, "missing local scroller focus treatment").not.toBeNull();
    expect(focusRule?.[1]).toMatch(/(?:box-shadow|outline)[^;]*inset|outline-offset:\s*-/);
  });

  it("declares a dark native-control scheme and intentional touch behavior", () => {
    expect(cssSource).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark/);
    expect(cssSource).toMatch(
      /(?:a|button|summary)[^{]*\{[^}]*touch-action:\s*manipulation/,
    );
    expect(cssSource).toContain("-webkit-tap-highlight-color");
  });

  it("reveals the skip link for visible keyboard focus", () => {
    expect(cssSource).toContain(".landing-skip-link:focus-visible");
    expect(cssSource).not.toMatch(/\.landing-skip-link:focus\s*\{/);
    expect(pageSource).toMatch(
      /<main\s+id="main-content"\s+tabIndex=\{-1\}/,
    );
    expect(cssSource).toContain("env(safe-area-inset-left)");
    expect(cssSource).toContain("env(safe-area-inset-right)");
  });

  it("keeps the forbidden-claim guard wired to every marketing surface", () => {
    const scanContract = marketingTestSource.match(
      /const userFacingMarketingContent = \{([\s\S]*?)\n\};/,
    );

    expect(scanContract, "missing complete marketing scan object").not.toBeNull();
    const scanBody = scanContract?.[1] ?? "";
    for (const exportName of userFacingMarketingExports) {
      expect(scanBody).toContain(exportName);
    }
    expect(marketingTestSource).toContain(
      'new URL("../app/page.tsx", import.meta.url)',
    );
    expect(marketingTestSource).toContain(
      'new URL("../app/layout.tsx", import.meta.url)',
    );
  });

  it("does not change document scrolling for authenticated routes", () => {
    expect(cssSource).not.toMatch(/html\s*\{[^}]*scroll-behavior:\s*smooth/);
  });

  it("does not add broad transitions to the redesigned landing", () => {
    expect(pageSource).not.toContain("transition-all");
    expect(cssSource).not.toMatch(/transition:\s*all\b/);
  });

  it("does not put accessible names on generic div or span elements", () => {
    const invalidLabels =
      pageSource.match(
        /<(?:div|span)\b(?=[^>]*\baria-(?:label|labelledby)=)(?![^>]*\brole=)[^>]*>/g,
      ) ?? [];

    expect(invalidLabels).toEqual([]);
  });

  it("keeps visible landing text at or above twelve pixels", () => {
    const utilitySizes = [...pageSource.matchAll(/text-\[([^\]]+)\]/g)].flatMap(
      (match) =>
        [...(match[1] ?? "").matchAll(/(\d*\.?\d+)rem/g)].map((size) => ({
          source: match[0],
          rem: Number(size[1]),
        })),
    );
    const cssSizes = [...cssSource.matchAll(/font-size:\s*(\d*\.?\d+)rem/g)].map(
      (match) => ({
        source: match[0],
        rem: Number(match[1]),
      }),
    );
    const pixelUtilities = [
      ...pageSource.matchAll(/text-\[(\d*\.?\d+)px\]/g),
    ].map((match) => ({ source: match[0], pixels: Number(match[1]) }));

    expect(
      [...utilitySizes, ...cssSizes]
        .filter(({ rem }) => rem < 0.75)
        .map(({ source }) => source),
    ).toEqual([]);
    expect(
      pixelUtilities
        .filter(({ pixels }) => pixels < 12)
        .map(({ source }) => source),
    ).toEqual([]);
  });

  it("keeps official comparison sources visibly underlined", () => {
    const sourceLink = pageSource.match(
      /<a className="([^"]+)" href=\{source\.url\}/,
    );

    expect(sourceLink, "missing comparison source link").not.toBeNull();
    expect(sourceLink?.[1]?.split(/\s+/)).toContain("underline");
  });
});
