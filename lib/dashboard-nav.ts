export type DashboardNavigationItem = Readonly<{
  key: string;
  label: string;
  href: `/${string}`;
}>;

export const primaryNavigation = [
  { key: "home", label: "Home", href: "/overview" },
  { key: "activity", label: "Activity", href: "/emails" },
  { key: "campaigns", label: "Campaigns", href: "/broadcasts" },
  { key: "templates", label: "Templates", href: "/templates" },
  { key: "analytics", label: "Analytics", href: "/metrics" },
] as const satisfies readonly DashboardNavigationItem[];

export const configurationNavigation = [
  { key: "domains", label: "Domains", href: "/domains" },
  { key: "apiKeys", label: "API keys", href: "/api-keys" },
  { key: "webhooks", label: "Webhooks", href: "/webhooks" },
  {
    key: "blockedRecipients",
    label: "Blocked recipients",
    href: "/suppressions",
  },
  {
    key: "deliveryAndTracking",
    label: "Delivery & tracking",
    href: "/settings",
  },
] as const satisfies readonly DashboardNavigationItem[];

export const campaignCompanionNavigation = [
  { key: "contacts", label: "Contacts", href: "/audiences" },
] as const satisfies readonly DashboardNavigationItem[];

export const adminNavigation = [
  { key: "admin", label: "Admin", href: "/admin" },
] as const satisfies readonly DashboardNavigationItem[];

function normalizeNavigationPath(path: string): string {
  const [pathname = ""] = path.split(/[?#]/);
  return pathname.replace(/\/+$/, "") || "/";
}

export function isNavigationItemActive(
  pathname: string,
  href: DashboardNavigationItem["href"],
): boolean {
  const normalizedPathname = normalizeNavigationPath(pathname);
  const normalizedHref = normalizeNavigationPath(href);

  if (normalizedPathname === "/" || normalizedHref === "/") return false;

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

export function isConfigurationNavigationActive(pathname: string): boolean {
  return configurationNavigation.some(({ href }) =>
    isNavigationItemActive(pathname, href),
  );
}
