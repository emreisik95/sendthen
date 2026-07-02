"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  apiKeys,
  audiences,
  broadcasts,
  contacts,
  domains,
  suppressions,
  templates,
  userSettings,
  users,
  webhooks,
} from "@/lib/db";
import { sendBroadcast } from "@/lib/broadcast";
import { SendError } from "@/lib/send-email";
import {
  createUserSession,
  destroyUserSession,
  registerUser,
  requireUser,
  signupDisabled,
  userCount,
  verifyPassword,
} from "@/lib/auth-user";
import { hashToken } from "@/lib/api-auth";
import {
  newApiKeyId,
  newApiToken,
  newAudienceId,
  newBroadcastId,
  newContactId,
  newDomainId,
  newSettingsId,
  newSuppressionId,
  newTemplateId,
  newWebhookId,
  newWebhookSecret,
} from "@/lib/id";
import { generateDkimKeyPair } from "@/lib/dkim";
import { verifyDomain } from "@/lib/dns-verify";

/* ---------- auth ---------- */

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=1");
  }
  await createUserSession(user.id);
  redirect("/emails");
}

export async function signupAction(formData: FormData): Promise<void> {
  const isFirst = (await userCount()) === 0;
  if (signupDisabled() && !isFirst) redirect("/login?error=signup_disabled");

  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/signup?error=invalid_email");
  }
  if (password.length < 8) redirect("/signup?error=weak_password");

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (existing) redirect("/signup?error=exists");

  const user = await registerUser(email, name || email.split("@")[0], password);
  await createUserSession(user.id);
  redirect("/emails");
}

export async function logoutAction(): Promise<void> {
  await destroyUserSession();
  redirect("/login");
}

/* ---------- domains ---------- */

export async function createDomainAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "")
    .trim()
    .toLowerCase();
  if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(name)) {
    redirect("/domains?error=invalid");
  }
  const [existing] = await db
    .select()
    .from(domains)
    .where(eq(domains.name, name));
  if (existing) {
    redirect(
      existing.userId === user.id
        ? `/domains/${existing.id}`
        : "/domains?error=taken",
    );
  }

  const { privateKey, publicKey } = generateDkimKeyPair();
  const id = newDomainId();
  await db.insert(domains).values({
    id,
    userId: user.id,
    name,
    dkimPrivateKey: privateKey,
    dkimPublicKey: publicKey,
    createdAt: new Date(),
  });
  redirect(`/domains/${id}`);
}

export async function verifyDomainAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.userId, user.id)));
  if (domain) await verifyDomain(domain);
  redirect(`/domains/${id}`);
}

export async function deleteDomainAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await db
    .delete(domains)
    .where(and(eq(domains.id, id), eq(domains.userId, user.id)));
  redirect("/domains");
}

/* ---------- api keys ---------- */

export async function createApiKeyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "default";
  const permission =
    formData.get("permission") === "sending" ? "sending" : "full";
  const token = newApiToken();
  await db.insert(apiKeys).values({
    id: newApiKeyId(),
    userId: user.id,
    name,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 12),
    permission,
    createdAt: new Date(),
  });
  // token shown exactly once on the redirect target
  redirect(`/api-keys?token=${token}`);
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.userId, user.id),
        isNull(apiKeys.revokedAt),
      ),
    );
  redirect("/api-keys");
}

/* ---------- webhooks ---------- */

export async function createWebhookAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  const events = formData.getAll("events").map(String);
  try {
    new URL(url);
  } catch {
    redirect("/webhooks?error=invalid_url");
  }
  if (events.length === 0) redirect("/webhooks?error=no_events");
  await db.insert(webhooks).values({
    id: newWebhookId(),
    userId: user.id,
    url,
    secret: newWebhookSecret(),
    events,
    createdAt: new Date(),
  });
  redirect("/webhooks");
}

export async function toggleWebhookAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const [hook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, user.id)));
  if (hook) {
    await db
      .update(webhooks)
      .set({ enabled: !hook.enabled })
      .where(eq(webhooks.id, id));
  }
  redirect("/webhooks");
}

export async function deleteWebhookAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, user.id)));
  redirect("/webhooks");
}

/* ---------- settings ---------- */

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const mode = String(formData.get("mailMode") ?? "inherit");
  const values = {
    mailMode: (["inherit", "sandbox", "smtp", "ses"].includes(mode)
      ? mode
      : "inherit") as "inherit" | "sandbox" | "smtp" | "ses",
    smtpUrl: String(formData.get("smtpUrl") ?? "").trim() || null,
    sesAccessKeyId:
      String(formData.get("sesAccessKeyId") ?? "").trim() || null,
    sesSecretAccessKey:
      String(formData.get("sesSecretAccessKey") ?? "").trim() || null,
    sesRegion: String(formData.get("sesRegion") ?? "").trim() || null,
    trackOpens: formData.get("trackOpens") === "on",
    trackClicks: formData.get("trackClicks") === "on",
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: userSettings.id })
    .from(userSettings)
    .where(eq(userSettings.userId, user.id));
  if (existing) {
    await db
      .update(userSettings)
      .set(values)
      .where(eq(userSettings.id, existing.id));
  } else {
    await db.insert(userSettings).values({
      id: newSettingsId(),
      userId: user.id,
      ...values,
    });
  }
  redirect("/settings?saved=1");
}

/* ---------- suppressions ---------- */

export async function addSuppressionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  if (email) {
    await db
      .insert(suppressions)
      .values({
        id: newSuppressionId(),
        userId: user.id,
        email,
        reason: "manual",
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
  redirect("/suppressions");
}

export async function removeSuppressionAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await db
    .delete(suppressions)
    .where(and(eq(suppressions.id, id), eq(suppressions.userId, user.id)));
  redirect("/suppressions");
}

/* ---------- templates ---------- */

export async function saveTemplateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const values = {
    name: String(formData.get("name") ?? "").trim() || "untitled",
    subject: String(formData.get("subject") ?? "").trim(),
    html: String(formData.get("html") ?? "") || null,
    text: String(formData.get("text") ?? "") || null,
    updatedAt: new Date(),
  };
  if (id) {
    await db
      .update(templates)
      .set(values)
      .where(and(eq(templates.id, id), eq(templates.userId, user.id)));
    redirect(`/templates`);
  }
  await db.insert(templates).values({
    id: newTemplateId(),
    userId: user.id,
    ...values,
    createdAt: new Date(),
  });
  redirect("/templates");
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)));
  redirect("/templates");
}

/* ---------- audiences & contacts ---------- */

export async function createAudienceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/audiences");
  const id = newAudienceId();
  await db.insert(audiences).values({
    id,
    userId: user.id,
    name,
    createdAt: new Date(),
  });
  redirect(`/audiences/${id}`);
}

export async function deleteAudienceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await db
    .delete(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.userId, user.id)));
  redirect("/audiences");
}

async function ownedAudience(audienceId: string, userId: string) {
  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, audienceId), eq(audiences.userId, userId)));
  return audience;
}

export async function addContactAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const audienceId = String(formData.get("audienceId"));
  if (!(await ownedAudience(audienceId, user.id))) redirect("/audiences");
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  if (email) {
    await db
      .insert(contacts)
      .values({
        id: newContactId(),
        audienceId,
        email,
        firstName: String(formData.get("firstName") ?? "").trim() || null,
        lastName: String(formData.get("lastName") ?? "").trim() || null,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
  redirect(`/audiences/${audienceId}`);
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const audienceId = String(formData.get("audienceId"));
  if (!(await ownedAudience(audienceId, user.id))) redirect("/audiences");
  await db
    .delete(contacts)
    .where(
      and(
        eq(contacts.id, String(formData.get("id"))),
        eq(contacts.audienceId, audienceId),
      ),
    );
  redirect(`/audiences/${audienceId}`);
}

/* ---------- broadcasts ---------- */

export async function createBroadcastAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const audienceId = String(formData.get("audienceId"));
  if (!(await ownedAudience(audienceId, user.id))) {
    redirect("/broadcasts?error=no_audience");
  }
  const from = String(formData.get("from") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const html = String(formData.get("html") ?? "");
  if (!from || !subject || !html) redirect("/broadcasts?error=missing");
  await db.insert(broadcasts).values({
    id: newBroadcastId(),
    userId: user.id,
    audienceId,
    from,
    subject,
    html,
    createdAt: new Date(),
  });
  redirect("/broadcasts");
}

export async function sendBroadcastAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.userId, user.id)));
  if (broadcast) {
    try {
      await sendBroadcast(broadcast);
    } catch (err) {
      if (!(err instanceof SendError)) throw err;
      redirect(`/broadcasts?error=${err.code}`);
    }
  }
  redirect("/broadcasts");
}

export async function deleteBroadcastAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await db
    .delete(broadcasts)
    .where(
      and(
        eq(broadcasts.id, id),
        eq(broadcasts.userId, user.id),
        eq(broadcasts.status, "draft"),
      ),
    );
  redirect("/broadcasts");
}
