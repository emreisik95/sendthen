import Link from "next/link";
import { redirect } from "next/navigation";
import {
  changeAdminUserRoleAction,
  deleteAdminUserAction,
} from "@/app/admin-actions";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusPill,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "@/components/ui";
import { IconUsers } from "@/components/nav-icons";
import { loadAdminDashboard } from "@/lib/admin";
import { requireUser } from "@/lib/auth-user";

export const dynamic = "force-dynamic";

const NOTICE_MESSAGES = {
  role_updated: "The user's instance role was updated.",
  role_unchanged: "That user already has the selected role.",
  user_deleted: "The user account and its owned resources were deleted.",
} as const;

const ERROR_MESSAGES = {
  forbidden: "Administrator access is required for that action.",
  invalid_role: "Choose either the admin or member role.",
  not_found: "That user no longer exists.",
  self_management: "You cannot change or delete your own account here.",
  final_admin: "The final administrator cannot be removed or demoted.",
} as const;

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const joinedDate = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: SearchValue;
    notice?: SearchValue;
    error?: SearchValue;
  }>;
}) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/overview");

  const params = await searchParams;
  const q = first(params.q).trim().slice(0, 200);
  const notice = first(params.notice);
  const error = first(params.error);
  const noticeMessage = NOTICE_MESSAGES[notice as keyof typeof NOTICE_MESSAGES];
  const errorMessage = ERROR_MESSAGES[error as keyof typeof ERROR_MESSAGES];
  const dashboard = await loadAdminDashboard(user.id, q);
  const { summary } = dashboard;
  const totals = [
    { label: "Users", value: summary.users.toLocaleString("en") },
    { label: "Admins", value: summary.admins.toLocaleString("en") },
    { label: "Workspaces", value: summary.workspaces.toLocaleString("en") },
    {
      label: "Verified domains",
      value: `${summary.verifiedDomains.toLocaleString("en")}/${summary.domains.toLocaleString("en")}`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lime">
        Instance administration
      </div>
      <PageHeader title="User management">
        <span className="rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 font-mono text-xs text-lime">
          admin access
        </span>
      </PageHeader>

      {noticeMessage && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok"
        >
          {noticeMessage}
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {errorMessage}
        </div>
      )}

      <section aria-label="Instance totals" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.map((total) => (
          <Card key={total.label} className="px-4 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
              {total.label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">
              {total.value}
            </div>
          </Card>
        ))}
      </section>

      <Card className="mb-6 p-4">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="admin-search"
              className="mb-1.5 block text-xs font-medium text-fg-muted"
            >
              Search users, emails, workspaces, or domains
            </label>
            <input
              id="admin-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="ada@example.com or mail.example.com"
              className={inputCls}
            />
          </div>
          <button type="submit" className={btnPrimary}>
            Search
          </button>
          {q && (
            <Link href="/admin" className={btnSecondary}>
              Clear
            </Link>
          )}
        </form>
      </Card>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-fg">All users</h2>
          <p className="mt-1 text-xs text-fg-muted">
            {q
              ? `${dashboard.users.length} matching ${dashboard.users.length === 1 ? "user" : "users"}`
              : `${dashboard.users.length} total ${dashboard.users.length === 1 ? "user" : "users"}`}
          </p>
        </div>
      </div>

      {dashboard.users.length === 0 ? (
        <EmptyState
          icon={<IconUsers />}
          title="No users match your search"
          description="Try a different name, email address, workspace, or domain."
        >
          <Link href="/admin" className={btnSecondary}>
            Clear search
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {dashboard.users.map((account) => (
            <Card key={account.id} className="overflow-hidden">
              <article aria-labelledby={`user-${account.id}`}>
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 id={`user-${account.id}`} className="truncate text-sm font-semibold text-fg">
                        {account.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                          account.role === "admin"
                            ? "bg-lime/14 text-lime"
                            : "bg-surface-3 text-fg-muted"
                        }`}
                      >
                        {account.role}
                      </span>
                      {account.isCurrent && (
                        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-fg-muted">
                          You
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-fg-muted">
                      {account.email}
                    </p>
                    <p className="mt-1 text-[11px] text-fg-faint">
                      Joined {joinedDate.format(account.createdAt)} · {account.workspaces.length}{" "}
                      {account.workspaces.length === 1 ? "workspace" : "workspaces"}
                    </p>
                  </div>

                  {account.isCurrent ? (
                    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-fg-muted">
                      Current account is protected
                    </div>
                  ) : (
                    <div className="w-full shrink-0 space-y-2 lg:w-auto lg:min-w-72">
                      <form
                        action={changeAdminUserRoleAction}
                        className="flex flex-col gap-2 sm:flex-row sm:items-end"
                      >
                        <input type="hidden" name="targetId" value={account.id} />
                        <input type="hidden" name="q" value={q} />
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={`role-${account.id}`}
                            className="mb-1 block text-[11px] text-fg-muted"
                          >
                            Instance role
                          </label>
                          <select
                            id={`role-${account.id}`}
                            name="role"
                            defaultValue={account.role}
                            className={`${inputCls} min-h-10`}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <button type="submit" className={btnSecondary}>
                          Update role
                        </button>
                      </form>

                      <details className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-danger">
                          Delete account
                        </summary>
                        <div className="pt-3">
                          <p className="mb-3 max-w-sm text-xs leading-relaxed text-fg-muted">
                            Resources created by this user will be removed. Empty workspaces are deleted; shared workspaces remain and receive a new owner when needed.
                          </p>
                          <form action={deleteAdminUserAction}>
                            <input type="hidden" name="targetId" value={account.id} />
                            <input type="hidden" name="q" value={q} />
                            <button type="submit" className={btnDanger}>
                              Permanently delete {account.name}
                            </button>
                          </form>
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                <div className="border-t border-hairline bg-bg/30 px-4 py-3">
                  {account.workspaces.length === 0 ? (
                    <p className="text-xs text-fg-faint">No workspaces</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {account.workspaces.map((workspace) => (
                        <section
                          key={workspace.id}
                          aria-label={`${workspace.name} domains`}
                          className="rounded-lg border border-line bg-surface px-3 py-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <h4 className="truncate text-xs font-medium text-fg">
                              {workspace.name}
                            </h4>
                            <span className="shrink-0 font-mono text-[10px] text-fg-faint">
                              {workspace.role}
                            </span>
                          </div>
                          {workspace.domains.length === 0 ? (
                            <p className="text-[11px] text-fg-faint">No domains</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {workspace.domains.map((domain) => (
                                <li key={domain.id} className="flex min-w-0 items-center justify-between gap-2">
                                  <span className="truncate font-mono text-[11px] text-fg-muted" title={domain.name}>
                                    {domain.name}
                                  </span>
                                  <StatusPill status={domain.status} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
