# Dashboard Command Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn Sendthen Home into a glanceable operational dashboard with progressive onboarding, delivery trends, recent activity, usage, and configuration health.

**Architecture:** Keep data and authentication server-rendered. Extend the bounded Home query with daily status aggregates, convert them through pure tested helpers, and compose the UI from small server components; retain existing routes and server actions while refining the onboarding presentation and compact sidebar progress dock.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Drizzle/SQLite, Vitest.

### Task 1: Define dashboard insight behavior

**Files:**
- Modify: `tests/dashboard-home.test.ts`
- Modify: `lib/dashboard-home.ts`

**Step 1: Write failing tests**

Add tests for filling a fourteen-day daily series, comparing the latest seven days with the previous seven, describing zero-baseline changes, and classifying issue states without treating an optional webhook as a sending blocker.

**Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/dashboard-home.test.ts`

Expected: FAIL because the new insight helpers are not exported.

**Step 3: Implement the pure helpers**

Add typed daily rows and series points, `buildHomeDailySeries`, `compareHomeWindows`, `formatHomeChange`, and `homeAttentionItems`. Reject malformed counts and out-of-window dates and return stable zero states.

**Step 4: Run the focused test and verify it passes**

Run: `pnpm vitest run tests/dashboard-home.test.ts`

Expected: PASS.

### Task 2: Load bounded trend and health data

**Files:**
- Modify: `tests/dashboard-home-data.test.ts`
- Modify: `lib/dashboard-home-data.ts`

**Step 1: Write failing data-contract assertions**

Extend the team-isolation fixture to require fourteen-day daily status rows and verify no other team's volume is returned.

**Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/dashboard-home-data.test.ts`

Expected: FAIL because `dailyStatusRows` is absent.

**Step 3: Implement the query**

Add one SQLite date/status aggregation bounded by `teamId` and `since`, retaining the existing indexed `createdAt` predicate. Return only date key, status, and count.

**Step 4: Run the focused tests**

Run: `pnpm vitest run tests/dashboard-home-data.test.ts tests/dashboard-home.test.ts`

Expected: PASS.

### Task 3: Build the operational Home

**Files:**
- Modify: `tests/dashboard-home.test.ts`
- Replace: `app/(dash)/overview/page.tsx`
- Modify: `app/globals.css`

**Step 1: Add failing source invariants**

Require the Home source to expose Launch Sendthen, Delivery volume, Recent activity, Usage, and Workspace health landmarks, and require the detailed Analytics link to remain present.

**Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/dashboard-home.test.ts`

Expected: FAIL on missing command-center landmarks.

**Step 3: Implement the Home composition**

Render the greeting/actions, progressive setup panel, four comparison-aware KPIs, semantic fourteen-day volume chart, recent messages, usage bars, and resource health. Preserve team scoping and existing action links. Add only scoped dashboard visual classes to `app/globals.css`.

**Step 4: Run focused checks**

Run: `pnpm vitest run tests/dashboard-home.test.ts tests/dashboard-home-data.test.ts`

Run: `pnpm exec tsc --noEmit`

Expected: PASS.

### Task 4: Refine onboarding and the persistent setup dock

**Files:**
- Modify: `tests/dashboard-shell-source.test.ts`
- Modify: `app/onboarding/page.tsx`
- Modify: `components/dashboard-shell.tsx`

**Step 1: Add failing presentation invariants**

Require the setup dock to expose the next incomplete step and a progress meter, and require the onboarding page to include a named setup journey region.

**Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/dashboard-shell-source.test.ts`

Expected: FAIL because the current dock lists all steps and onboarding has no journey region.

**Step 3: Implement the refinement**

Turn the sidebar card into a compact progress dock with one next step. Give onboarding a two-column journey layout at wide widths and keep the current forms, query parameters, skip behavior, and actions unchanged.

**Step 4: Run focused tests and typecheck**

Run: `pnpm vitest run tests/dashboard-shell-source.test.ts`

Run: `pnpm exec tsc --noEmit`

Expected: PASS.

### Task 5: Verify the completed experience

**Files:**
- Modify only if verification exposes a defect.

**Step 1: Run the full suite**

Run: `pnpm test`

Expected: all tests PASS.

**Step 2: Run static and production checks**

Run: `pnpm exec tsc --noEmit`

Run: `pnpm build`

Expected: both PASS.

**Step 3: Review rendered desktop and mobile states**

Capture Home and onboarding at 1440×1000 and 390×844, inspect hierarchy and overflow, and fix any defects found. Re-run focused checks after every correction.

**Step 4: Commit the implementation**

```bash
git add docs/plans tests lib app components
git commit -m "feat: build glanceable dashboard command center"
```
