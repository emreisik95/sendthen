import { simpleParser, type AddressObject } from "mailparser";
import { eq, inArray } from "drizzle-orm";
import { db, domains, inboundEmails, type InboundEmail } from "./db";
import { newInboundId } from "./id";
import { SendError, createEmail } from "./send-email";
import { instanceSecret } from "./secret";
import { kickQueue } from "./queue";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // per attachment
const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024; // stored content across the row
const MAX_HEADERS = 60;

function addressList(input: AddressObject | AddressObject[] | undefined): string[] {
  if (!input) return [];
  const objs = Array.isArray(input) ? input : [input];
  return objs
    .flatMap((o) => o.value)
    .map((a) => a.address)
    .filter((a): a is string => !!a);
}

function domainOf(address: string): string | null {
  const at = address.lastIndexOf("@");
  if (at === -1) return null;
  return address.slice(at + 1).trim().toLowerCase() || null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Parse a raw MIME message and store one inbound row per team that owns
 * a recipient domain. Recipients whose domain isn't registered are ignored.
 */
export async function parseAndStoreInbound(
  raw: Buffer,
  envelopeTo?: string[],
): Promise<{ stored: number }> {
  const parsed = await simpleParser(raw);

  const recipients =
    envelopeTo && envelopeTo.length > 0
      ? envelopeTo
      : [...addressList(parsed.to), ...addressList(parsed.cc)];

  const recipientDomains = [
    ...new Set(
      recipients
        .map((r) => domainOf(r))
        .filter((d): d is string => !!d),
    ),
  ];
  if (recipientDomains.length === 0) return { stored: 0 };

  const owned = await db
    .select({ id: domains.id, name: domains.name, teamId: domains.teamId })
    .from(domains)
    .where(inArray(domains.name, recipientDomains));

  // group by owning team; one row per team, dedupe domains
  const byTeam = new Map<string, { domainId: string }>();
  for (const d of owned) {
    if (!d.teamId) continue;
    if (!byTeam.has(d.teamId)) byTeam.set(d.teamId, { domainId: d.id });
  }
  if (byTeam.size === 0) return { stored: 0 };

  // headers flattened: only string-valued, capped
  const headers: Record<string, string> = {};
  let headerCount = 0;
  for (const [key, value] of parsed.headers) {
    if (headerCount >= MAX_HEADERS) break;
    if (typeof value !== "string") continue;
    headers[key] = value;
    headerCount++;
  }

  // attachments: skip single > 5MB entirely; cap total stored content at 10MB.
  // Caps are checked against the actual buffer length BEFORE any base64
  // expansion so oversized content is never encoded into memory.
  let totalStored = 0;
  const attachments = (parsed.attachments ?? [])
    .filter((a) => a.content.length <= MAX_ATTACHMENT_BYTES)
    .map((a) => {
      const size = a.content.length;
      const keepContent = totalStored + size <= MAX_TOTAL_ATTACHMENT_BYTES;
      if (keepContent) totalStored += size;
      return {
        filename: a.filename ?? "attachment",
        contentType: a.contentType,
        size,
        content: keepContent ? a.content.toString("base64") : "",
      };
    });

  const from = parsed.from?.value[0]?.address ?? parsed.from?.text ?? "";
  const to = addressList(parsed.to);
  const cc = addressList(parsed.cc);
  const html = parsed.html || parsed.textAsHtml || null;
  const now = new Date();

  let stored = 0;
  for (const [teamId, { domainId }] of byTeam) {
    await db.insert(inboundEmails).values({
      id: newInboundId(),
      teamId,
      domainId,
      from,
      to: to.length > 0 ? to : recipients,
      cc: cc.length > 0 ? cc : null,
      subject: parsed.subject ?? "",
      html,
      text: parsed.text ?? null,
      headers,
      messageId: parsed.messageId ?? null,
      attachments: attachments.length > 0 ? attachments : null,
      read: false,
      createdAt: now,
    });
    stored++;
  }
  return { stored };
}

/**
 * Forward a stored inbound email as a new outbound email from one of the
 * team's registered addresses. Throws SendError on failure.
 */
export async function forwardInbound(
  inbound: InboundEmail,
  to: string,
  requestUserId: string | null,
): Promise<{ id: string }> {
  if (!inbound.teamId) {
    throw new SendError(422, "validation_error", "Inbound email has no team.");
  }

  // pick the first recipient address whose domain belongs to this team
  let from = inbound.to[0];
  const teamDomains = await db
    .select({ name: domains.name })
    .from(domains)
    .where(eq(domains.teamId, inbound.teamId));
  const ownedNames = new Set(teamDomains.map((d) => d.name.toLowerCase()));
  for (const addr of inbound.to) {
    const dom = domainOf(addr);
    if (dom && ownedNames.has(dom)) {
      from = addr;
      break;
    }
  }
  if (!from) {
    throw new SendError(422, "validation_error", "No from address available.");
  }

  const date = inbound.createdAt.toUTCString();
  const headerBlock = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px;">
  <div>---------- Forwarded message ----------</div>
  <div><strong>From:</strong> ${escapeHtml(inbound.from)}</div>
  <div><strong>Date:</strong> ${escapeHtml(date)}</div>
  <div><strong>Subject:</strong> ${escapeHtml(inbound.subject)}</div>
</div>`;
  const originalHtml =
    inbound.html ??
    (inbound.text ? `<pre>${escapeHtml(inbound.text)}</pre>` : "");
  const html = headerBlock + originalHtml;
  const text = `---------- Forwarded message ----------\nFrom: ${inbound.from}\nDate: ${date}\nSubject: ${inbound.subject}\n\n${inbound.text ?? ""}`;

  const { id } = await createEmail(inbound.teamId, requestUserId, null, {
    from,
    to: [to],
    subject: `Fwd: ${inbound.subject}`,
    html,
    text,
    attachments: inbound.attachments
      ?.filter((a) => a.content)
      .map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType,
      })),
  });

  await db
    .update(inboundEmails)
    .set({ forwardedTo: id })
    .where(eq(inboundEmails.id, inbound.id));
  kickQueue();
  return { id };
}

/** Bearer-token check for the raw ingest endpoint. */
export function ingestAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expected =
    process.env.SENDTHEN_INGEST_KEY || instanceSecret().slice(0, 32);
  return !!token && token === expected;
}
