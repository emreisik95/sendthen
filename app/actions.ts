"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull, ne } from "drizzle-orm";
import {
  db,
  apiKeys,
  audiences,
  broadcasts,
  contacts,
  domains,
  invites,
  suppressions,
  teamMembers,
  teams,
  templates,
  userSettings,
  users,
  webhooks,
  type Team,
  type User,
} from "@/lib/db";
import {
  createUserSession,
  destroyUserSession,
  registerUser,
  requireUser,
  signupDisabled,
  userCount,
  verifyPassword,
} from "@/lib/auth-user";
import {
  createTeam,
  getActiveTeam,
  isMember,
  setActiveTeamCookie,
} from "@/lib/team";
import { sendBroadcast } from "@/lib/broadcast";
import { SendError } from "@/lib/send-email";
import { hashToken } from "@/lib/api-auth";
import { encryptSecret } from "@/lib/crypto";
import {
  newApiKeyId,
  newApiToken,
  newAudienceId,
  newBroadcastId,
  newContactId,
  newDomainId,
  newInviteId,
  newInviteToken,
  newMemberId,
  newSettingsId,
  newSuppressionId,
  newTemplateId,
  newWebhookId,
  newWebhookSecret,
} from "@/lib/id";
import { generateDkimKeyPair } from "@/lib/dkim";
import { verifyDomain } from "@/lib/dns-verify";

async function activeContext(): Promise<{
  user: User;
  team: Team;
  role: "owner" | "member";
}> {
  const user = await requireUser();
  const { team, role } = await getActiveTeam(user);
  return { user, team, role };
}

/* ---------- auth ---------- */

async function acceptInviteToken(
  token: string,
  userId: string,
): Promise<void> {
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.acceptedAt)));
  if (!invite) return;
  await db
    .insert(teamMembers)
    .values({
      id: newMemberId(),
      teamId: invite.teamId,
      userId,
      role: invite.role,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.id, invite.id));
  await setActiveTeamCookie(invite.teamId);
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");
  const invite = String(formData.get("invite") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect(`/login?error=1${invite ? `&invite=${invite}` : ""}`);
  }
  await createUserSession(user.id);
  if (invite) await acceptInviteToken(invite, user.id);
  redirect("/emails");
}

export async function signupAction(formData: FormData): Promise<void> {
  const invite = String(formData.get("invite") ?? "");
  const isFirst = (await userCount()) === 0;
  if (signupDisabled() && !isFirst && !invite) {
    redirect("/login?error=signup_disabled");
  }

  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const back = invite ? `&invite=${invite}` : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(`/signup?error=invalid_email${back}`);
  }
  if (password.length < 8) redirect(`/signup?error=weak_password${back}`);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (existing) redirect(`/signup?error=exists${back}`);

  const user = await registerUser(email, name || email.split("@")[0], password);
  await createUserSession(user.id);
  if (invite) await acceptInviteToken(invite, user.id);
  redirect("/emails");
}

export async function logoutAction(): Promise<void> {
  await destroyUserSession();
  redirect("/login");
}

/* ---------- teams ---------- */

export async function switchTeamAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const teamId = String(formData.get("teamId"));
  if (await isMember(teamId, user.id)) {
    await setActiveTeamCookie(teamId);
  }
  redirect("/emails");
}

export async function createTeamAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/team");
  const team = await createTeam(name, user.id);
  await setActiveTeamCookie(team.id);
  redirect("/team");
}

export async function renameTeamAction(formData: FormData): Promise<void> {
  const { team, role } = await activeContext();
  if (role !== "owner") redirect("/team?error=owner_only");
  const name = String(formData.get("name") ?? "").trim();
  if (name) {
    await db.update(teams).set({ name }).where(eq(teams.id, team.id));
  }
  redirect("/team");
}

export async function createInviteAction(formData: FormData): Promise<void> {
  const { team, role } = await activeContext();
  if (role !== "owner") redirect("/team?error=owner_only");
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  if (!email) redirect("/team");
  const token = newInviteToken();
  await db.insert(invites).values({
    id: newInviteId(),
    teamId: team.id,
    email,
    role: "member",
    token,
    createdAt: new Date(),
  });
  redirect(`/team?invited=${token}`);
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const { team, role } = await activeContext();
  if (role !== "owner") redirect("/team?error=owner_only");
  await db
    .delete(invites)
    .where(
      and(
        eq(invites.id, String(formData.get("id"))),
        eq(invites.teamId, team.id),
      ),
    );
  redirect("/team");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const { user, team, role } = await activeContext();
  if (role !== "owner") redirect("/team?error=owner_only");
  const memberId = String(formData.get("id"));
  // owner cannot remove themself (delete the team instead — not offered yet)
  await db
    .delete(teamMembers)
    .where(
      and(
        eq(teamMembers.id, memberId),
        eq(teamMembers.teamId, team.id),
        ne(teamMembers.userId, user.id),
      ),
    );
  redirect("/team");
}

/* ---------- domains ---------- */

export async function createDomainAction(formData: FormData): Promise<void> {
  const { user, team } = await activeContext();
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
      existing.teamId === team.id
        ? `/domains/${existing.id}`
        : "/domains?error=taken",
    );
  }

  const { privateKey, publicKey } = generateDkimKeyPair();
  const id = newDomainId();
  await db.insert(domains).values({
    id,
    userId: user.id,
    teamId: team.id,
    name,
    dkimPrivateKey: privateKey,
    dkimPublicKey: publicKey,
    createdAt: new Date(),
  });
  redirect(`/domains/${id}`);
}

export async function verifyDomainAction(formData: FormData): Promise<void> {
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.teamId, team.id)));
  if (domain) await verifyDomain(domain);
  redirect(`/domains/${id}`);
}

export async function deleteDomainAction(formData: FormData): Promise<void> {
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  await db
    .delete(domains)
    .where(and(eq(domains.id, id), eq(domains.teamId, team.id)));
  redirect("/domains");
}

/* ---------- api keys ---------- */

export async function createApiKeyAction(formData: FormData): Promise<void> {
  const { user, team } = await activeContext();
  const name = String(formData.get("name") ?? "").trim() || "default";
  const permission =
    formData.get("permission") === "sending" ? "sending" : "full";
  const token = newApiToken();
  await db.insert(apiKeys).values({
    id: newApiKeyId(),
    userId: user.id,
    teamId: team.id,
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
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.teamId, team.id),
        isNull(apiKeys.revokedAt),
      ),
    );
  redirect("/api-keys");
}

/* ---------- webhooks ---------- */

export async function createWebhookAction(formData: FormData): Promise<void> {
  const { user, team } = await activeContext();
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
    teamId: team.id,
    url,
    secret: newWebhookSecret(),
    events,
    createdAt: new Date(),
  });
  redirect("/webhooks");
}

export async function toggleWebhookAction(formData: FormData): Promise<void> {
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  const [hook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.teamId, team.id)));
  if (hook) {
    await db
      .update(webhooks)
      .set({ enabled: !hook.enabled })
      .where(eq(webhooks.id, id));
  }
  redirect("/webhooks");
}

export async function deleteWebhookAction(formData: FormData): Promise<void> {
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.teamId, team.id)));
  redirect("/webhooks");
}

/* ---------- settings ---------- */

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const { user, team } = await activeContext();
  const mode = String(formData.get("mailMode") ?? "inherit");

  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.teamId, team.id));

  // secrets are write-only: empty input keeps the stored value,
  // ticking "clear" removes it, a new value replaces it encrypted.
  const secretField = (
    field: string,
    stored: string | null | undefined,
  ): string | null => {
    if (formData.get(`${field}Clear`) === "on") return null;
    const input = String(formData.get(field) ?? "").trim();
    if (!input) return stored ?? null;
    return encryptSecret(input);
  };

  const values = {
    mailMode: (["inherit", "sandbox", "smtp", "ses"].includes(mode)
      ? mode
      : "inherit") as "inherit" | "sandbox" | "smtp" | "ses",
    smtpUrl: secretField("smtpUrl", existing?.smtpUrl),
    sesAccessKeyId:
      String(formData.get("sesAccessKeyId") ?? "").trim() ||
      existing?.sesAccessKeyId ||
      null,
    sesSecretAccessKey: secretField(
      "sesSecretAccessKey",
      existing?.sesSecretAccessKey,
    ),
    sesRegion: String(formData.get("sesRegion") ?? "").trim() || null,
    trackOpens: formData.get("trackOpens") === "on",
    trackClicks: formData.get("trackClicks") === "on",
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(userSettings)
      .set(values)
      .where(eq(userSettings.id, existing.id));
  } else {
    await db.insert(userSettings).values({
      id: newSettingsId(),
      userId: user.id,
      teamId: team.id,
      ...values,
    });
  }
  redirect("/settings?saved=1");
}

/* ---------- suppressions ---------- */

export async function addSuppressionAction(formData: FormData): Promise<void> {
  const { user, team } = await activeContext();
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  if (email) {
    await db
      .insert(suppressions)
      .values({
        id: newSuppressionId(),
        userId: user.id,
        teamId: team.id,
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
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  await db
    .delete(suppressions)
    .where(and(eq(suppressions.id, id), eq(suppressions.teamId, team.id)));
  redirect("/suppressions");
}

/* ---------- templates ---------- */

export async function saveTemplateAction(formData: FormData): Promise<void> {
  const { user, team } = await activeContext();
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
      .where(and(eq(templates.id, id), eq(templates.teamId, team.id)));
    redirect(`/templates`);
  }
  await db.insert(templates).values({
    id: newTemplateId(),
    userId: user.id,
    teamId: team.id,
    ...values,
    createdAt: new Date(),
  });
  redirect("/templates");
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.teamId, team.id)));
  redirect("/templates");
}

/* ---------- audiences & contacts ---------- */

export async function createAudienceAction(formData: FormData): Promise<void> {
  const { user, team } = await activeContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/audiences");
  const id = newAudienceId();
  await db.insert(audiences).values({
    id,
    userId: user.id,
    teamId: team.id,
    name,
    createdAt: new Date(),
  });
  redirect(`/audiences/${id}`);
}

export async function deleteAudienceAction(formData: FormData): Promise<void> {
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  await db
    .delete(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.teamId, team.id)));
  redirect("/audiences");
}

async function ownedAudience(audienceId: string, teamId: string) {
  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, audienceId), eq(audiences.teamId, teamId)));
  return audience;
}

export async function addContactAction(formData: FormData): Promise<void> {
  const { team } = await activeContext();
  const audienceId = String(formData.get("audienceId"));
  if (!(await ownedAudience(audienceId, team.id))) redirect("/audiences");
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
  const { team } = await activeContext();
  const audienceId = String(formData.get("audienceId"));
  if (!(await ownedAudience(audienceId, team.id))) redirect("/audiences");
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
  const { user, team } = await activeContext();
  const audienceId = String(formData.get("audienceId"));
  if (!(await ownedAudience(audienceId, team.id))) {
    redirect("/broadcasts?error=no_audience");
  }
  const from = String(formData.get("from") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const html = String(formData.get("html") ?? "");
  if (!from || !subject || !html) redirect("/broadcasts?error=missing");
  await db.insert(broadcasts).values({
    id: newBroadcastId(),
    userId: user.id,
    teamId: team.id,
    audienceId,
    from,
    subject,
    html,
    createdAt: new Date(),
  });
  redirect("/broadcasts");
}

export async function sendBroadcastAction(formData: FormData): Promise<void> {
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.teamId, team.id)));
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
  const { team } = await activeContext();
  const id = String(formData.get("id"));
  await db
    .delete(broadcasts)
    .where(
      and(
        eq(broadcasts.id, id),
        eq(broadcasts.teamId, team.id),
        eq(broadcasts.status, "draft"),
      ),
    );
  redirect("/broadcasts");
}
