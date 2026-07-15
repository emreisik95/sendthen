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
