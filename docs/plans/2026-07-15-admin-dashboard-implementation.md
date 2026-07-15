# Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a secure admin-only dashboard that lists every user with their workspace domains and supports safe role changes and account deletion.

**Architecture:** Keep `/admin` in the existing dashboard route group, but enforce instance-admin authorization in a server-side service used by both reads and mutations. Aggregate users, team memberships, and domains into a page view model; execute destructive account lifecycle changes in SQLite transactions with last-admin and workspace-owner safeguards.

**Tech Stack:** Next.js 16 App Router, React 19 server components/actions, Drizzle ORM, SQLite, Tailwind CSS, Vitest.

### Task 1: Define admin authorization and dashboard aggregation

**Files:**
- Create: `lib/admin.ts`
- Create: `tests/admin.test.ts`

**Step 1: Write failing data tests**

Create real admin/member users, shared workspaces, and verified/pending domains. Assert that `loadAdminDashboard(actor, search)` returns global counts, users ordered newest-first, each membership with its workspace domains, and search matches identity, workspace, and domain fields.

**Step 2: Run tests to verify RED**

Run: `pnpm vitest run tests/admin.test.ts`

Expected: FAIL because `@/lib/admin` does not exist.

**Step 3: Implement the minimal loader**

In `lib/admin.ts`, add `AdminOperationError`, `assertAdmin(actor)`, public view-model types, and `loadAdminDashboard(actor, search?)`. Query `users`, joined `teamMembers`/`teams`, and `domains`, then build the nested view model and apply a normalized case-insensitive search.

**Step 4: Run tests to verify GREEN**

Run: `pnpm vitest run tests/admin.test.ts`

Expected: aggregation and authorization tests PASS.

### Task 2: Implement safe role management

**Files:**
- Modify: `lib/admin.ts`
- Modify: `tests/admin.test.ts`

**Step 1: Write failing mutation tests**

Assert `changeUserRole(actor, targetId, role)` rejects non-admin actors, invalid/unknown targets, self-role changes, and demotion of the final administrator. Assert a valid promotion and demotion persists.

**Step 2: Run tests to verify RED**

Run: `pnpm vitest run tests/admin.test.ts`

Expected: FAIL because `changeUserRole` is not implemented.

**Step 3: Implement the transaction**

Validate input and actor/target state inside a SQLite transaction. Count current admins at mutation time, enforce the self/final-admin invariants, update the target, and return a small result for redirect messaging.

**Step 4: Run tests to verify GREEN**

Run: `pnpm vitest run tests/admin.test.ts`

Expected: role tests PASS.

### Task 3: Implement safe account deletion

**Files:**
- Modify: `lib/admin.ts`
- Modify: `tests/admin.test.ts`

**Step 1: Write failing deletion tests**

Assert `deleteUser(actor, targetId)` rejects non-admin, self, unknown, and final-admin deletion. Prove it deletes target sessions, promotes the oldest remaining member when the target was the sole workspace owner, preserves shared workspace/domains, and deletes a workspace (plus domain) when the target was its only member.

**Step 2: Run tests to verify RED**

Run: `pnpm vitest run tests/admin.test.ts`

Expected: FAIL because `deleteUser` is not implemented.

**Step 3: Implement lifecycle repair and deletion**

Within one transaction, load target memberships. For each owned workspace, inspect remaining memberships: delete empty workspaces or promote the oldest remaining member if no other owner exists. Delete the user last and rely on declared cascades for sessions and memberships.

**Step 4: Run tests to verify GREEN**

Run: `pnpm vitest run tests/admin.test.ts`

Expected: all service tests PASS.

### Task 4: Add protected server actions and page UI

**Files:**
- Create: `app/admin-actions.ts`
- Create: `app/(dash)/admin/page.tsx`
- Create: `tests/admin-ui.test.ts`

**Step 1: Write failing route/UI source tests**

Assert the page exists, requires the session user and admin loader, renders labelled global metrics, a GET search form, nested workspace/domain content, native role controls, destructive disclosure, current-user protection, and accessible success/error notices. Assert actions resolve the current user server-side and never accept an actor ID from form data.

**Step 2: Run tests to verify RED**

Run: `pnpm vitest run tests/admin-ui.test.ts`

Expected: FAIL because page/actions do not exist.

**Step 3: Implement actions**

Map service error codes to safe redirect query parameters. Parse only `targetId` and the requested role from forms; derive the actor with `requireUser()` and call the service.

**Step 4: Implement page**

Build the responsive server-rendered page with existing `Card`, `PageHeader`, `StatusPill`, and form class helpers. Format dates deterministically, preserve the current search on mutations, and avoid exposing password hashes or secrets.

**Step 5: Run tests to verify GREEN**

Run: `pnpm vitest run tests/admin-ui.test.ts tests/admin.test.ts`

Expected: both test files PASS.

### Task 5: Add admin-only navigation

**Files:**
- Modify: `lib/dashboard-nav.ts`
- Modify: `components/dashboard-shell.tsx`
- Modify: `components/nav-icons.tsx`
- Modify: `tests/dashboard-nav.test.ts`
- Modify: `tests/dashboard-shell-source.test.ts`

**Step 1: Write failing navigation tests**

Define `adminNavigation` with `{ key: "admin", label: "Admin", href: "/admin" }`. Assert the shell maps it only when `userSummary.role === "admin"`, uses boundary-safe active matching, and provides its icon.

**Step 2: Run tests to verify RED**

Run: `pnpm vitest run tests/dashboard-nav.test.ts tests/dashboard-shell-source.test.ts`

Expected: FAIL because the model and conditional render do not exist.

**Step 3: Implement the navigation entry**

Add the serializable model and shield/user-management icon. Render an `Instance` group below workspace navigation only for admins, reusing `DashboardLink` so desktop and mobile behavior remain identical.

**Step 4: Run tests to verify GREEN**

Run: `pnpm vitest run tests/dashboard-nav.test.ts tests/dashboard-shell-source.test.ts`

Expected: navigation tests PASS.

### Task 6: Verify the complete feature

**Files:**
- Modify only files required by failures discovered during verification.

**Step 1: Run focused tests**

Run: `pnpm vitest run tests/admin.test.ts tests/admin-ui.test.ts tests/dashboard-nav.test.ts tests/dashboard-shell-source.test.ts`

Expected: PASS with no warnings.

**Step 2: Run all automated gates**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`

Expected: all tests PASS, TypeScript exits 0, production build exits 0.

**Step 3: Browser verification**

Start a temporary local server with a temporary database. Verify an admin can see multiple users and domains, search, change another user's role, and delete an eligible account. Verify a member cannot open `/admin`; inspect desktop and mobile layouts for clipping, readable domain groups, keyboard focus, and notices.

**Step 4: Completion audit**

Map every objective clause and design invariant to a current file, test output, or browser observation. Do not claim completion while any authorization, visibility, management, responsive UI, or lifecycle requirement lacks direct evidence.
