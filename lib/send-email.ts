import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, domains, emails, teams, templates, userSettings } from "./db";
import { newEmailId } from "./id";
import { mailMode } from "./mailer";
import { recordEvent } from "./events";
import { suppressedAmong } from "./suppress";
import { enforceQuota } from "./quota";
import { SendError } from "./errors";

const toArray = z
  .union([z.string(), z.array(z.string()).min(1).max(50)])
  .transform((v) => (Array.isArray(v) ? v : [v]));

export const sendSchema = z
  .object({
    from: z.string().min(3),
    to: toArray,
    subject: z.string().min(1).optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    cc: toArray.optional(),
    bcc: toArray.optional(),
    reply_to: toArray.optional(),
    headers: z.record(z.string(), z.string()).optional(),
    tags: z.record(z.string(), z.string()).optional(),
    attachments: z
      .array(
        z.object({
          filename: z.string().min(1),
          content: z.string().min(1), // base64
          content_type: z.string().optional(),
        }),
      )
      .max(20)
      .optional(),
    scheduled_at: z.iso.datetime({ offset: true }).optional(),
    track_opens: z.boolean().optional(),
    track_clicks: z.boolean().optional(),
    template_id: z.string().optional(),
    variables: z.record(z.string(), z.string()).optional(),
  })
  .refine((v) => v.html || v.text || v.template_id, {
    message: "Provide html, text, or template_id.",
  })
  .refine((v) => v.template_id || v.subject, {
    message: "subject is required unless template_id is set.",
  })
  .refine(
    (v) =>
      !v.attachments ||
      v.attachments.reduce((n, a) => n + a.content.length, 0) <= 10_000_000,
    { message: "Attachments exceed the 7 MB limit." },
  );

export type SendInput = z.infer<typeof sendSchema>;

export { SendError };

/** {{variable}} substitution for templates. */
export function renderTemplate(
  input: string,
  vars: Record<string, string>,
): string {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) =>
    key in vars ? vars[key] : `{{${key}}}`,
  );
}

function fromDomain(from: string): string | null {
  const match = from.match(/@([^>\s]+)>?$/);
  return match ? match[1].toLowerCase() : null;
}

interface CreateOptions {
  idempotencyKey?: string | null;
  broadcastId?: string;
  contactId?: string;
  extraHeaders?: Record<string, string>;
}

/**
 * Validate ownership/suppressions, resolve template + tracking settings,
 * and enqueue one email. Throws SendError with an HTTP-ready code.
 * Caller is responsible for kicking the queue.
 */
export async function createEmail(
  teamId: string,
  userId: string | null,
  apiKeyId: string | null,
  data: SendInput,
  opts: CreateOptions = {},
): Promise<{ id: string }> {
  if (opts.idempotencyKey) {
    const [existing] = await db
      .select({ id: emails.id })
      .from(emails)
      .where(
        and(
          eq(emails.idempotencyKey, opts.idempotencyKey),
          eq(emails.teamId, teamId),
        ),
      );
    if (existing) return { id: existing.id };
  }

  // plan limits before anything is written
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (team) await enforceQuota(team);

  const domainName = fromDomain(data.from);
  if (!domainName) {
    throw new SendError(422, "validation_error", "Invalid from address.");
  }
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.name, domainName), eq(domains.teamId, teamId)));

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.teamId, teamId));

  const userMode =
    settings && settings.mailMode !== "inherit"
      ? settings.mailMode
      : mailMode();
  if (userMode !== "sandbox" && domain?.status !== "verified") {
    throw new SendError(
      403,
      "domain_not_verified",
      `Domain ${domainName} is not verified. Add and verify it first.`,
    );
  }

  const suppressed = await suppressedAmong(teamId, data.to);
  if (suppressed.length === data.to.length) {
    throw new SendError(
      422,
      "recipients_suppressed",
      `All recipients are on your suppression list: ${suppressed.join(", ")}`,
    );
  }

  // template resolution
  let { subject, html, text } = data;
  if (data.template_id) {
    const [tpl] = await db
      .select()
      .from(templates)
      .where(
        and(eq(templates.id, data.template_id), eq(templates.teamId, teamId)),
      );
    if (!tpl) {
      throw new SendError(404, "template_not_found", "Template not found.");
    }
    const vars = data.variables ?? {};
    subject = subject ?? renderTemplate(tpl.subject, vars);
    html = html ?? (tpl.html ? renderTemplate(tpl.html, vars) : undefined);
    text = text ?? (tpl.text ? renderTemplate(tpl.text, vars) : undefined);
  }
  if (!subject || (!html && !text)) {
    throw new SendError(
      422,
      "validation_error",
      "Template produced no subject or body.",
    );
  }

  const id = newEmailId();
  await db.insert(emails).values({
    id,
    teamId,
    userId,
    domainId: domain?.id ?? null,
    apiKeyId,
    templateId: data.template_id ?? null,
    broadcastId: opts.broadcastId ?? null,
    contactId: opts.contactId ?? null,
    from: data.from,
    to: data.to,
    cc: data.cc ?? null,
    bcc: data.bcc ?? null,
    replyTo: data.reply_to ?? null,
    subject,
    html: html ?? null,
    text: text ?? null,
    headers: { ...(data.headers ?? {}), ...(opts.extraHeaders ?? {}) },
    tags: data.tags ?? null,
    attachments: data.attachments ?? null,
    trackOpens: data.track_opens ?? settings?.trackOpens ?? false,
    trackClicks: data.track_clicks ?? settings?.trackClicks ?? false,
    status: "queued",
    scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : null,
    idempotencyKey: opts.idempotencyKey ?? null,
    createdAt: new Date(),
  });
  await recordEvent(id, "email.queued");
  return { id };
}
