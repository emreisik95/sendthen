import { requireUser } from "@/lib/auth-user";
import { changePasswordAction, updateProfileAction } from "@/app/actions";
import { Card, PageHeader, btnPrimary, fmtDate, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  wrong_password: "Current password is incorrect.",
  weak_password: "New password must be at least 8 characters.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { saved, error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" />

      {saved && (
        <Card className="mb-6 border-lime/40 px-4 py-3 text-sm text-lime">
          Profile updated.
        </Card>
      )}
      {error && ERRORS[error] && (
        <Card className="mb-6 border-danger/40 px-4 py-3 text-sm text-danger">
          {ERRORS[error]}
        </Card>
      )}

      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-sm font-medium">Account</h2>
        <form action={updateProfileAction}>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint">
            Name
          </label>
          <input name="name" defaultValue={user.name} className={inputCls} />

          <label className="mb-2 mt-4 block text-xs font-medium uppercase tracking-wider text-fg-faint">
            Email
          </label>
          <input
            value={user.email}
            disabled
            className={`${inputCls} font-mono opacity-60`}
          />
          <p className="mt-1 text-xs text-fg-faint">
            Signed up {fmtDate(user.createdAt)} · role:{" "}
            <span className="font-mono">{user.role}</span>
          </p>

          <button type="submit" className={`${btnPrimary} mt-5`}>
            Save profile
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-medium">Change password</h2>
        <form action={changePasswordAction}>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint">
            Current password
          </label>
          <input
            name="current"
            type="password"
            required
            autoComplete="current-password"
            className={inputCls}
          />
          <label className="mb-2 mt-4 block text-xs font-medium uppercase tracking-wider text-fg-faint">
            New password
          </label>
          <input
            name="next"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
          />
          <button type="submit" className={`${btnPrimary} mt-5`}>
            Change password
          </button>
        </form>
      </Card>
    </div>
  );
}
