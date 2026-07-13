"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SVGProps,
  type SyntheticEvent,
} from "react";
import {
  completeOnboardingAction,
  logoutAction,
  switchTeamAction,
} from "@/app/actions";
import {
  campaignCompanionNavigation,
  configurationNavigation,
  isConfigurationNavigationActive,
  isNavigationItemActive,
  primaryNavigation,
  type DashboardNavigationItem,
} from "@/lib/dashboard-nav";
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

type DashboardShellProps = Readonly<{
  children: ReactNode;
  userSummary: Readonly<{
    name: string;
    email: string;
    role: "admin" | "member";
  }>;
  teamSummary: Readonly<{
    id: string;
    name: string;
  }>;
  membershipSummaries: readonly Readonly<{
    id: string;
    name: string;
  }>[];
  setupSummary: Readonly<{
    domainVerified: boolean;
    hasApiKey: boolean;
    hasSentEmail: boolean;
  }> | null;
}>;

type NavigationIcon = ComponentType<SVGProps<SVGSVGElement>>;
type NavigationKey =
  | (typeof primaryNavigation)[number]["key"]
  | (typeof configurationNavigation)[number]["key"]
  | (typeof campaignCompanionNavigation)[number]["key"];

const navigationIcons: Record<NavigationKey, NavigationIcon> = {
  home: IconChart,
  activity: IconMail,
  campaigns: IconBroadcast,
  templates: IconTemplate,
  analytics: IconMetrics,
  contacts: IconUsers,
  domains: IconGlobe,
  apiKeys: IconKey,
  webhooks: IconWebhook,
  blockedRecipients: IconBan,
  deliveryAndTracking: IconSettings,
};

function DashboardLink({
  item,
  pathname,
  onNavigate,
  secondary = false,
}: {
  item: DashboardNavigationItem;
  pathname: string;
  onNavigate?: () => void;
  secondary?: boolean;
}) {
  const active = isNavigationItemActive(pathname, item.href);
  const Icon = navigationIcons[item.key as NavigationKey];

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`nav-link flex min-h-10 items-center rounded-md transition-colors ${
        secondary
          ? "ml-7 gap-2 border-l border-line px-3 py-1.5 text-xs"
          : "gap-3 px-3 py-2 text-sm"
      } ${
        active
          ? "bg-lime/12 font-medium text-lime"
          : "text-fg-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      <Icon
        className={`shrink-0 transition-colors ${
          active ? "text-lime" : "text-fg-faint"
        }`}
        width={secondary ? 14 : 16}
        height={secondary ? 14 : 16}
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

function DashboardNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const configurationNavigationId = useId();
  const configurationActive = isConfigurationNavigationActive(pathname);
  const [configurationOpen, setConfigurationOpen] =
    useState(configurationActive);

  useEffect(() => {
    if (configurationActive) setConfigurationOpen(true);
  }, [configurationActive]);

  return (
    <nav aria-label="Dashboard" className="space-y-3 px-3 py-2">
      <div className="space-y-0.5">
        {primaryNavigation.map((item) => (
          <div key={item.key}>
            <DashboardLink
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
            {item.key === "campaigns" && (
              <div
                role="group"
                aria-label="Campaigns links"
                className="mt-0.5"
              >
                {campaignCompanionNavigation.map((companion) => (
                  <DashboardLink
                    key={companion.key}
                    item={companion}
                    pathname={pathname}
                    onNavigate={onNavigate}
                    secondary
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-3">
        <button
          type="button"
          aria-expanded={configurationOpen}
          aria-controls={configurationNavigationId}
          onClick={() => setConfigurationOpen(open => !open)}
          className={`flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
            configurationActive
              ? "bg-lime/12 font-medium text-lime"
              : "text-fg-muted hover:bg-surface-2 hover:text-fg"
          }`}
        >
          <IconSettings
            className={`shrink-0 ${
              configurationActive ? "text-lime" : "text-fg-faint"
            }`}
          />
          <span className="flex-1">Configure</span>
          <IconChevronUpDown
            className={`shrink-0 text-fg-faint transition-transform motion-reduce:transition-none ${
              configurationOpen ? "rotate-180" : ""
            }`}
            width={14}
            height={14}
          />
        </button>
        {configurationOpen && (
          <div
            id={configurationNavigationId}
            className="mt-0.5 space-y-0.5"
          >
            {configurationNavigation.map((item) => (
              <DashboardLink
                key={item.key}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
                secondary
              />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function WorkspaceMenu({
  teamSummary,
  membershipSummaries,
  onNavigate,
}: Pick<
  DashboardShellProps,
  "teamSummary" | "membershipSummaries"
> & {
  onNavigate?: () => void;
}) {
  return (
    <div className="p-3">
      <details className="group relative">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:bg-surface-3 [&::-webkit-details-marker]:hidden">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-lime font-mono text-xs font-semibold text-on-lime">
            {teamSummary.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {teamSummary.name}
          </span>
          <IconChevronUpDown className="shrink-0 text-fg-faint" />
        </summary>
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface-3 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <p className="px-3 py-1.5 text-xs font-medium text-fg-faint">
            Workspaces
          </p>
          {membershipSummaries.map((membership) => {
            const active = membership.id === teamSummary.id;

            return (
              <form
                key={membership.id}
                action={switchTeamAction}
                onSubmit={onNavigate}
              >
                <input type="hidden" name="teamId" value={membership.id} />
                <button
                  type="submit"
                  className={`flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                    active ? "text-lime" : "text-fg-muted"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface font-mono text-xs">
                    {membership.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {membership.name}
                  </span>
                  {active && (
                    <>
                      <span aria-hidden="true">✓</span>
                      <span className="sr-only">Current workspace</span>
                    </>
                  )}
                </button>
              </form>
            );
          })}
          <Link
            href="/team"
            onClick={onNavigate}
            className="mt-1 flex min-h-10 items-center border-t border-hairline px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconTeam className="mr-2 shrink-0 text-fg-faint" />
            Manage workspace & members
          </Link>
        </div>
      </details>
    </div>
  );
}

function SetupCard({
  setup,
  onNavigate,
}: {
  setup: DashboardShellProps["setupSummary"];
  onNavigate?: () => void;
}) {
  if (!setup) return null;

  const setupSteps = [
    { label: "Verified domain", complete: setup.domainVerified },
    { label: "API key", complete: setup.hasApiKey },
    { label: "First sent email", complete: setup.hasSentEmail },
  ];
  if (setupSteps.every((step) => step.complete)) return null;

  const completedSteps = setupSteps.filter((step) => step.complete).length;

  return (
    <div className="mx-3 my-2 rounded-lg border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-fg">Finish setup</p>
          <p className="font-mono text-xs text-fg-faint">
            {completedSteps}/3 complete
          </p>
        </div>
        <form action={completeOnboardingAction} onSubmit={onNavigate}>
          <input type="hidden" name="to" value="/overview" />
          <button
            type="submit"
            aria-label="Dismiss setup card"
            className="flex h-10 w-10 items-center justify-center rounded-md text-lg leading-none text-fg-faint transition-colors hover:bg-surface-3 hover:text-fg"
          >
            ×
          </button>
        </form>
      </div>
      <ul className="space-y-1.5">
        {setupSteps.map((step) => (
          <li
            key={step.label}
            className={`flex items-center gap-2 text-xs ${
              step.complete ? "text-fg-muted" : "text-fg"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-xs ${
                step.complete
                  ? "border-lime bg-lime text-on-lime"
                  : "border-line text-transparent"
              }`}
            >
              ✓
            </span>
            {step.label}
          </li>
        ))}
      </ul>
      <Link
        href="/onboarding"
        onClick={onNavigate}
        className="mt-3 flex min-h-10 items-center justify-center rounded-md bg-lime px-3 py-2 text-xs font-medium text-on-lime transition-colors hover:bg-lime-hover"
      >
        Continue setup
      </Link>
    </div>
  );
}

function ResourceLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="border-t border-line px-3 py-2">
      <Link
        href="/docs"
        target="_blank"
        onClick={onNavigate}
        className="nav-link flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-xs text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <IconBook className="shrink-0" width={14} height={14} />
        Documentation
      </Link>
      <a
        href="https://github.com/emreisik95/sendthen"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="nav-link flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-xs text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <IconGitHub className="shrink-0" width={14} height={14} />
        GitHub
      </a>
    </div>
  );
}

function AccountMenu({
  userSummary,
  onNavigate,
}: Pick<DashboardShellProps, "userSummary"> & {
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-line p-3">
      <details className="group relative">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-xs text-fg-muted">
            {userSummary.email.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
            {userSummary.email}
          </span>
          {userSummary.role === "admin" && (
            <span className="rounded bg-lime/14 px-1.5 py-0.5 font-mono text-xs text-lime">
              admin
            </span>
          )}
          <IconChevronUpDown className="shrink-0 text-fg-faint" />
        </summary>
        <div className="absolute bottom-full left-0 right-0 z-20 mb-1 overflow-hidden rounded-lg border border-line bg-surface-3 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="border-b border-hairline px-3 py-2">
            <div className="truncate text-sm text-fg">{userSummary.name}</div>
            <div className="truncate font-mono text-xs text-fg-faint">
              {userSummary.email}
            </div>
          </div>
          <Link
            href="/profile"
            onClick={onNavigate}
            className="nav-link flex min-h-10 items-center gap-2.5 px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconUser className="shrink-0 text-fg-faint" />
            Profile
          </Link>
          <Link
            href="/billing"
            onClick={onNavigate}
            className="nav-link flex min-h-10 items-center gap-2.5 px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconCard className="shrink-0 text-fg-faint" />
            Billing
          </Link>
          <form
            action={logoutAction}
            onSubmit={onNavigate}
            className="border-t border-hairline"
          >
            <button
              type="submit"
              className="nav-link flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <IconLogout className="shrink-0 text-fg-faint" />
              Sign out
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

function SidebarContent({
  userSummary,
  teamSummary,
  membershipSummaries,
  setupSummary,
  pathname,
  onNavigate,
}: Omit<DashboardShellProps, "children"> & {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkspaceMenu
        teamSummary={teamSummary}
        membershipSummaries={membershipSummaries}
        onNavigate={onNavigate}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DashboardNavigation pathname={pathname} onNavigate={onNavigate} />
      </div>
      <SetupCard setup={setupSummary} onNavigate={onNavigate} />
      <ResourceLinks onNavigate={onNavigate} />
      <AccountMenu userSummary={userSummary} onNavigate={onNavigate} />
    </div>
  );
}

export function DashboardShell({
  children,
  userSummary,
  teamSummary,
  membershipSummaries,
  setupSummary,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusAfterCloseRef = useRef(false);
  const previousPathnameRef = useRef(pathname);

  const closeMobileNavigation = useCallback((restoreFocus: boolean) => {
    restoreFocusAfterCloseRef.current = restoreFocus;
    setMobileNavigationOpen(false);
  }, []);

  const dismissMobileNavigation = useCallback(() => {
    closeMobileNavigation(true);
  }, [closeMobileNavigation]);

  const closeMobileNavigationWithoutFocus = useCallback(() => {
    closeMobileNavigation(false);
  }, [closeMobileNavigation]);

  const openMobileNavigation = useCallback(() => {
    restoreFocusAfterCloseRef.current = false;
    setMobileNavigationOpen(true);
  }, []);

  const handleDialogCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      dismissMobileNavigation();
    },
    [dismissMobileNavigation],
  );

  const handleDialogBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) dismissMobileNavigation();
    },
    [dismissMobileNavigation],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (mobileNavigationOpen) {
      if (!dialog.open) dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [mobileNavigationOpen]);

  useEffect(() => {
    if (!mobileNavigationOpen) return;

    const previousDocumentOverflow =
      document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.overflow = previousBodyOverflow;

      const shouldRestoreFocus = restoreFocusAfterCloseRef.current;
      restoreFocusAfterCloseRef.current = false;
      if (shouldRestoreFocus) {
        const closingPathname = pathname;
        requestAnimationFrame(() => {
          const desktopNavigationVisible = window.matchMedia(
            "(min-width: 1024px)",
          ).matches;
          if (
            !desktopNavigationVisible &&
            previousPathnameRef.current === closingPathname
          ) {
            menuButtonRef.current?.focus();
          }
        });
      }
    };
  }, [mobileNavigationOpen, pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeMobileNavigation(false);
    };

    if (mediaQuery.matches) closeMobileNavigation(false);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleBreakpointChange);
      return () =>
        mediaQuery.removeEventListener("change", handleBreakpointChange);
    }

    mediaQuery.addListener(handleBreakpointChange);
    return () => mediaQuery.removeListener(handleBreakpointChange);
  }, [closeMobileNavigation]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      closeMobileNavigation(false);
    }
  }, [closeMobileNavigation, pathname]);

  const handleDialogClose = useCallback(() => {
    setMobileNavigationOpen(false);
  }, []);

  const sidebarProps = {
    userSummary,
    teamSummary,
    membershipSummaries,
    setupSummary,
    pathname,
  };

  return (
    <>
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[70] -translate-y-24 rounded-md bg-lime px-4 py-2 text-sm font-semibold text-on-lime transition-transform focus:translate-y-0 motion-reduce:transition-none"
      >
        Skip to main content
      </a>

      <div className="min-h-screen lg:flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
          <SidebarContent key={`desktop-${pathname}`} {...sidebarProps} />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm lg:hidden">
            <div className="min-w-0">
              <p className="text-xs text-fg-faint">Workspace</p>
              <p className="truncate text-sm font-medium">{teamSummary.name}</p>
            </div>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation"
              aria-controls="mobile-dashboard-navigation"
              aria-expanded={mobileNavigationOpen}
              onClick={openMobileNavigation}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              Menu
            </button>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            {children}
          </main>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        id="mobile-dashboard-navigation"
        aria-modal="true"
        aria-label="Dashboard navigation"
        onCancel={handleDialogCancel}
        onClose={handleDialogClose}
        onClick={handleDialogBackdropClick}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-3rem))] max-w-none overflow-hidden border-0 border-r border-line bg-surface p-0 text-fg shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop:bg-black/70 lg:hidden"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex min-h-14 items-center justify-between border-b border-line px-3">
            <span className="text-sm font-medium">Navigation</span>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close navigation"
              onClick={dismissMobileNavigation}
              className="flex h-10 w-10 items-center justify-center rounded-md text-xl leading-none text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <SidebarContent
              key={`mobile-${pathname}`}
              {...sidebarProps}
              onNavigate={closeMobileNavigationWithoutFocus}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}
