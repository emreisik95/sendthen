export type HomeDomainState = "missing" | "pending" | "verified" | "failed";

export type HomeReadiness = Readonly<{
  domain: HomeDomainState;
  domainId?: string | null;
  hasApiKey: boolean;
  hasSentEmail: boolean;
}>;

export type HomeActionKey =
  | "add-domain"
  | "verify-domain"
  | "create-key"
  | "send-first-email"
  | "ready";

export type HomeAction = Readonly<{
  key: HomeActionKey;
  title: string;
  description: string;
  label: string;
  href: string;
}>;

export type HomeReadinessStep = Readonly<{
  key: Exclude<HomeActionKey, "ready">;
  label: string;
  complete: boolean;
  href: string;
}>;

function domainHref(readiness: HomeReadiness): string {
  return readiness.domainId ? `/domains/${readiness.domainId}` : "/domains";
}

export function nextHomeAction(readiness: HomeReadiness): HomeAction {
  if (readiness.domain === "missing") {
    return {
      key: "add-domain",
      title: "Add a sending domain",
      description:
        "Add the domain you plan to send from so Sendthen can prepare its DNS records.",
      label: "Add domain",
      href: "/domains",
    };
  }

  if (readiness.domain !== "verified") {
    return {
      key: "verify-domain",
      title: "Verify your sending domain",
      description:
        "Publish the provided DKIM and SPF records, then check the domain again.",
      label: "Review DNS records",
      href: domainHref(readiness),
    };
  }

  if (!readiness.hasApiKey) {
    return {
      key: "create-key",
      title: "Create an API key",
      description:
        "Create a scoped key so your application can authenticate with the sending API.",
      label: "Create API key",
      href: "/api-keys",
    };
  }

  if (!readiness.hasSentEmail) {
    return {
      key: "send-first-email",
      title: "Send your first email",
      description:
        "Your domain and API access are ready. Make one request to confirm the sending flow.",
      label: "Open sending guide",
      href: "/docs#emails",
    };
  }

  return {
    key: "ready",
    title: "Ready to send",
    description:
      "Your domain is verified, an API key is active, and this workspace has sent email.",
    label: "View email activity",
    href: "/emails",
  };
}

export function homeReadinessSteps(
  readiness: HomeReadiness,
): readonly HomeReadinessStep[] {
  return [
    {
      key: "add-domain",
      label: "Add a sending domain",
      complete: readiness.domain !== "missing",
      href: "/domains",
    },
    {
      key: "verify-domain",
      label: "Verify the domain",
      complete: readiness.domain === "verified",
      href: domainHref(readiness),
    },
    {
      key: "create-key",
      label: "Create an API key",
      complete: readiness.hasApiKey,
      href: "/api-keys",
    },
    {
      key: "send-first-email",
      label: "Send the first email",
      complete: readiness.hasSentEmail,
      href: "/docs#emails",
    },
  ];
}

export type HomeStatusRow = Readonly<{
  status: string;
  count: number;
}>;

export type HomeStatusSummary = Readonly<{
  sent: number;
  delivered: number;
  bouncedOrFailed: number;
}>;

function nonNegativeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function summarizeHomeStatuses(
  rows: readonly HomeStatusRow[],
): HomeStatusSummary {
  let sent = 0;
  let delivered = 0;
  let bouncedOrFailed = 0;

  for (const row of rows) {
    const value = nonNegativeCount(row.count);
    if (
      row.status === "sent" ||
      row.status === "delivered" ||
      row.status === "bounced"
    ) {
      sent += value;
    }
    if (row.status === "delivered") delivered += value;
    if (row.status === "bounced" || row.status === "failed") {
      bouncedOrFailed += value;
    }
  }

  return { sent, delivered, bouncedOrFailed };
}

export function formatHomePercentage(value: number, total: number): string {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(value)) {
    return "—";
  }

  const percentage = Math.round((Math.max(0, value) / total) * 100);
  return `${Math.min(100, percentage)}%`;
}

export type HomeDailyStatusRow = Readonly<{
  day: string;
  status: string;
  count: number;
}>;

export type HomeDailyOpenRow = Readonly<{
  day: string;
  count: number;
}>;

export type HomeDailyPoint = Readonly<{
  day: string;
  label: string;
  sent: number;
  delivered: number;
  opened: number;
  issues: number;
}>;

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const homeDayLabel = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

export function buildHomeDailySeries(
  statusRows: readonly HomeDailyStatusRow[],
  openRows: readonly HomeDailyOpenRow[],
  endDate: Date,
  days = 14,
): readonly HomeDailyPoint[] {
  if (!Number.isFinite(endDate.getTime()) || days <= 0) return [];

  const points = Array.from({ length: Math.floor(days) }, (_, index) => {
    const date = new Date(endDate);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (Math.floor(days) - 1 - index));
    return {
      day: localDayKey(date),
      label: homeDayLabel.format(date),
      sent: 0,
      delivered: 0,
      opened: 0,
      issues: 0,
    };
  });
  const byDay = new Map(points.map((point) => [point.day, point]));

  for (const row of statusRows) {
    const point = byDay.get(row.day);
    if (!point) continue;
    const value = nonNegativeCount(row.count);
    if (
      row.status === "sent" ||
      row.status === "delivered" ||
      row.status === "bounced"
    ) {
      point.sent += value;
    }
    if (row.status === "delivered") point.delivered += value;
    if (row.status === "bounced" || row.status === "failed") {
      point.issues += value;
    }
  }

  for (const row of openRows) {
    const point = byDay.get(row.day);
    if (point) point.opened += nonNegativeCount(row.count);
  }

  return points;
}

export type HomeWindowSummary = Readonly<{
  sent: number;
  delivered: number;
  opened: number;
  issues: number;
}>;

function summarizeHomeWindow(
  points: readonly HomeDailyPoint[],
): HomeWindowSummary {
  return points.reduce<HomeWindowSummary>(
    (summary, point) => ({
      sent: summary.sent + point.sent,
      delivered: summary.delivered + point.delivered,
      opened: summary.opened + point.opened,
      issues: summary.issues + point.issues,
    }),
    { sent: 0, delivered: 0, opened: 0, issues: 0 },
  );
}

export function compareHomeWindows(
  series: readonly HomeDailyPoint[],
): Readonly<{
  current: HomeWindowSummary;
  previous: HomeWindowSummary;
}> {
  return {
    current: summarizeHomeWindow(series.slice(-7)),
    previous: summarizeHomeWindow(series.slice(-14, -7)),
  };
}

export function formatHomeChange(current: number, previous: number): string {
  const safeCurrent = nonNegativeCount(current);
  const safePrevious = nonNegativeCount(previous);
  if (safeCurrent === 0 && safePrevious === 0) return "No activity yet";
  if (safePrevious === 0) return "New this week";

  const change = Math.round(((safeCurrent - safePrevious) / safePrevious) * 100);
  if (change === 0) return "No change vs prior 7d";
  return `${change > 0 ? "+" : "−"}${Math.abs(change)}% vs prior 7d`;
}

export type HomeAttentionItem = Readonly<{
  key: "setup" | "delivery-issues" | "daily-limit";
  tone: "warning" | "danger";
  title: string;
  description: string;
  href: string;
}>;

export function homeAttentionItems(input: Readonly<{
  readiness: HomeReadiness;
  bouncedOrFailed: number;
  todayUsage: number;
  dailyLimit: number | null;
  webhookCount: number;
}>): readonly HomeAttentionItem[] {
  const items: HomeAttentionItem[] = [];
  const action = nextHomeAction(input.readiness);

  if (action.key !== "ready") {
    items.push({
      key: "setup",
      tone: "warning",
      title: action.title,
      description: action.description,
      href: action.href,
    });
  }

  const issues = nonNegativeCount(input.bouncedOrFailed);
  if (issues > 0) {
    items.push({
      key: "delivery-issues",
      tone: "danger",
      title: `${issues.toLocaleString()} delivery ${issues === 1 ? "issue" : "issues"}`,
      description: "Review bounced and failed messages from the last 14 days.",
      href: "/emails",
    });
  }

  const todayUsage = nonNegativeCount(input.todayUsage);
  if (
    input.dailyLimit !== null &&
    input.dailyLimit > 0 &&
    todayUsage / input.dailyLimit >= 0.8
  ) {
    items.push({
      key: "daily-limit",
      tone: "warning",
      title: "Daily sending limit is close",
      description: `${Math.min(100, Math.round((todayUsage / input.dailyLimit) * 100))}% of today's allowance is used.`,
      href: "/billing",
    });
  }

  return items;
}
