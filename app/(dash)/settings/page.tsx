import { eq } from "drizzle-orm";
import { db, userSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { mailMode } from "@/lib/mailer";
import { saveSettingsAction } from "@/app/actions";
import { Card, PageHeader, btnPrimary, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const { saved } = await searchParams;
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      {saved && (
        <Card className="mb-6 border-lime/40 px-4 py-3 text-sm text-lime">
          Settings saved.
        </Card>
      )}

      <form action={saveSettingsAction} className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-1 text-sm font-medium">Mail provider</h2>
          <p className="mb-4 text-xs text-fg-muted">
            How your emails are delivered. &ldquo;Instance default&rdquo;
            follows the server configuration (currently{" "}
            <code className="font-mono text-fg">{mailMode()}</code>).
          </p>
          <select
            name="mailMode"
            defaultValue={settings?.mailMode ?? "inherit"}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
          >
            <option value="inherit">Instance default</option>
            <option value="sandbox">Sandbox — capture locally, no network</option>
            <option value="smtp">SMTP relay</option>
            <option value="ses">Amazon SES</option>
          </select>

          <label className="mb-2 mt-5 block text-xs font-medium uppercase tracking-wider text-fg-faint">
            SMTP URL
          </label>
          <input
            name="smtpUrl"
            placeholder="smtp://user:pass@smtp.example.com:587"
            defaultValue={settings?.smtpUrl ?? ""}
            className={`${inputCls} font-mono`}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint">
                SES region
              </label>
              <input
                name="sesRegion"
                placeholder="eu-west-1"
                defaultValue={settings?.sesRegion ?? ""}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint">
                SES access key ID
              </label>
              <input
                name="sesAccessKeyId"
                defaultValue={settings?.sesAccessKeyId ?? ""}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
          <label className="mb-2 mt-4 block text-xs font-medium uppercase tracking-wider text-fg-faint">
            SES secret access key
          </label>
          <input
            name="sesSecretAccessKey"
            type="password"
            defaultValue={settings?.sesSecretAccessKey ?? ""}
            className={`${inputCls} font-mono`}
          />
        </Card>

        <Card className="p-6">
          <h2 className="mb-1 text-sm font-medium">Tracking</h2>
          <p className="mb-4 text-xs text-fg-muted">
            Adds an open pixel and rewrites links through this server. Requires{" "}
            <code className="font-mono text-fg">SENDTHEN_PUBLIC_URL</code> to
            be set.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="trackOpens"
              defaultChecked={settings?.trackOpens ?? false}
              className="accent-[#C6FF00]"
            />
            Track opens
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="trackClicks"
              defaultChecked={settings?.trackClicks ?? false}
              className="accent-[#C6FF00]"
            />
            Track clicks
          </label>
        </Card>

        <button type="submit" className={btnPrimary}>
          Save settings
        </button>
      </form>
    </div>
  );
}
