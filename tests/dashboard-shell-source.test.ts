import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const file = new URL(`../${relativePath}`, import.meta.url);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const shellFile = new URL(
  "../components/dashboard-shell.tsx",
  import.meta.url,
);
const shellSource = readSource("components/dashboard-shell.tsx");
const hookSource = readSource("components/use-mobile-navigation-dialog.ts");
const lifecycleSource = `${shellSource}\n${hookSource}`;
const layoutSource = readSource("app/(dash)/layout.tsx");
const uiSource = readSource("components/ui.tsx");
const navigationSource = readSource("lib/dashboard-nav.ts");

describe("dashboard shell source invariants", () => {
  it("keeps interactivity in a dedicated client boundary with serializable summaries", () => {
    expect(existsSync(shellFile), "missing DashboardShell client component").toBe(
      true,
    );
    expect(shellSource.trimStart()).toMatch(/^"use client";/);
    expect(shellSource).toContain("type DashboardShellProps");
    expect(shellSource).not.toMatch(
      /from "@\/lib\/(?:auth-user|db|onboarding|team)/,
    );

    const props = shellSource.match(
      /type DashboardShellProps\s*=\s*Readonly<\{([\s\S]*?)\n\}>;/,
    );
    expect(props, "missing explicit serializable shell props").not.toBeNull();
    expect(props?.[1]).not.toContain("Date");
  });

  it("renders the shared primary, configuration, and campaigns companion models", () => {
    for (const model of [
      "primaryNavigation",
      "configurationNavigation",
      "campaignCompanionNavigation",
    ]) {
      expect(shellSource).toContain(model);
      expect(shellSource).toMatch(new RegExp(`${model}\\.map`));
    }
    expect(shellSource).toMatch(
      /item\.key === "campaigns"[\s\S]*?campaignCompanionNavigation\.map/,
    );
    expect(shellSource).toContain('aria-current={active ? "page" : undefined}');
  });

  it("drives the Configure disclosure from the shared active helper while allowing toggles", () => {
    expect(shellSource).toContain(
      "isConfigurationNavigationActive(pathname)",
    );
    expect(shellSource).toContain("setConfigurationOpen(true)");
    expect(shellSource).toMatch(/setConfigurationOpen\([^)]*=>\s*!/);
    expect(shellSource).toContain("aria-expanded={configurationOpen}");
  });

  it("gives each responsive Configure disclosure its own relationship target", () => {
    expect(shellSource).toContain("useId");
    expect(shellSource).toContain("const configurationNavigationId = useId()");
    expect(shellSource).toContain(
      "aria-controls={configurationNavigationId}",
    );
    expect(shellSource).toContain("id={configurationNavigationId}");
  });

  it("keeps the desktop sidebar out of the mobile layout", () => {
    const desktopSidebar = shellSource.match(
      /<aside\b[^>]*className="([^"]+)"/,
    );

    expect(desktopSidebar, "missing desktop sidebar").not.toBeNull();
    const classes = desktopSidebar?.[1]?.split(/\s+/) ?? [];
    expect(classes).toContain("hidden");
    expect(classes).toContain("lg:flex");
    expect(classes).toContain("shrink-0");
  });

  it("provides a named modal mobile drawer with every close path", () => {
    expect(shellSource).toMatch(
      /<header\b[^>]*className="[^"]*sticky[^"]*lg:hidden[^"]*"/,
    );
    expect(shellSource).toContain('aria-label="Open navigation"');
    expect(shellSource).toMatch(/<dialog\b/);
    expect(shellSource).toContain("ref={dialogRef}");
    expect(lifecycleSource).toContain("dialog.showModal()");
    expect(shellSource).not.toContain('role="dialog"');
    expect(shellSource).toContain('aria-modal="true"');
    expect(shellSource).toContain('aria-label="Dashboard navigation"');
    expect(shellSource).toContain('aria-label="Close navigation"');
    expect(shellSource).toContain("onCancel={handleDialogCancel}");
    expect(lifecycleSource).toContain("event.preventDefault()");
    expect(shellSource).toContain("onClick={handleDialogBackdropClick}");
    expect(lifecycleSource).toContain("event.target === event.currentTarget");
    expect(shellSource).toContain(
      "onNavigate={closeMobileNavigationWithoutFocus}",
    );
  });

  it("moves focus into the drawer and returns it to the opener", () => {
    expect(shellSource).toContain("menuButtonRef");
    expect(shellSource).toContain("closeButtonRef");
    expect(lifecycleSource).toMatch(/closeButtonRef\.current\?\.focus\(\)/);
    expect(lifecycleSource).toContain('request.target === "opener"');
    expect(lifecycleSource).toContain("menuButtonRef.current");
    expect(lifecycleSource).toContain("target?.focus({ preventScroll: true })");
  });

  it("restores document scrolling after every modal lifecycle", () => {
    expect(lifecycleSource).toContain("const previousDocumentOverflow");
    expect(lifecycleSource).toContain("const previousBodyOverflow");
    expect(lifecycleSource).toContain(
      'document.documentElement.style.overflow = "hidden"',
    );
    expect(lifecycleSource).toContain(
      'document.body.style.overflow = "hidden"',
    );
    expect(lifecycleSource).toContain(
      "document.documentElement.style.overflow = previousDocumentOverflow",
    );
    expect(lifecycleSource).toContain(
      "document.body.style.overflow = previousBodyOverflow",
    );
  });

  it("closes without focus restoration when the desktop breakpoint matches", () => {
    expect(lifecycleSource).toContain(
      'window.matchMedia("(min-width: 1024px)")',
    );
    expect(lifecycleSource).toMatch(
      /type: "breakpoint"[\s\S]{0,100}desktop: event\.matches/,
    );
    expect(lifecycleSource).toContain(
      'mediaQuery.addEventListener("change", handleBreakpointChange)',
    );
    expect(lifecycleSource).toContain(
      'mediaQuery.removeEventListener("change", handleBreakpointChange)',
    );
    expect(lifecycleSource).toContain(
      "mediaQuery.addListener(handleBreakpointChange)",
    );
    expect(lifecycleSource).toContain(
      "mediaQuery.removeListener(handleBreakpointChange)",
    );
  });

  it("closes on pathname changes without focus restoration and resets both panels", () => {
    const shellComponent = shellSource.slice(
      shellSource.indexOf("export function DashboardShell"),
    );

    expect(shellComponent).toContain("const pathname = usePathname()");
    expect(lifecycleSource).toMatch(
      /type: "pathname"[\s\S]{0,100}pathname/,
    );
    expect(shellSource).toContain('key={`desktop-${pathname}`}');
    expect(shellSource).toContain('key={`mobile-${pathname}`}');
  });

  it("restores opener focus only for explicit user dismissals", () => {
    expect(lifecycleSource).toMatch(
      /dismissMobileNavigation[\s\S]{0,160}type: "dismiss"/,
    );
    expect(lifecycleSource).toMatch(
      /closeMobileNavigationWithoutFocus[\s\S]{0,160}type: "navigate"/,
    );
    expect(shellSource).toContain("onClick={dismissMobileNavigation}");
  });

  it("delegates lifecycle policy to a hook and invalidates stale focus frames", () => {
    expect(shellSource).toContain(
      'from "@/components/use-mobile-navigation-dialog"',
    );
    expect(shellSource).toContain("useMobileNavigationDialog({ pathname })");
    expect(hookSource.trimStart()).toMatch(/^"use client";/);
    expect(hookSource).toContain("transitionDashboardDrawer");
    expect(hookSource).toContain("pendingFocusAnimationFrameRef");
    expect(hookSource).toContain("cancelPendingFocusAnimationFrame");
    expect(hookSource).toContain("cancelAnimationFrame(");
    expect(hookSource).toContain(
      "isDashboardDrawerFocusRequestCurrent",
    );
    expect(hookSource).toMatch(
      /dialogRef\.current\?\.open[\s\S]{0,160}isDashboardDrawerFocusRequestCurrent/,
    );
    expect(hookSource).toContain('document.getElementById("main-content")');
    expect(hookSource).toContain('type: "unmount"');
  });

  it("offers a skip target and a shrinkable, responsively padded main region", () => {
    expect(shellSource).toContain('href="#main-content"');
    expect(shellSource).toMatch(/<main\b[^>]*id="main-content"/);

    const main = shellSource.match(/<main\b[^>]*className="([^"]+)"/);
    expect(main, "missing dashboard main landmark").not.toBeNull();
    const classes = main?.[1]?.split(/\s+/) ?? [];
    for (const utility of [
      "min-w-0",
      "px-4",
      "py-6",
      "sm:px-6",
      "lg:px-8",
      "lg:py-8",
    ]) {
      expect(classes).toContain(utility);
    }
  });

  it("keeps workspace, account, billing, and resource destinations outside primary navigation", () => {
    for (const href of ["/team", "/profile", "/billing", "/docs"]) {
      expect(shellSource).toContain(`href="${href}"`);
    }
    expect(shellSource).toContain(
      'href="https://github.com/emreisik95/sendthen"',
    );
    expect(shellSource).toContain("action={switchTeamAction}");
    expect(shellSource).toContain("action={logoutAction}");
    expect(shellSource).toContain("Manage workspace & members");
    expect(shellSource).not.toContain('href="/settings"');
  });

  it("bases setup completion on a verified domain, key, and first sent email", () => {
    for (const field of [
      "setup.domainVerified",
      "setup.hasApiKey",
      "setup.hasSentEmail",
    ]) {
      expect(shellSource).toContain(field);
    }
    expect(shellSource).not.toContain("setup.hasDomain");
    expect(shellSource).not.toContain("setup.stepsDone");
    expect(shellSource).toMatch(/setupSteps\.every\(/);
    expect(shellSource).toContain("Verified domain");
    expect(shellSource).toContain("API key");
    expect(shellSource).toContain("First sent email");
    expect(shellSource).toContain("Continue setup");
    expect(shellSource).toContain('name="to" value="/overview"');
  });

  it("keeps the setup dismiss target at least forty pixels square", () => {
    const dismissButton = shellSource.match(
      /aria-label="Dismiss setup card"[\s\S]*?className="([^"]+)"/,
    );

    expect(dismissButton, "missing setup dismiss control").not.toBeNull();
    const classes = dismissButton?.[1]?.split(/\s+/) ?? [];
    expect(classes.some((name) => name === "h-10" || name === "min-h-10")).toBe(
      true,
    );
    expect(classes.some((name) => name === "w-10" || name === "min-w-10")).toBe(
      true,
    );
  });

  it("does not add broad transitions to the dashboard shell", () => {
    expect(shellSource).not.toContain("transition-all");
  });

  it("does not put accessible names on generic elements without roles", () => {
    const invalidLabels =
      shellSource.match(
        /<(?:div|span)\b(?=[^>]*\baria-label=)(?![^>]*\brole=)[^>]*>/g,
      ) ?? [];

    expect(invalidLabels).toEqual([]);
  });
});

describe("dashboard server layout source invariants", () => {
  it("keeps authentication, team, membership, and setup reads on the server", () => {
    for (const call of [
      "requireUser()",
      "getActiveTeam(user)",
      "membershipsOf(user.id)",
      "onboardingProgress(team)",
    ]) {
      expect(layoutSource).toContain(call);
    }
    expect(layoutSource).toContain("<DashboardShell");
    expect(layoutSource).not.toMatch(/const\s+NAV\s*=/);
    expect(layoutSource).not.toContain("@/components/nav-icons");
  });

  it("passes only plain shell summaries and preserves verified setup truth", () => {
    expect(layoutSource).toContain("userSummary");
    expect(layoutSource).toContain("teamSummary");
    expect(layoutSource).toContain("membershipSummaries");
    expect(layoutSource).toContain("setupSummary");
    expect(layoutSource).toContain("domainVerified: setup.domainVerified");
    expect(layoutSource).not.toContain("hasDomain: setup.hasDomain");
  });
});

describe("responsive shared UI source invariants", () => {
  it("stacks PageHeader on narrow screens and wraps its actions", () => {
    expect(uiSource).toMatch(
      /mb-6 flex flex-col items-start[^"]*sm:flex-row[^"]*sm:items-center/,
    );
    expect(uiSource).toMatch(/flex[^"]*flex-wrap[^"]*sm:w-auto/);
  });

  it("keeps shared button controls at least forty pixels tall", () => {
    for (const name of ["btnPrimary", "btnSecondary", "btnDanger"]) {
      const classes = uiSource.match(
        new RegExp(`export const ${name}\\s*=\\s*\\n?\\s*"([^"]+)"`),
      );
      expect(classes, `missing ${name}`).not.toBeNull();
      expect(classes?.[1]?.split(/\s+/)).toContain("min-h-10");
    }
  });
});

describe("dashboard navigation typing", () => {
  it("restricts active matching hrefs to dashboard navigation hrefs", () => {
    expect(navigationSource).toMatch(
      /href:\s*DashboardNavigationItem\["href"\]/,
    );
  });
});
