import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const landingSource = readSource("app/page.tsx");

describe("redesign UI review invariants", () => {
  it("renders the shared primary navigation in a compact mobile scroller", () => {
    expect(landingSource.match(/primaryNavigation\.map/g)).toHaveLength(2);

    const mobileNavigation = landingSource.match(
      /<ul\s+className="([^"]+)"\s+aria-label="Primary links"\s*>([\s\S]*?)<\/ul>/,
    );

    expect(
      mobileNavigation,
      "missing labelled mobile primary navigation",
    ).not.toBeNull();

    const classes = mobileNavigation?.[1]?.split(/\s+/) ?? [];
    expect(classes).toContain("lg:hidden");
    expect(classes).toContain("basis-full");
    expect(classes).toContain("overflow-x-auto");
    expect(mobileNavigation?.[2]).toContain("primaryNavigation.map");
    expect(mobileNavigation?.[2]).toMatch(/className="[^"]*min-h-11[^"]*"/);
  });

  it.each([
    ["app/(dash)/broadcasts/page.tsx", "Campaigns", 1],
    ["app/(dash)/audiences/page.tsx", "Contacts", 1],
    ["app/(dash)/metrics/page.tsx", "Analytics", 2],
    ["app/(dash)/suppressions/page.tsx", "Blocked recipients", 1],
    ["components/settings/settings-form.tsx", "Delivery & tracking", 1],
  ])(
    "uses %s's current destination heading",
    (relativePath, heading, expectedCount) => {
      const source = readSource(relativePath);
      const headingPattern = new RegExp(
        `<PageHeader title="${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
        "g",
      );

      expect(source.match(headingPattern)).toHaveLength(expectedCount);
    },
  );

  it.each([
    [
      "app/(dash)/broadcasts/page.tsx",
      ["Campaigns need someone to talk to.", "New campaign", "All campaigns"],
    ],
    [
      "app/(dash)/audiences/page.tsx",
      ["Create contact list", "No contact lists yet.", "How contact lists work"],
    ],
    [
      "app/(dash)/metrics/page.tsx",
      ["Top campaigns", "No campaign sends in range."],
    ],
    [
      "app/(dash)/suppressions/page.tsx",
      ["Block recipient", "No blocked recipients", "Blocked recipients guide"],
    ],
  ])("keeps %s body copy aligned with its destination", (relativePath, copy) => {
    const source = readSource(relativePath);

    for (const text of copy) expect(source).toContain(text);
  });
});
