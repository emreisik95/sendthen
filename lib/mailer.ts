import nodemailer, { type Transporter } from "nodemailer";
import { resolveMx } from "node:dns/promises";
import path from "node:path";
import fs from "node:fs";
import type { Domain, Email, UserSettings } from "./db";
import { sendViaSes } from "./providers/ses";
import { decryptSecret } from "./crypto";

export type MailMode = "sandbox" | "smtp" | "direct" | "ses";

/** Instance-wide default mode from env. */
export function mailMode(): MailMode {
  const mode = process.env.SENDTHEN_MAIL_MODE;
  if (mode === "smtp" || mode === "direct" || mode === "sandbox" || mode === "ses")
    return mode;
  return process.env.SMTP_URL ? "smtp" : "sandbox";
}

/** Effective mode for a user: their setting wins, "inherit" falls back to env. */
export function effectiveMode(settings: UserSettings | null): MailMode {
  if (settings && settings.mailMode !== "inherit") return settings.mailMode;
  return mailMode();
}

const OUTBOX_DIR =
  process.env.SENDTHEN_OUTBOX_DIR ?? path.join(process.cwd(), "data", "outbox");

// builds full MIME (DKIM included) without network
const mimeBuilder: Transporter = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
});

function senderHostname(): string {
  return process.env.SENDTHEN_HOSTNAME ?? "localhost";
}

/** direct mode: deliver raw MIME straight to each recipient domain's MX. */
async function deliverToMx(
  from: string,
  recipients: string[],
  raw: Buffer,
): Promise<void> {
  const byDomain = new Map<string, string[]>();
  for (const rcpt of recipients) {
    const domain = rcpt.split("@").pop()!.toLowerCase();
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), rcpt]);
  }

  for (const [domain, rcpts] of byDomain) {
    const mxs = (await resolveMx(domain)).sort(
      (a, b) => a.priority - b.priority,
    );
    if (mxs.length === 0) throw new Error(`No MX records for ${domain}`);

    let lastErr: unknown = null;
    let delivered = false;
    for (const mx of mxs) {
      try {
        const relay = nodemailer.createTransport({
          host: mx.exchange,
          port: 25,
          secure: false,
          name: senderHostname(),
          connectionTimeout: 15_000,
        });
        await relay.sendMail({
          envelope: { from, to: rcpts },
          raw,
        });
        delivered = true;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!delivered) {
      throw lastErr instanceof Error
        ? lastErr
        : new Error(`Delivery to ${domain} failed`);
    }
  }
}

export interface SendResult {
  messageId: string;
}

/** Send one email using the owner's provider. Throws on transport failure. */
export async function sendEmail(
  email: Email,
  domain: Domain | null,
  settings: UserSettings | null,
): Promise<SendResult> {
  const mode = effectiveMode(settings);

  const message = {
    from: email.from,
    to: email.to,
    cc: email.cc ?? undefined,
    bcc: email.bcc ?? undefined,
    replyTo: email.replyTo ?? undefined,
    subject: email.subject,
    html: email.html ?? undefined,
    text: email.text ?? undefined,
    headers: {
      ...(email.headers ?? {}),
      "X-Entity-Ref-ID": email.id,
    },
    attachments: email.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "base64"),
      contentType: a.content_type,
    })),
    dkim: domain
      ? {
          domainName: domain.name,
          keySelector: domain.dkimSelector,
          privateKey: domain.dkimPrivateKey,
        }
      : undefined,
  };

  if (mode === "smtp") {
    const url = settings?.smtpUrl
      ? decryptSecret(settings.smtpUrl)
      : process.env.SMTP_URL;
    if (!url) throw new Error("SMTP mode selected but no SMTP URL configured");
    const info = await nodemailer.createTransport(url).sendMail(message);
    return { messageId: info.messageId };
  }

  // remaining modes need the raw MIME
  const info = await mimeBuilder.sendMail(message);
  const raw = info.message as Buffer;

  if (mode === "sandbox") {
    fs.mkdirSync(OUTBOX_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTBOX_DIR, `${email.id}.eml`), raw);
    return { messageId: info.messageId };
  }

  if (mode === "ses") {
    // team credentials win; the instance-level SES account is the fallback
    // that powers "Instance default" real delivery
    const creds =
      settings?.sesAccessKeyId &&
      settings.sesSecretAccessKey &&
      settings.sesRegion
        ? {
            accessKeyId: settings.sesAccessKeyId,
            secretAccessKey: decryptSecret(settings.sesSecretAccessKey),
            region: settings.sesRegion,
          }
        : process.env.SENDTHEN_SES_ACCESS_KEY_ID &&
            process.env.SENDTHEN_SES_SECRET_ACCESS_KEY &&
            process.env.SENDTHEN_SES_REGION
          ? {
              accessKeyId: process.env.SENDTHEN_SES_ACCESS_KEY_ID,
              secretAccessKey: process.env.SENDTHEN_SES_SECRET_ACCESS_KEY,
              region: process.env.SENDTHEN_SES_REGION,
            }
          : null;
    if (!creds) {
      throw new Error(
        "SES mode selected but no credentials are configured (team settings or instance env)",
      );
    }
    const sesId = await sendViaSes(creds, raw);
    return { messageId: `<${sesId}@${creds.region}.amazonses.com>` };
  }

  // direct
  const recipients = [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])];
  const envelopeFrom = email.from.match(/<([^>]+)>/)?.[1] ?? email.from.trim();
  await deliverToMx(envelopeFrom, recipients, raw);
  return { messageId: info.messageId };
}

export function readSandboxEml(emailId: string): string | null {
  // ids are generated by newEmailId; still guard against traversal
  if (!/^em_[0-9a-z]+$/.test(emailId)) return null;
  const file = path.join(OUTBOX_DIR, `${emailId}.eml`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}
