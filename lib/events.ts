import { and, eq } from "drizzle-orm";
import {
  db,
  emailEvents,
  emails,
  webhookDeliveries,
  webhooks,
  type EmailEvent,
} from "./db";
import { newDeliveryId, newEventId } from "./id";
import { kickWebhookDispatcher } from "./webhook-dispatch";

export type EventType = EmailEvent["type"];

/**
 * Record an email lifecycle event and fan out pending webhook deliveries
 * to the owner's enabled webhooks subscribed to this event type.
 */
export async function recordEvent(
  emailId: string,
  type: EventType,
  data: Record<string, unknown> = {},
): Promise<EmailEvent> {
  const now = new Date();
  const [event] = await db
    .insert(emailEvents)
    .values({
      id: newEventId(),
      emailId,
      type,
      data,
      createdAt: now,
    })
    .returning();

  const [email] = await db
    .select({ userId: emails.userId })
    .from(emails)
    .where(eq(emails.id, emailId));

  const hooks = email?.userId
    ? await db
        .select()
        .from(webhooks)
        .where(
          and(eq(webhooks.enabled, true), eq(webhooks.userId, email.userId)),
        )
    : [];
  const matching = hooks.filter((h) => h.events.includes(type));

  if (matching.length > 0) {
    await db.insert(webhookDeliveries).values(
      matching.map((h) => ({
        id: newDeliveryId(),
        webhookId: h.id,
        eventId: event.id,
        status: "pending" as const,
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
      })),
    );
    kickWebhookDispatcher();
  }

  return event;
}
