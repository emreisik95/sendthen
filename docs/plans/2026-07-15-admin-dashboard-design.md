# Admin Dashboard Design

## Goal

Give instance administrators one protected place to see every account, the workspaces and domains each account can access, and to safely manage account roles or remove an account.

## Chosen approach

Add an `/admin` page inside the existing authenticated dashboard. The shared shell will show an `Admin` navigation item only when its serializable `userSummary.role` is `admin`; this is only a discoverability affordance. The route, data loader, and every mutation will independently require a current server session whose database-backed user role is `admin`.

A dedicated `lib/admin.ts` service will own instance-wide reads and mutations. The page remains a server component and calls that service directly. Its query result will contain global counts plus one record per matching user, with their workspace memberships and each workspace's domains. Search will match user name, user email, workspace name, or domain name without hiding the global summary totals. This is preferable to changing the workspace Team page because platform roles and workspace ownership are separate authorization boundaries.

## User experience

The page opens with an `Admin / User management` heading and four compact summary cards: users, admins, workspaces, and verified/total domains. A GET search form filters by name, email, workspace, or domain and has a clear action. The result count communicates filtering, and an empty result explains how to reset it.

Each user is represented by a responsive row/card showing identity, instance role, join date, workspaces, and domain status. Domains are grouped beneath their workspace so shared-team access is explicit. A role form permits `member`/`admin` changes. Destructive account removal sits inside a clearly labelled disclosure with impact copy and a separate danger button. The current account is labelled and has disabled management controls.

Successful and rejected mutations redirect back to `/admin` with an accessible notice banner. The forms use native server actions and controls, preserving keyboard use and working without client-side JavaScript.

## Security and lifecycle invariants

- Signed-out visitors are redirected by the existing dashboard layout; non-admin members who reach `/admin` are redirected to `/overview`.
- The service rejects non-admin actors even if an action is invoked outside the UI.
- An administrator cannot demote or delete their own account.
- The final administrator cannot be demoted or deleted, including under concurrent or stale-form conditions checked at mutation time.
- Unknown user IDs fail without changing data.
- Deleting a user removes their sessions through the existing foreign-key cascade.
- If the deleted user is the only member of a workspace, the workspace is deleted so its domains and team-scoped resources cascade cleanly.
- If other members remain and the deleted user was the workspace's only owner, the oldest remaining member is promoted to owner before deletion.

SQLite mutations run in a transaction so role counts, ownership repair, and deletion stay consistent.

## Data flow and testing

`loadAdminDashboard(search)` loads users, memberships/workspaces, and domains, then constructs a stable view model. This makes the ownership model visible: domains belong to workspaces, and users see them through membership. Summary counts describe the full instance; `users` contains only search matches.

Database tests will create real users, shared and personal workspaces, domains, sessions, and memberships. They will prove aggregation/search, non-admin rejection, self/final-admin safeguards, role changes, session deletion, owner promotion, and empty-workspace cleanup. Source/UI tests will prove the protected route, forms, accessible search/status messaging, responsive structures, and role-gated navigation. Final verification includes focused tests, the full Vitest suite, TypeScript, production build, and browser inspection at desktop and mobile sizes.
