import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import {
  buildHomeDailySeries,
  compareHomeWindows,
  formatHomeChange,
  formatHomePercentage,
  homeAttentionItems,
  homeReadinessSteps,
  nextHomeAction,
  summarizeHomeStatuses,
  type HomeDailyPoint,
  type HomeReadiness,
  type HomeReadinessStep,
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

function MetricCard({
  label,
  value,
  detail,
  context,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  context: string;
  tone?: "default" | "good" | "danger";
  icon: ReactNode;
}) {
  const toneClasses = {
    default: "text-info bg-info/10 border-info/15",
    good: "text-ok bg-ok/10 border-ok/15",
    danger: "text-danger bg-danger/10 border-danger/15",
  }[tone];

  return (
    <Card className="group min-w-0 overflow-hidden p-4 transition-colors hover:border-fg-faint/70">
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs ${toneClasses}`}
        >
          {icon}
        </span>
      </div>
      <p className="font-mono text-[1.75rem] leading-none tabular-nums tracking-tight text-fg">
        {value}
      </p>
      <p
        className={`mt-3 text-xs font-medium ${
          tone === "danger" ? "text-danger" : "text-fg"
        }`}
      >
        {detail}
      </p>
      <p className="mt-1 text-xs text-fg-faint">{context}</p>
    </Card>
  );
}

function LaunchPanel({
  steps,
  action,
}: {
  steps: readonly HomeReadinessStep[];
  action: ReturnType<typeof nextHomeAction>;
}) {
  const completed = steps.filter((step) => step.complete).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <section aria-labelledby="launch-heading" className="mb-6">
      <Card className="dashboard-command-panel overflow-hidden border-warn/25">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex rounded-full border border-warn/25 bg-warn/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-warn">
                {completed} of {steps.length} complete
              </span>
              <span className="text-xs text-fg-faint">About 2 minutes</span>
            </div>
            <h2
              id="launch-heading"
              className="text-xl font-semibold tracking-tight text-fg sm:text-2xl"
            >
              Launch Sendthen
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
              Finish the essentials once, then this space becomes your live
              workspace health summary.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-bg/55 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-fg-muted">Up next</p>
                <p className="mt-1 text-sm font-medium text-fg">
                  {action.title}
                </p>
              </div>
              <span className="font-mono text-xs text-warn">{progress}%</span>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-label="Workspace setup progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-warn"
                style={{ width: `${progress}%` }}
              />
            </div>
            <Link href="/onboarding" className={`${btnPrimary} mt-4 w-full`}>
              Continue guided setup
            </Link>
          </div>
        </div>

        <ol className="grid border-t border-line bg-bg/35 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li
              key={step.key}
              className="border-b border-line last:border-b-0 sm:[&:nth-child(2)]:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0"
            >
              <Link
                href={step.href}
                className="flex min-h-[4.75rem] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/75"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${{
                    true: "border-ok/40 bg-ok/12 text-ok",
                    false: "border-line bg-surface-2 text-fg-faint",
                  }[String(step.complete)]}`}
                >
                  {step.complete ? "✓" : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-fg">
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-fg-faint">
                    {step.complete
                      ? "Complete"
                      : step.key === action.key
                        ? "Up next"
                        : "Not started"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

function ReadyPanel({
  attentionCount,
}: {
  attentionCount: number;
}) {
  const healthy = attentionCount === 0;
  return (
    <section aria-labelledby="launch-heading" className="mb-6">
      <Card
        className={`dashboard-command-panel px-4 py-3.5 sm:px-5 ${
          healthy ? "border-ok/25" : "border-warn/25"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-sm ${
                healthy
                  ? "border-ok/30 bg-ok/10 text-ok"
                  : "border-warn/30 bg-warn/10 text-warn"
              }`}
            >
              {healthy ? "✓" : "!"}
            </span>
            <div className="min-w-0">
              <h2 id="launch-heading" className="text-sm font-medium text-fg">
                {healthy ? "Workspace ready" : "Workspace needs attention"}
              </h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                {healthy
                  ? "Domain verified, API access ready, and sending activity detected."
                  : `${attentionCount} operational ${attentionCount === 1 ? "item" : "items"} to review.`}
              </p>
            </div>
          </div>
          <Link
            href="/domains"
            className="inline-flex min-h-10 items-center text-xs font-medium text-fg-muted transition-colors hover:text-fg"
          >
            Review configuration →
          </Link>
        </div>
      </Card>
    </section>
  );
}

function DeliveryVolume({ series }: { series: readonly HomeDailyPoint[] }) {
  const totals = series.map((point) => {
    const inFlight = Math.max(
      0,
      point.sent - point.delivered - point.issues,
    );
    return {
      ...point,
      inFlight,
      total: point.delivered + inFlight + point.issues,
    };
  });
  const maxVolume = Math.max(1, ...totals.map((point) => point.total));
  const totalDelivered = totals.reduce(
    (sum, point) => sum + point.delivered,
    0,
  );
  const totalIssues = totals.reduce((sum, point) => sum + point.issues, 0);

  return (
    <section aria-labelledby="volume-heading" className="mb-6">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline px-4 py-4 sm:px-5">
          <div>
            <h2 id="volume-heading" className="text-sm font-medium text-fg">
              Delivery volume
            </h2>
            <p className="mt-1 text-xs text-fg-muted">
              Daily final outcomes across the last 14 days
            </p>
          </div>
          <ul className="flex flex-wrap gap-3 text-[11px] text-fg-muted">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-ok" />
              Delivered
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-info" />
              Sent
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-danger" />
              Issues
            </li>
          </ul>
        </div>

        <div className="dashboard-volume-grid px-3 pb-3 pt-5 sm:px-5">
          <div
            aria-hidden="true"
            className="flex h-40 items-end gap-1 sm:gap-2"
          >
            {totals.map((point, index) => (
              <div
                key={point.day}
                className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`${point.label}: ${point.delivered} delivered, ${point.inFlight} sent, ${point.issues} issues`}
              >
                {point.total > 0 ? (
                  <div
                    className="flex min-h-1 w-full flex-col-reverse overflow-hidden rounded-t-sm bg-surface-3 transition-opacity group-hover:opacity-80"
                    style={{
                      height: `max(4px, ${(point.total / maxVolume) * 100}%)`,
                    }}
                  >
                    {point.delivered > 0 && (
                      <span
                        className="bg-ok"
                        style={{ flex: point.delivered }}
                      />
                    )}
                    {point.inFlight > 0 && (
                      <span className="bg-info" style={{ flex: point.inFlight }} />
                    )}
                    {point.issues > 0 && (
                      <span
                        className="bg-danger"
                        style={{ flex: point.issues }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-px w-full bg-line" />
                )}
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="mt-2 flex gap-1 sm:gap-2">
            {totals.map((point, index) => (
              <span
                key={point.day}
                className="min-w-0 flex-1 text-center font-mono text-[9px] text-fg-faint"
              >
                {index % 2 === 0 || index === totals.length - 1
                  ? point.label.split(" ")[0]
                  : ""}
              </span>
            ))}
          </div>
        </div>

        <p className="sr-only">
          Last 14 days: {totalDelivered.toLocaleString()} delivered and{" "}
          {totalIssues.toLocaleString()} bounced or failed.
        </p>
      </Card>
    </section>
  );
}

function UsageMeter({
  label,
  value,
  limit,
}: {
  label: string;
  value: number;
  limit: number | null;
}) {
  const percentage =
    limit && limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="font-mono tabular-nums text-fg">
          {value.toLocaleString()}
          {limit !== null && (
            <span className="text-fg-faint"> / {limit.toLocaleString()}</span>
          )}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        {limit === null ? (
          <div className="h-full w-full bg-info/30" />
        ) : (
          <div
            className={`h-full rounded-full ${
              percentage >= 80 ? "bg-warn" : "bg-info"
            }`}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-fg-faint">
        {limit === null ? "No cap on this instance" : `${percentage}% used`}
      </p>
    </div>
  );
}

function HealthRow({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  tone: "ok" | "warn" | "muted";
}) {
  const dot = {
    ok: "bg-ok shadow-[0_0_10px_rgba(198,255,0,0.35)]",
    warn: "bg-warn",
    muted: "bg-fg-faint",
  }[tone];

  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
    >
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 text-xs text-fg-muted">{label}</span>
      <span className="max-w-[9rem] truncate text-right text-xs font-medium text-fg">
        {value}
      </span>
    </Link>
  );
}

function domainHealth(readiness: HomeReadiness): {
  value: string;
  tone: "ok" | "warn" | "muted";
} {
  if (readiness.domain === "verified") {
    return { value: "Verified", tone: "ok" };
  }
  if (readiness.domain === "pending") {
    return { value: "DNS pending", tone: "warn" };
  }
  if (readiness.domain === "failed") {
    return { value: "Check failed", tone: "warn" };
  }
  return { value: "Not connected", tone: "muted" };
}

export default async function OverviewPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const since = beginningOfWindow();

  const {
    readiness,
    activeKeyCount,
    statusRows,
    dailyStatusRows,
    dailyOpenRows,
    recentEmails,
    webhookCount,
    audienceCount,
    campaignCount,
    usage,
  } = await loadDashboardHome(team, since);
  const action = nextHomeAction(readiness);
  const readinessSteps = homeReadinessSteps(readiness);
  const statusSummary = summarizeHomeStatuses(statusRows);
  const dailySeries = buildHomeDailySeries(
    dailyStatusRows,
    dailyOpenRows,
    new Date(),
    DAYS,
  );
  const windows = compareHomeWindows(dailySeries);
  const attention = homeAttentionItems({
    readiness,
    bouncedOrFailed: statusSummary.bouncedOrFailed,
    todayUsage: usage.today,
    dailyLimit: usage.dailyLimit,
    webhookCount,
  });
  const domain = domainHealth(readiness);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const unlimited = process.env.SENDTHEN_UNLIMITED === "true";
  const currentDeliveryRate = formatHomePercentage(
    windows.current.delivered,
    windows.current.sent,
  );
  const previousDeliveryRate = formatHomePercentage(
    windows.previous.delivered,
    windows.previous.sent,
  );
  const currentOpenRate = formatHomePercentage(
    windows.current.opened,
    windows.current.delivered,
  );
  const previousOpenRate = formatHomePercentage(
    windows.previous.opened,
    windows.previous.delivered,
  );

  return (
    <div className="mx-auto max-w-[78rem]">
      <PageHeader title="Home">
        <Link href="/emails" className={btnSecondary}>
          View activity
        </Link>
        <Link href="/metrics" className={btnSecondary}>
          Open Analytics
        </Link>
      </PageHeader>

      <div className="-mt-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Welcome back, <span className="text-fg">{firstName}</span>. Here is
          your sending pulse.
        </p>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            attention.some((item) => item.tone === "danger")
              ? "border-danger/25 bg-danger/8 text-danger"
              : action.key !== "ready" || attention.length > 0
                ? "border-warn/25 bg-warn/8 text-warn"
                : "border-ok/25 bg-ok/8 text-ok"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              attention.some((item) => item.tone === "danger")
                ? "bg-danger"
                : action.key !== "ready" || attention.length > 0
                  ? "bg-warn"
                  : "bg-ok"
            }`}
          />
          {attention.some((item) => item.tone === "danger")
            ? "Delivery needs attention"
            : action.key !== "ready"
              ? "Setup in progress"
              : attention.length > 0
                ? "Usage needs attention"
                : "All systems operational"}
        </span>
      </div>

      {action.key === "ready" ? (
        <ReadyPanel attentionCount={attention.length} />
      ) : (
        <LaunchPanel steps={readinessSteps} action={action} />
      )}

      <section aria-labelledby="pulse-heading" className="mb-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="pulse-heading" className="text-sm font-medium text-fg">
              7-day pulse
            </h2>
            <p className="mt-1 text-xs text-fg-muted">
              Latest seven days compared with the previous seven
            </p>
          </div>
          {attention.find((item) => item.key === "delivery-issues") && (
            <Link
              href="/emails"
              className="text-xs font-medium text-danger transition-colors hover:text-fg"
            >
              Review Delivery issues →
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Sent"
            value={windows.current.sent.toLocaleString()}
            detail={formatHomeChange(
              windows.current.sent,
              windows.previous.sent,
            )}
            context="Final sending outcomes"
            icon="↗"
          />
          <MetricCard
            label="Delivery rate"
            value={currentDeliveryRate}
            detail={
              previousDeliveryRate === "—"
                ? "No prior baseline"
                : `${previousDeliveryRate} in prior 7d`
            }
            context={`${windows.current.delivered.toLocaleString()} delivered`}
            tone="good"
            icon="✓"
          />
          <MetricCard
            label="Opened"
            value={currentOpenRate}
            detail={
              previousOpenRate === "—"
                ? "No prior baseline"
                : `${previousOpenRate} in prior 7d`
            }
            context={`${windows.current.opened.toLocaleString()} tracked opens`}
            icon="◉"
          />
          <MetricCard
            label="Delivery issues"
            value={windows.current.issues.toLocaleString()}
            detail={
              windows.current.issues === 0
                ? "No issues this week"
                : formatHomeChange(
                    windows.current.issues,
                    windows.previous.issues,
                  )
            }
            context="Bounced or failed"
            tone={windows.current.issues > 0 ? "danger" : "good"}
            icon={windows.current.issues > 0 ? "!" : "✓"}
          />
        </div>
      </section>

      <DeliveryVolume series={dailySeries} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-labelledby="recent-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 id="recent-heading" className="text-sm font-medium text-fg">
                Recent activity
              </h2>
              <p className="mt-1 text-xs text-fg-muted">
                Latest outbound messages in this workspace
              </p>
            </div>
            <Link
              href="/emails"
              className="inline-flex min-h-10 items-center text-xs font-medium text-fg-muted transition-colors hover:text-fg"
            >
              View all →
            </Link>
          </div>

          {recentEmails.length === 0 ? (
            <Card className="px-5 py-12 text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-faint"
              >
                ↗
              </span>
              <p className="mt-4 text-sm font-medium text-fg">
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
                  className="grid min-w-0 gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-xs text-fg-faint"
                    >
                      ✉
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">
                        {email.subject || "(no subject)"}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-fg-muted">
                        to {email.to[0] ?? "unknown recipient"}
                        {email.to.length > 1 ? ` +${email.to.length - 1}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <StatusPill status={email.status} />
                    <span className="font-mono text-[11px] tabular-nums text-fg-faint">
                      {fmtDate(email.sentAt ?? email.createdAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </section>

        <aside aria-label="Workspace details" className="space-y-6">
          <section aria-labelledby="usage-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="usage-heading" className="text-sm font-medium text-fg">
                Usage
              </h2>
              <Link
                href="/billing"
                className="text-xs text-fg-muted transition-colors hover:text-fg"
              >
                Plan →
              </Link>
            </div>
            <Card className="space-y-5 p-4">
              {unlimited ? (
                <div className="rounded-lg border border-info/15 bg-info/8 p-3">
                  <p className="text-xs font-medium text-info">
                    Instance limits disabled
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                    Sending is not capped by Sendthen configuration.
                  </p>
                </div>
              ) : (
                <>
                  <UsageMeter
                    label="Today"
                    value={usage.today}
                    limit={usage.dailyLimit}
                  />
                  <UsageMeter
                    label="This month"
                    value={usage.month}
                    limit={usage.monthlyLimit}
                  />
                </>
              )}
            </Card>
          </section>

          <section aria-labelledby="health-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="health-heading" className="text-sm font-medium text-fg">
                Workspace health
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                Live
              </span>
            </div>
            <Card className="divide-y divide-hairline overflow-hidden">
              <HealthRow
                href="/domains"
                label="Sending domain"
                value={domain.value}
                tone={domain.tone}
              />
              <HealthRow
                href="/api-keys"
                label="API access"
                value={
                  readiness.hasApiKey
                    ? `${activeKeyCount} active`
                    : "Send scope missing"
                }
                tone={readiness.hasApiKey ? "ok" : "warn"}
              />
              <HealthRow
                href="/webhooks"
                label="Webhooks"
                value={webhookCount > 0 ? `${webhookCount} connected` : "Optional"}
                tone={webhookCount > 0 ? "ok" : "muted"}
              />
              <div className="grid grid-cols-2 divide-x divide-hairline bg-surface-2/35">
                <Link
                  href="/audiences"
                  className="p-3.5 transition-colors hover:bg-surface-2"
                >
                  <span className="block font-mono text-lg tabular-nums text-fg">
                    {audienceCount.toLocaleString()}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-fg-muted">
                    Contact lists
                  </span>
                </Link>
                <Link
                  href="/broadcasts"
                  className="p-3.5 transition-colors hover:bg-surface-2"
                >
                  <span className="block font-mono text-lg tabular-nums text-fg">
                    {campaignCount.toLocaleString()}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-fg-muted">
                    Campaigns
                  </span>
                </Link>
              </div>
            </Card>
          </section>
        </aside>
      </div>
    </div>
  );
}
