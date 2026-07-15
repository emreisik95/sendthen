import Link from "next/link";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import {
  formatHomePercentage,
  homeReadinessSteps,
  nextHomeAction,
  summarizeHomeStatuses,
} from "@/lib/dashboard-home";
import { loadDashboardHome } from "@/lib/dashboard-home-data";
import {
  Card,
  PageHeader,
  StatusPill,
  btnPrimary,
  btnSecondary,
  fmtDate,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const DAYS = 14;

function beginningOfWindow(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (DAYS - 1));
  return start;
}

function quotaLabel(value: number, limit: number | null): string {
  return limit === null
    ? `${value.toLocaleString()} · no daily cap`
    : `${value.toLocaleString()} / ${limit.toLocaleString()}`;
}

export default async function OverviewPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const since = beginningOfWindow();

  const {
    readiness,
    activeKeyCount,
    statusRows,
    openedCount,
    recentEmails,
    webhookCount,
    audienceCount,
    campaignCount,
    usage,
  } = await loadDashboardHome(team, since);
  const action = nextHomeAction(readiness);
  const readinessSteps = homeReadinessSteps(readiness);
  const statusSummary = summarizeHomeStatuses(statusRows);
  const opened = openedCount;
  const unlimited = process.env.SENDTHEN_UNLIMITED === "true";

  const metrics = [
    {
      label: "Sent",
      value: statusSummary.sent.toLocaleString(),
      detail: "Finished the sending step",
    },
    {
      label: "Delivered",
      value: statusSummary.delivered.toLocaleString(),
      detail: `${formatHomePercentage(
        statusSummary.delivered,
        statusSummary.sent,
      )} of sent`,
    },
    {
      label: "Opened",
      value: opened.toLocaleString(),
      detail: `${formatHomePercentage(
        opened,
        statusSummary.delivered,
      )} of delivered`,
    },
    {
      label: "Bounced / failed",
      value: statusSummary.bouncedOrFailed.toLocaleString(),
      detail: "Delivery issues to review",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Home">
        <Link href="/metrics" className={btnSecondary}>
          Open Analytics
        </Link>
      </PageHeader>

      <Card
        className={`mb-6 overflow-hidden p-5 sm:p-6 ${
          action.key === "ready" ? "border-ok/35" : "border-warn/35"
        }`}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-wider text-fg-muted">
              Can I send?
            </p>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${
                  action.key === "ready" ? "bg-ok" : "bg-warn"
                }`}
              />
              <h2 className="text-xl font-semibold tracking-tight text-fg">
                {action.title}
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
              {action.description}
            </p>
            <Link href={action.href} className={`${btnPrimary} mt-5`}>
              {action.label}
            </Link>
          </div>

          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <p className="text-xs font-medium text-fg">Sending usage</p>
            {unlimited ? (
              <p className="mt-2 text-sm text-fg-muted">
                Instance limits are disabled.
              </p>
            ) : (
              <dl className="mt-3 space-y-3 text-xs">
                <div>
                  <dt className="text-fg-muted">Today</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-fg">
                    {quotaLabel(usage.today, usage.dailyLimit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">This month</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-fg">
                    {usage.month.toLocaleString()} /{" "}
                    {usage.monthlyLimit?.toLocaleString() ?? "no cap"}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </Card>

      <section aria-labelledby="setup-heading" className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 id="setup-heading" className="text-sm font-medium text-fg">
              Setup checklist
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              {readinessSteps.filter((step) => step.complete).length}/4 complete
            </p>
          </div>
          {action.key !== "ready" && (
            <Link
              href="/onboarding"
              className="text-xs text-fg-muted underline hover:text-fg"
            >
              Open guided setup
            </Link>
          )}
        </div>
        <Card className="grid gap-px overflow-hidden bg-line sm:grid-cols-2 lg:grid-cols-4">
          {readinessSteps.map((step, index) => (
            <Link
              key={step.key}
              href={step.href}
              className="flex min-w-0 items-center gap-3 bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                  step.complete
                    ? "border-ok bg-ok/14 text-ok"
                    : "border-line text-fg-muted"
                }`}
              >
                {step.complete ? "✓" : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-fg">
                  {step.label}
                </span>
                <span className="mt-0.5 block text-xs text-fg-muted">
                  {step.complete ? "Complete" : "Needs attention"}
                </span>
              </span>
            </Link>
          ))}
        </Card>
      </section>

      <section aria-labelledby="metrics-heading" className="mb-6">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="metrics-heading" className="text-sm font-medium text-fg">
              Last 14 days
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Current outcome totals; detailed trends live in Analytics.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="min-w-0 p-4">
              <p className="font-mono text-2xl tabular-nums text-fg">
                {metric.value}
              </p>
              <p className="mt-1 text-sm font-medium text-fg">{metric.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                {metric.detail}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="recent-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 id="recent-heading" className="text-sm font-medium text-fg">
              Recent activity
            </h2>
            <Link
              href="/emails"
              className="text-xs text-fg-muted underline hover:text-fg"
            >
              View all
            </Link>
          </div>

          {recentEmails.length === 0 ? (
            <Card className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-fg">
                No email activity yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
                Complete the next setup step, then send a request from the
                email API.
              </p>
              <Link href={action.href} className={`${btnSecondary} mt-5`}>
                {action.label}
              </Link>
            </Card>
          ) : (
            <Card className="divide-y divide-hairline overflow-hidden">
              {recentEmails.map((email) => (
                <Link
                  key={email.id}
                  href={`/emails/${email.id}`}
                  className="grid min-w-0 gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">
                      {email.subject || "(no subject)"}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-fg-muted">
                      to {email.to[0] ?? "unknown recipient"}
                      {email.to.length > 1 ? ` +${email.to.length - 1}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <StatusPill status={email.status} />
                    <span className="font-mono text-xs tabular-nums text-fg-faint">
                      {fmtDate(email.sentAt ?? email.createdAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </section>

        <section aria-labelledby="shortcuts-heading">
          <h2
            id="shortcuts-heading"
            className="mb-3 text-sm font-medium text-fg"
          >
            Shortcuts
          </h2>
          <Card className="divide-y divide-hairline overflow-hidden">
            <Link
              href="/emails"
              className="block p-4 transition-colors hover:bg-surface-2"
            >
              <span className="block text-sm text-fg">Send history</span>
              <span className="mt-0.5 block text-xs text-fg-muted">
                {statusSummary.sent.toLocaleString()} sent in 14 days
              </span>
            </Link>
            <Link
              href="/emails/inbound"
              className="block p-4 transition-colors hover:bg-surface-2"
            >
              <span className="block text-sm text-fg">Received mail</span>
              <span className="mt-0.5 block text-xs text-fg-muted">
                Open the inbound mailbox
              </span>
            </Link>
            <Link
              href="/audiences"
              className="block p-4 transition-colors hover:bg-surface-2"
            >
              <span className="block text-sm text-fg">Contacts</span>
              <span className="mt-0.5 block text-xs text-fg-muted">
                {audienceCount.toLocaleString()} contact lists
              </span>
            </Link>
            <Link
              href="/broadcasts"
              className="block p-4 transition-colors hover:bg-surface-2"
            >
              <span className="block text-sm text-fg">Campaigns</span>
              <span className="mt-0.5 block text-xs text-fg-muted">
                {campaignCount.toLocaleString()} campaigns
              </span>
            </Link>
            <Link
              href="/domains"
              className="block p-4 transition-colors hover:bg-surface-2"
            >
              <span className="block text-sm text-fg">Configuration</span>
              <span className="mt-0.5 block text-xs text-fg-muted">
                {activeKeyCount.toLocaleString()} active keys ·{" "}
                {webhookCount.toLocaleString()} webhooks
              </span>
            </Link>
          </Card>
        </section>
      </div>
    </div>
  );
}
