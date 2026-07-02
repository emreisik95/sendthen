import { eq } from "drizzle-orm";
import { db, userSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { mailMode } from "@/lib/mailer";
import { publicUrl } from "@/lib/tracking";
import { secretHint } from "@/lib/crypto";
import { saveSettingsAction } from "@/app/actions";
import { SettingsForm } from "@/components/settings/settings-form";

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

  const base = publicUrl();

  return (
    <SettingsForm
      initial={{
        mailMode: settings?.mailMode ?? "inherit",
        smtpUrl: settings?.smtpUrl
          ? { set: true, hint: secretHint(settings.smtpUrl) }
          : null,
        sesAccessKeyId: settings?.sesAccessKeyId ?? "",
        sesRegion: settings?.sesRegion ?? "",
        sesSecret: settings?.sesSecretAccessKey
          ? { set: true, hint: secretHint(settings.sesSecretAccessKey) }
          : null,
        trackOpens: settings?.trackOpens ?? false,
        trackClicks: settings?.trackClicks ?? false,
      }}
      instanceMode={mailMode()}
      trackingReady={base !== null}
      isAdmin={user.role === "admin"}
      feedbackUrl={base ? `${base}/api/ses/feedback` : null}
      teamName={team.name}
      saved={saved === "1"}
      action={saveSettingsAction}
    />
  );
}
