# Sendthen dashboard command center

Date: 2026-07-15

## Product goal

The authenticated Home should let a developer or operator understand the state of their email workspace in a few seconds. It must answer four questions in order: is the workspace ready, is delivery healthy, what changed recently, and what needs attention. Onboarding is part of this same operational surface rather than a separate experience that disappears after signup.

The visual direction is an operational command center: dense enough to be useful, calm enough to scan, and clearly Sendthen. Near-black surfaces remain the foundation, electric lime identifies healthy state and primary action, cyan carries neutral delivery telemetry, amber signals incomplete setup, and red is reserved for genuine failures. Large decoration is avoided; hierarchy comes from type, spacing, borders, and restrained tinted surfaces.

Three approaches were considered. An analytics-first dashboard gives trends too much weight and duplicates Analytics. A task-first dashboard works for new accounts but becomes dead weight for active workspaces. The selected hybrid combines a compact operational pulse with progressive setup: incomplete accounts see a launch checklist above the pulse, while completed accounts see the same space collapse into a small all-systems summary.

## Information architecture

Home begins with a personal greeting, a plain description of the current window, and two useful actions: open full Analytics and view message activity. An incomplete workspace then sees a “Launch Sendthen” panel with progress, the next recommended action, and four steps: add a domain, verify it, create an API key, and send the first email. The entire checklist stays visible so users know both what is complete and what comes next.

The operational pulse contains four KPI cards for sent volume, delivery rate, unique opens, and delivery issues. Each card shows a current seven-day value plus comparison with the previous seven days; comparisons use neutral language when there is no meaningful baseline. A compact fourteen-day delivery-volume visualization sits below, giving immediate shape to traffic without replacing the detailed Analytics route.

The lower grid pairs recent message activity with a right rail. Recent activity shows recipient, subject, status, and time in one scannable row. The rail contains usage against daily and monthly limits and workspace infrastructure health: sending domain, API access, and webhook coverage. Missing webhooks are informational rather than blocking because webhooks are useful but not required to send. Genuine delivery issues and limit pressure receive stronger treatment.

## Components and data flow

The Home route remains an async server component. `loadDashboardHome` continues to query only the active team, with one added bounded daily-status aggregation for the trailing fourteen days. No authentication, database, or quota logic moves into the client. The page passes query results through pure helpers that fill empty dates, calculate current-versus-previous comparisons, select attention states, and format percentages safely.

Small local server components render KPI cards, the daily volume chart, setup steps, usage bars, and health rows. The chart is semantic HTML and CSS with an accompanying accessible summary, so it needs no charting dependency or client JavaScript. Existing status pills, buttons, and route destinations are reused.

The separate onboarding route retains its working forms and server actions but receives a responsive journey layout: a compact progress rail on small screens and a contextual setup panel beside the active step on wide screens. The persistent sidebar setup card becomes a progress dock with one next-step label instead of repeating all checklist details. When onboarding is dismissed or complete, it disappears as it does today.

## Empty states, errors, and responsive behavior

An empty workspace still renders a complete dashboard. KPIs show zero or an em dash where a ratio has no denominator; the chart renders a calm zero baseline; recent activity points to the actual next setup action. Missing configuration never masquerades as failure. Pending DNS is amber, verified resources are lime, absent optional webhooks are muted, and bounced or failed messages are red.

Database and authentication failures continue through Next.js error handling. Percentages clamp unsafe input, comparison helpers handle zero baselines, usage bars cap visual width at 100%, and daily-series helpers ignore malformed or out-of-window rows. All routes remain unchanged.

At desktop widths, the main content uses a wide two-column lower grid. At tablet and mobile widths, cards stack, KPI tiles remain two-up where space permits, recent rows wrap cleanly, and the onboarding context becomes an inline progress header. Controls retain at least a 40px target. Essential information is never conveyed only through color, and reduced-motion behavior remains global.

## Verification

Implementation is complete when focused tests demonstrate daily-series filling, comparison semantics, attention selection, readiness priority, and existing team isolation; source tests confirm the Home and onboarding landmarks; the full Vitest suite, TypeScript check, and production build pass; and a browser review at desktop and mobile widths shows no horizontal overflow, broken states, or unreadable hierarchy.
