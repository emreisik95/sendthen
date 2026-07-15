# Sendthen landing page and dashboard redesign

Date: 2026-07-13

## Product direction

Sendthen should lead as the email control plane developers can own. The primary audience is a technical founder or product team that likes the developer experience of a managed email API but does not want its application, message history, templates, contacts, and delivery path locked inside one vendor. The main landing-page conversion is self-hosting; trying the hosted product remains a visible secondary path.

The promise is: **Own your email stack. Keep the developer experience.** This is stronger and more defensible than promising superior inbox placement. Sendthen combines a familiar sending API, a dashboard, templates, broadcasts, inbound mail, tracking, and webhooks in one MIT-licensed application, then lets the operator choose sandbox capture, SMTP, Amazon SES, or an instance-level direct-MX transport.

The page must be candid about the trade-off. Self-hosting removes Sendthen software usage fees and managed-vendor lock-in, but the operator still pays for infrastructure and any selected transport and owns uptime, backups, abuse prevention, compliance, and sending reputation. Comparisons must distinguish architectural control from deliverability quality; the product has no evidence for “better deliverability” claims.

## Landing-page information architecture

The page uses a product-proof command-center direction: black and near-black surfaces, electric lime as the ownership/action signal, restrained cyan for delivery telemetry, Inter for reading, and JetBrains Mono for technical proof. The visual language stays recognizable while spacing, hierarchy, and contrast become more editorial and less like a grid of equally weighted feature cards.

The sequence is:

1. A compact navigation with Product, Compare, Docs, GitHub, Sign in, and one primary self-host CTA.
2. An outcome-led hero with two paths: “Self-host Sendthen” and “Try the hosted app.”
3. A credible product proof showing one request moving through queue, DKIM, the selected transport, and events/webhooks. It says “accepted by the receiving server,” never “inbox confirmed.”
4. Three outcome pillars: own the control plane, keep transport freedom, and operate the full email loop.
5. A product-surface tour covering transactional sending, campaigns and contacts, inbound mail, and the visual template studio.
6. A named competitor comparison, dated 2026-07-13, limited to observable architecture: self-hosting, open source, transport choice, local sandbox, state portability, and software usage metering. It includes a note that infrastructure and transport costs still apply.
7. A three-line Docker quickstart and an honest operations note.
8. Hosted and self-hosted choices, followed by a final ownership-focused CTA.

No fabricated customer logos, star counts, uptime figures, scale claims, or deliverability claims appear.

## Dashboard information architecture

The dashboard keeps every route and capability, but the shell presents jobs instead of the database model. The always-visible primary navigation becomes Home, Activity, Campaigns, Templates, and Analytics. “Activity” leads to sent mail and keeps received mail one tab away. Campaigns leads to broadcasts while contacts remain a nearby secondary destination. Advanced configuration is grouped under Configure: Domains, API keys, Webhooks, Blocked recipients, and Delivery & tracking. Workspace, billing, profile, and membership move into the existing account/workspace menus.

The shell shows a real active state and `aria-current`, uses a compact desktop sidebar, and becomes a mobile top bar plus dismissible drawer. The authenticated server layout still loads the user, team, memberships, and setup state; a small client shell owns only pathname awareness and drawer state. No database or authentication logic moves client-side.

Overview becomes Home instead of a second analytics page. It answers three questions in order: “Can I send?”, “What needs attention?”, and “What just happened?” The top contains a plain-language readiness statement and one primary next action. A setup checklist distinguishes adding a domain from verifying it. Four compact metrics summarize the last 14 days, followed by recent email activity and shortcuts. Detailed charts and range controls remain on Analytics.

Labels use plain language: Broadcasts becomes Campaigns, Audiences becomes Contacts, Metrics becomes Analytics, Suppressions becomes Blocked recipients, and Settings becomes Delivery & tracking. Routes stay unchanged to avoid migrations and broken links.

## Components and data flow

The landing page remains a server component and uses small data arrays for feature and comparison content. The existing route actions, API, queue, and persistence are untouched. Interactive code tabs are not required for the first redesign; one copyable, readable request example is enough and avoids an oversized client island.

The dashboard layout remains an async server component. It passes serializable user/team/setup values and rendered page content into a client `DashboardShell`. Navigation definitions live beside the shell so active-route matching and the mobile drawer are consistent. Existing custom icon components are reused.

Home performs bounded server-side queries for recent outbound messages, 14-day status totals, the latest domain state, active API keys, webhook count, audience/campaign counts, and quota usage. Empty workspaces render the setup path; populated workspaces render operational status and recent activity. Query failures should continue through Next.js error handling rather than presenting invented success states. Empty results use explicit next actions instead of referring to forms “above.”

Consequential flows and deep page redesigns remain outside this first shell/Home pass; the routes stay available. A later pass can turn campaign creation into a guided workflow and add confirmations to destructive actions without blocking the core simplification.

## Accessibility, responsive behavior, and errors

The redesign adds a skip link, visible current-page state, minimum comfortable control sizes, responsive page gutters, stacked page headers on narrow screens, and labels for new controls. Essential text uses a brighter muted token; faint text is reserved for nonessential metadata. Focus rings and reduced-motion behavior remain global. Animated proof never hides content when scripts or motion are unavailable.

The mobile dashboard must not reserve desktop-sidebar width. Its drawer has an explicit open button, close button, accessible name, escape-key handling, and closes after navigation. Tables outside this scope keep their current rendering, but the shell and Home must work at 390px without horizontal page overflow.

Copy and status feedback must use plain outcomes. Delivery states say queued, sent, delivered, bounced, or failed; SMTP acceptance is not described as inbox placement. When there is no data, ratios render as an em dash and the Home page recommends the next real setup action.

## Verification

Implementation is complete only when:

- focused tests cover navigation grouping, active-route matching, readiness-state selection, comparison content, and truthful claim invariants;
- `pnpm test`, `pnpm exec tsc --noEmit`, and `pnpm build` pass;
- the existing end-to-end product checks still pass against a running app;
- landing and authenticated dashboard routes render without runtime errors;
- keyboard navigation reaches the skip link, primary CTA, dashboard drawer, and all navigation destinations;
- the layout has no horizontal page overflow at mobile width and honors reduced motion;
- every named competitor row is still supported by an official source as of the comparison date;
- final copy contains none of the rejected claims: “inbox confirmed,” “better deliverability,” “zero vendors,” “unlimited everything,” or “drop-in replacement.”
