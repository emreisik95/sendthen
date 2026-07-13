# Landing and Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Sendthen’s landing page around its ownership advantage and replace the dashboard’s flat navigation and analytics-first overview with a clear, responsive operational Home.

**Architecture:** Keep the landing and authenticated data loading server-rendered. Extract truthful marketing facts, navigation matching, and Home readiness selection into pure modules so behavior is testable; add one small client dashboard shell for pathname-aware navigation and the mobile drawer. Preserve every route, API, database query, and sending workflow.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Drizzle/SQLite, Vitest.

### Task 1: Lock truthful marketing and comparison content

**Files:**
- Create: `lib/marketing.ts`
- Create: `tests/marketing.test.ts`

**Step 1: Write the failing tests**

Add tests that require:

```ts
import {
  comparisonRows,
  featureGroups,
  forbiddenMarketingClaims,
  landingCopy,
} from "@/lib/marketing";

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
  const serialized = JSON.stringify({ landingCopy, featureGroups, comparisonRows }).toLowerCase();
  for (const claim of forbiddenMarketingClaims) expect(serialized).not.toContain(claim);
});
```

**Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/marketing.test.ts`

Expected: FAIL because `@/lib/marketing` does not exist.

**Step 3: Implement the marketing data**

Create typed constants for the hero, four product groups, three outcome pillars, and comparison rows dated `2026-07-13`. Competitor values are limited to `Yes`, `No`, `Managed only`, or short architecture labels. Include official comparison source URLs and this footnote:

```ts
"Self-hosting removes Sendthen software usage fees. Infrastructure and delivery-provider charges still apply."
```

The forbidden phrases are `inbox confirmed`, `better deliverability`, `zero vendors`, `unlimited everything`, and `drop-in replacement`.

**Step 4: Run the focused test**

Run: `pnpm vitest run tests/marketing.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/marketing.ts tests/marketing.test.ts
git commit -m "test: lock truthful landing claims"
```

### Task 2: Rebuild the landing page from scratch

**Files:**
- Replace: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Test: `tests/marketing.test.ts`

**Step 1: Add failing content-coverage assertions**

Require every comparison source to use HTTPS, every product group to have at least three concrete capabilities, and both CTA paths to exist.

**Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/marketing.test.ts`

Expected: FAIL on missing coverage fields until the marketing model is completed.

**Step 3: Implement the page**

Replace the existing 418-line page with these sections:

- sticky translucent navigation;
- ownership-led split hero;
- CSS/HTML request-to-event pipeline proof;
- three outcome pillars;
- four product surfaces;
- dated named comparison table for Sendthen, Resend, Postmark, SendGrid, and Mailgun;
- `#self-host` Docker quickstart and operations note;
- hosted/self-hosted choice;
- final CTA and footer.

Use semantic headings, lists, tables, `aria-label` where required, and ordinary links. Do not import the old `DeliveryTrace` or `CodeTabs`. Add scoped landing utility classes and keyframes to `app/globals.css`; avoid `transition-all` and ensure every animation has a reduced-motion fallback. Update metadata copy and Open Graph alt text in `app/layout.tsx` to the ownership promise.

**Step 4: Run focused and static checks**

Run: `pnpm vitest run tests/marketing.test.ts`

Run: `pnpm exec tsc --noEmit`

Expected: both PASS.

**Step 5: Commit**

```bash
git add app/page.tsx app/globals.css app/layout.tsx lib/marketing.ts tests/marketing.test.ts
git commit -m "feat: rebuild ownership-led landing page"
```

### Task 3: Define and test the simplified dashboard navigation

**Files:**
- Create: `lib/dashboard-nav.ts`
- Create: `tests/dashboard-nav.test.ts`

**Step 1: Write failing tests**

Test that primary navigation contains exactly Home, Activity, Campaigns, Templates, and Analytics; configuration contains Domains, API keys, Webhooks, Blocked recipients, and Delivery & tracking; account-only routes do not appear in either list; and nested routes activate their parent.

```ts
expect(primaryNavigation.map((item) => item.label)).toEqual([
  "Home",
  "Activity",
  "Campaigns",
  "Templates",
  "Analytics",
]);
expect(isNavigationItemActive("/emails/inbound/abc", "/emails")).toBe(true);
expect(isNavigationItemActive("/emails-archive", "/emails")).toBe(false);
```

**Step 2: Run and verify failure**

Run: `pnpm vitest run tests/dashboard-nav.test.ts`

Expected: FAIL because the module does not exist.

**Step 3: Implement the pure navigation model**

Export serializable navigation items and a boundary-aware active matcher:

```ts
export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

Include Contacts as a companion link under Campaigns in the shell, not a sixth primary item.

**Step 4: Run and verify pass**

Run: `pnpm vitest run tests/dashboard-nav.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/dashboard-nav.ts tests/dashboard-nav.test.ts
git commit -m "test: define simplified dashboard navigation"
```

### Task 4: Build the responsive dashboard shell

**Files:**
- Create: `components/dashboard-shell.tsx`
- Modify: `app/(dash)/layout.tsx`
- Modify: `components/ui.tsx`
- Modify: `app/globals.css`
- Test: `tests/dashboard-nav.test.ts`

**Step 1: Add a failing active-state edge-case test**

Require `/overview?range=14d` after pathname normalization to match Home and require `/` not to match any dashboard item.

**Step 2: Run and verify failure**

Run: `pnpm vitest run tests/dashboard-nav.test.ts`

Expected: FAIL until normalization is implemented.

**Step 3: Implement the shell**

Create a `"use client"` shell using `usePathname`, `useState`, and `useEffect`. It must:

- render the five primary links and a visibly secondary Configure group;
- show active styles and `aria-current="page"`;
- keep workspace and profile menus;
- render a desktop sidebar only at `lg` and above;
- render a mobile top bar and modal-like drawer below `lg`;
- close on navigation, close button, backdrop click, and Escape;
- lock no content behind the drawer and retain a visible skip link;
- label navigation and buttons accessibly.

Keep `requireUser`, `getActiveTeam`, memberships, and onboarding queries in the async server layout and pass only plain values into the shell. Update `PageHeader` to stack on small screens and give controls at least 40px touch height where it does not distort tables.

**Step 4: Run tests and typecheck**

Run: `pnpm vitest run tests/dashboard-nav.test.ts`

Run: `pnpm exec tsc --noEmit`

Expected: both PASS.

**Step 5: Commit**

```bash
git add components/dashboard-shell.tsx app/'(dash)'/layout.tsx components/ui.tsx app/globals.css lib/dashboard-nav.ts tests/dashboard-nav.test.ts
git commit -m "feat: simplify responsive dashboard navigation"
```

### Task 5: Replace Overview with operational Home

**Files:**
- Create: `lib/dashboard-home.ts`
- Create: `tests/dashboard-home.test.ts`
- Replace: `app/(dash)/overview/page.tsx`

**Step 1: Write failing readiness tests**

Cover these priorities:

```ts
expect(nextHomeAction({ domain: "missing", hasApiKey: false, hasSentEmail: false }).key).toBe("add-domain");
expect(nextHomeAction({ domain: "pending", hasApiKey: false, hasSentEmail: false }).key).toBe("verify-domain");
expect(nextHomeAction({ domain: "verified", hasApiKey: false, hasSentEmail: false }).key).toBe("create-key");
expect(nextHomeAction({ domain: "verified", hasApiKey: true, hasSentEmail: false }).key).toBe("send-first-email");
expect(nextHomeAction({ domain: "verified", hasApiKey: true, hasSentEmail: true }).key).toBe("ready");
```

Also test status grouping and percentage formatting with a zero denominator.

**Step 2: Run and verify failure**

Run: `pnpm vitest run tests/dashboard-home.test.ts`

Expected: FAIL because the helper does not exist.

**Step 3: Implement pure Home helpers**

Export `nextHomeAction`, status grouping, and safe percentage formatting. Keep user-facing text plain and action links real.

**Step 4: Implement the server page**

Query bounded data for the latest domain, active key count, 14-day outbound statuses, recent five emails, and quota usage. Render:

- “Ready to send” or one specific setup warning with one primary action;
- a four-step readiness checklist;
- four metrics: sent, delivered, opened, and bounced/failed;
- recent activity with recipient, subject, status, and date;
- shortcuts to send history, received mail, contacts, and configuration.

Do not duplicate the daily chart; Analytics owns charts.

**Step 5: Run focused tests and typecheck**

Run: `pnpm vitest run tests/dashboard-home.test.ts`

Run: `pnpm exec tsc --noEmit`

Expected: both PASS.

**Step 6: Commit**

```bash
git add lib/dashboard-home.ts tests/dashboard-home.test.ts app/'(dash)'/overview/page.tsx
git commit -m "feat: turn overview into operational home"
```

### Task 6: Accessibility and copy consistency pass

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/ui.tsx`
- Modify: any redesigned file containing inconsistent labels
- Test: `tests/marketing.test.ts`
- Test: `tests/dashboard-nav.test.ts`

**Step 1: Add failing source-invariant tests**

Require no rejected marketing phrase in exported content, no `transition-all` in redesigned class constants, and configuration labels to match the design vocabulary.

**Step 2: Run and verify failure where applicable**

Run: `pnpm vitest run tests/marketing.test.ts tests/dashboard-nav.test.ts`

**Step 3: Implement the pass**

Add `color-scheme: dark`, improve essential muted contrast, preserve reduced motion, make the skip-link reveal on focus, ensure landmarks have names, and ensure the dashboard main content has `id="main-content"`. Keep decorative elements hidden from assistive technology.

**Step 4: Run tests and typecheck**

Run: `pnpm vitest run tests/marketing.test.ts tests/dashboard-nav.test.ts`

Run: `pnpm exec tsc --noEmit`

Expected: both PASS.

**Step 5: Commit**

```bash
git add app components lib tests
git commit -m "fix: strengthen redesigned UI accessibility"
```

### Task 7: Generate and wire the matching social preview

**Files:**
- Replace: `public/og.png`
- Modify: `app/layout.tsx`

**Step 1: Freeze the social-card brief**

Use the finished headline, black/lime palette, pipeline motif, and exact Sendthen wordmark. The card copy is limited to “Own your email stack.” and “sendthen”.

**Step 2: Generate exactly one cohesive 1200×630 card**

Use the image generation skill once. Inspect text accuracy and retry once only if unusable.

**Step 3: Wire metadata**

Keep absolute Open Graph resolution through `metadataBase`; update alt text to the exact card meaning.

**Step 4: Run typecheck and build**

Run: `pnpm exec tsc --noEmit`

Run: `pnpm build`

Expected: both PASS.

**Step 5: Commit**

```bash
git add public/og.png app/layout.tsx
git commit -m "feat: update Sendthen social preview"
```

### Task 8: Full verification and completion audit

**Files:**
- Modify only if a verification failure identifies a real defect.

**Step 1: Run the unit suite**

Run: `pnpm test`

Expected: all test files pass.

**Step 2: Run TypeScript and production build**

Run: `pnpm exec tsc --noEmit`

Run: `pnpm build`

Expected: both exit 0.

**Step 3: Run existing end-to-end checks**

Start the app with the documented mocked-DNS environment on port 3100, then run:

```bash
node scripts/e2e.mjs http://127.0.0.1:3100
```

Expected: all documented end-to-end checks pass.

**Step 4: Audit the requirements**

Confirm from the current worktree that the old landing imports are gone, five primary dashboard items are rendered, every old route remains reachable, Home no longer duplicates the daily chart, rejected claims are absent, source links are present, and the worktree has no unintended generated files.

**Step 5: Request code review**

Use `superpowers:requesting-code-review`, address only evidence-backed issues, rerun affected checks, then use `superpowers:verification-before-completion`.

**Step 6: Commit any verified corrections**

```bash
git add <affected-files>
git commit -m "fix: address redesign verification findings"
```

