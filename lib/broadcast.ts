import { and, eq } from "drizzle-orm";
import { db, broadcasts, contacts, type Broadcast } from "./db";
import { SendError, createEmail, renderTemplate } from "./send-email";
import { kickQueue } from "./queue";
import { publicUrl, trackSign } from "./tracking";

export function unsubscribeUrl(contactId: string): string {
  const base = publicUrl() ?? "http://localhost:3000";
  return `${base}/unsubscribe/${contactId}/${trackSign(contactId)}`;
}

export interface BroadcastResult {
  queued: number;
  skipped: number;
}

/**
 * Fan a broadcast out to every subscribed contact in its audience.
 * Each contact gets a personalized copy with {{first_name}}, {{last_name}},
 * {{email}} and {{unsubscribe_url}} substituted, plus a List-Unsubscribe
 * header. Suppressed contacts are skipped, not fatal.
 */
export async function sendBroadcast(
  broadcast: Broadcast,
): Promise<BroadcastResult> {
  const claimed = await db
    .update(broadcasts)
    .set({ status: "sending" })
    .where(
      and(eq(broadcasts.id, broadcast.id), eq(broadcasts.status, "draft")),
    )
    .returning();
  if (claimed.length === 0) {
    throw new SendError(
      422,
      "not_sendable",
      "Broadcast already sent or sending.",
    );
  }

  const recipients = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.audienceId, broadcast.audienceId),
        eq(contacts.unsubscribed, false),
      ),
    );

  let queued = 0;
  let skipped = 0;
  try {
    for (const contact of recipients) {
      const vars = {
        email: contact.email,
        first_name: contact.firstName ?? "",
        last_name: contact.lastName ?? "",
        unsubscribe_url: unsubscribeUrl(contact.id),
      };
      try {
        await createEmail(broadcast.teamId!, broadcast.userId, null, {
          from: broadcast.from,
          to: [contact.email],
          subject: renderTemplate(broadcast.subject, vars),
          html: broadcast.html
            ? renderTemplate(broadcast.html, vars)
            : undefined,
          text: broadcast.text
            ? renderTemplate(broadcast.text, vars)
            : undefined,
        }, {
          broadcastId: broadcast.id,
          contactId: contact.id,
          extraHeaders: {
            "List-Unsubscribe": `<${unsubscribeUrl(contact.id)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        queued++;
      } catch (err) {
        // per-contact suppression is expected; anything else is fatal
        if (
          err instanceof SendError &&
          err.code === "recipients_suppressed"
        ) {
          skipped++;
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    await db
      .update(broadcasts)
      .set({ status: "failed" })
      .where(eq(broadcasts.id, broadcast.id));
    throw err;
  } finally {
    if (queued > 0) kickQueue();
  }

  await db
    .update(broadcasts)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(broadcasts.id, broadcast.id));

  return { queued, skipped };
}
