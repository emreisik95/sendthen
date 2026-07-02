import Link from "next/link";
import { requireUser } from "@/lib/auth-user";
import { logoutAction } from "@/app/actions";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/emails", label: "Emails" },
  { href: "/broadcasts", label: "Broadcasts" },
  { href: "/audiences", label: "Audiences" },
  { href: "/templates", label: "Templates" },
  { href: "/domains", label: "Domains" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/suppressions", label: "Suppressions" },
  { href: "/settings", label: "Settings" },
];

export default async function DashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-5 py-5">
          <Link href="/emails" className="font-mono text-lg font-medium">
            send<span className="text-lime">then</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="truncate px-3 pb-1 text-xs text-fg-faint">
            {user.email}
            {user.role === "admin" && (
              <span className="ml-1.5 rounded bg-lime/14 px-1.5 py-0.5 font-mono text-[10px] text-lime">
                admin
              </span>
            )}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
