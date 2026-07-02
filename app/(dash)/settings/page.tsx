import { eq } from "drizzle-orm";
import { db, userSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { mailMode } from "@/lib/mailer";
import { secretHint } from "@/lib/crypto";
import { saveSettingsAction } from "@/app/actions";
import { Card, PageHeader, btnPrimary, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { saved } = await searchParams;
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.teamId, team.id));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <p className="mb-6 text-sm text-fg-muted">
        Transport and tracking for the{" "}
        <span className="text-fg">{team.name}</span> team.
      </p>
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

          <SecretField
            name="smtpUrl"
            label="SMTP URL"
            placeholder="smtp://user:pass@smtp.example.com:587"
            stored={settings?.smtpUrl}
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

          <SecretField
            name="sesSecretAccessKey"
            label="SES secret access key"
            placeholder=""
            stored={settings?.sesSecretAccessKey}
          />
          <p className="mt-3 text-xs text-fg-faint">
            Secrets are write-only: they&apos;re stored encrypted and never
            shown again. Leave a field empty to keep the current value.
          </p>
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

function SecretField({
  name,
  label,
  placeholder,
  stored,
}: {
  name: string;
  label: string;
  placeholder: string;
  stored: string | null | undefined;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-medium uppercase tracking-wider text-fg-faint">
          {label}
        </label>
        {stored && (
          <span className="flex items-center gap-2 font-mono text-xs text-fg-faint">
            <span className="text-lime">set</span> {secretHint(stored)}
            <label className="flex cursor-pointer items-center gap-1 text-danger">
              <input type="checkbox" name={`${name}Clear`} className="accent-[#FF4D4D]" />
              clear
            </label>
          </span>
        )}
      </div>
      <input
        name={name}
        type="password"
        autoComplete="off"
        placeholder={stored ? "•••••••• (unchanged)" : placeholder}
        className={`${inputCls} font-mono`}
      />
    </div>
  );
}
