import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signupAction } from "@/app/actions";
import { getSessionUser, signupDisabled, userCount } from "@/lib/auth-user";
import { btnPrimary, inputCls } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sign up",
};

const ERRORS: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  weak_password: "Password must be at least 8 characters.",
  exists: "An account with this email already exists.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { error, invite } = await searchParams;
  if (await getSessionUser()) redirect(invite ? `/invite/${invite}` : "/emails");
  const isFirst = (await userCount()) === 0;
  if (signupDisabled() && !isFirst && !invite) {
    redirect("/login?error=signup_disabled");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-mono text-2xl font-medium tracking-tight">
            send<span className="text-lime">then</span>
          </Link>
          <p className="mt-2 text-sm text-fg-muted">
            {isFirst
              ? "Create the admin account for this instance"
              : invite
                ? "Create your account to join the team"
                : "Create your account"}
          </p>
        </div>
        <form
          action={signupAction}
          className="rounded-[10px] border border-line bg-surface p-6"
        >
          {invite && <input type="hidden" name="invite" value={invite} />}
          <label
            htmlFor="name"
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint"
          >
            Name
          </label>
          <input id="name" name="name" autoFocus className={inputCls} />
          <label
            htmlFor="email"
            className="mb-2 mt-4 block text-xs font-medium uppercase tracking-wider text-fg-faint"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
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
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
          />
          {error && ERRORS[error] && (
            <p className="mt-2 text-xs text-danger">{ERRORS[error]}</p>
          )}
          <button
            type="submit"
            className={`${btnPrimary} mt-5 w-full justify-center`}
          >
            {isFirst ? "Create admin account" : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-fg-muted">
          Have an account?{" "}
          <Link
            href={invite ? `/login?invite=${invite}` : "/login"}
            className="text-lime hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
