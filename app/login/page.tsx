import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { getSessionUser, signupDisabled, userCount } from "@/lib/auth-user";
import { btnPrimary, inputCls } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { error, invite } = await searchParams;
  if (await getSessionUser()) redirect(invite ? `/invite/${invite}` : "/emails");
  if ((await userCount()) === 0) redirect("/signup");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-mono text-2xl font-medium tracking-tight">
            send<span className="text-lime">then</span>
          </Link>
          <p className="mt-2 text-sm text-fg-muted">Sign in to your account</p>
        </div>
        <form
          action={loginAction}
          className="rounded-[10px] border border-line bg-surface p-6"
        >
          {invite && <input type="hidden" name="invite" value={invite} />}
          <label
            htmlFor="email"
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            className={inputCls}
          />
          <label
            htmlFor="password"
            className="mb-2 mt-4 block text-xs font-medium uppercase tracking-wider text-fg-faint"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputCls}
          />
          {error === "1" && (
            <p className="mt-2 text-xs text-danger">Wrong email or password.</p>
          )}
          {error === "signup_disabled" && (
            <p className="mt-2 text-xs text-danger">
              Signups are disabled on this instance.
            </p>
          )}
          <button
            type="submit"
            className={`${btnPrimary} mt-5 w-full justify-center`}
          >
            Sign in
          </button>
        </form>
        {(!signupDisabled() || invite) && (
          <p className="mt-4 text-center text-sm text-fg-muted">
            No account?{" "}
            <Link
              href={invite ? `/signup?invite=${invite}` : "/signup"}
              className="text-lime hover:underline"
            >
              Sign up
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
