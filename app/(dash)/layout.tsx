import Link from "next/link";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam, membershipsOf } from "@/lib/team";
import { onboardingProgress } from "@/lib/onboarding";
import {
  completeOnboardingAction,
  logoutAction,
  switchTeamAction,
} from "@/app/actions";
import {
  IconBan,
  IconBook,
  IconBroadcast,
  IconCard,
  IconChart,
  IconChevronUpDown,
  IconGitHub,
  IconGlobe,
  IconKey,
  IconLogout,
  IconMail,
  IconMetrics,
  IconSettings,
  IconTeam,
  IconTemplate,
  IconUser,
  IconUsers,
  IconWebhook,
} from "@/components/nav-icons";

const NAV = [
  { href: "/overview", label: "Overview", icon: IconChart },
  { href: "/metrics", label: "Metrics", icon: IconMetrics },
  { href: "/emails", label: "Emails", icon: IconMail },
  { href: "/broadcasts", label: "Broadcasts", icon: IconBroadcast },
  { href: "/audiences", label: "Audiences", icon: IconUsers },
  { href: "/templates", label: "Templates", icon: IconTemplate },
  { href: "/domains", label: "Domains", icon: IconGlobe },
  { href: "/api-keys", label: "API Keys", icon: IconKey },
  { href: "/webhooks", label: "Webhooks", icon: IconWebhook },
  { href: "/suppressions", label: "Suppressions", icon: IconBan },
  { href: "/team", label: "Team", icon: IconTeam },
  { href: "/billing", label: "Billing", icon: IconCard },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export default async function DashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const memberships = await membershipsOf(user.id);
  const setup = user.onboardedAt ? null : await onboardingProgress(team);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        {/* workspace switcher */}
        <div className="p-3">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:bg-surface-3 [&::-webkit-details-marker]:hidden">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-lime font-mono text-xs font-semibold text-on-lime">
                {team.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {team.name}
              </span>
              <IconChevronUpDown className="shrink-0 text-fg-faint" />
            </summary>
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface-3 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
              {memberships.map(({ team: t }) => (
                <form key={t.id} action={switchTeamAction}>
                  <input type="hidden" name="teamId" value={t.id} />
                  <button
                    type="submit"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                      t.id === team.id ? "text-lime" : "text-fg-muted"
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-surface font-mono text-[10px]">
                      {t.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate">{t.name}</span>
                    {t.id === team.id && <span className="ml-auto">✓</span>}
                  </button>
                </form>
              ))}
              <Link
                href="/team"
                className="mt-1 block border-t border-hairline px-3 py-2 text-sm text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                Manage team →
              </Link>
            </div>
          </details>
        </div>

        {/* nav */}
        <nav className="flex-1 space-y-0.5 px-3 pt-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="nav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <Icon className="shrink-0 text-fg-faint transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        {/* finish setup */}
        {setup && (
          <div className="mx-3 my-2 rounded-lg border border-line bg-surface-2 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs font-medium">Get set up</p>
              <form action={completeOnboardingAction}>
                <input type="hidden" name="to" value="/emails" />
                <button
                  type="submit"
                  aria-label="Dismiss setup card"
                  className="-mr-1 -mt-1 rounded px-1 leading-none text-fg-faint transition-colors hover:text-fg"
                >
                  ×
                </button>
              </form>
            </div>
            <div className="mb-2 flex gap-1">
              {[setup.hasDomain, setup.hasApiKey, setup.hasSentEmail].map(
                (done, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      done ? "bg-lime" : "bg-surface-3"
                    }`}
                  />
                ),
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-fg-muted">
                {setup.stepsDone}/3 complete
              </span>
              <Link
                href="/onboarding"
                className="inline-flex items-center rounded-md bg-lime px-2 py-1 text-[11px] font-medium text-on-lime transition-colors hover:bg-lime-hover"
              >
                Continue →
              </Link>
            </div>
          </div>
        )}

        {/* resources */}
        <div className="border-t border-line px-3 py-2">
          <a
            href="/docs"
            target="_blank"
            className="nav-link flex items-center gap-3 rounded-md px-3 py-1.5 text-xs text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconBook className="shrink-0" width={14} height={14} />
            Documentation
          </a>
          <a
            href="https://github.com/emreisik95/sendthen"
            target="_blank"
            rel="noopener"
            className="nav-link flex items-center gap-3 rounded-md px-3 py-1.5 text-xs text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconGitHub className="shrink-0" width={14} height={14} />
            GitHub
          </a>
        </div>

        {/* profile menu */}
        <div className="border-t border-line p-3">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-xs text-fg-muted">
                {user.email.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
                {user.email}
              </span>
              {user.role === "admin" && (
                <span className="rounded bg-lime/14 px-1.5 py-0.5 font-mono text-[10px] text-lime">
                  admin
                </span>
              )}
              <IconChevronUpDown className="shrink-0 text-fg-faint" />
            </summary>
            <div className="absolute bottom-full left-0 right-0 z-20 mb-1 overflow-hidden rounded-lg border border-line bg-surface-3 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
              <div className="border-b border-hairline px-3 py-2">
                <div className="truncate text-sm text-fg">{user.name}</div>
                <div className="truncate font-mono text-xs text-fg-faint">
                  {user.email}
                </div>
              </div>
              <Link
                href="/profile"
                className="nav-link flex items-center gap-2.5 px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <IconUser className="shrink-0 text-fg-faint" />
                Profile
              </Link>
              <Link
                href="/settings"
                className="nav-link flex items-center gap-2.5 px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <IconSettings className="shrink-0 text-fg-faint" />
                Settings
              </Link>
              <Link
                href="/team"
                className="nav-link flex items-center gap-2.5 px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <IconTeam className="shrink-0 text-fg-faint" />
                Team
              </Link>
              <form action={logoutAction} className="border-t border-hairline">
                <button
                  type="submit"
                  className="nav-link flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-danger"
                >
                  <IconLogout className="shrink-0 text-fg-faint" />
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
