import { createHmac } from "node:crypto";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import {
  db,
  emailEvents,
  emails,
  webhookDeliveries,
  webhooks,
} from "./db";

const MAX_ATTEMPTS = 5;
// svix-style backoff: immediate, 5s, 5m, 30m, 2h
const BACKOFF_MS = [0, 5_000, 300_000, 1_800_000, 7_200_000];

/**
 * Sign payload svix-style so consumers can verify with standard tooling:
 * signed content = `${msgId}.${timestampSec}.${body}`, HMAC-SHA256 with
 * the base64-decoded part of the whsec_ secret.
 */
export function signWebhook(
  secret: string,
  msgId: string,
  timestampSec: number,
  body: string,
): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "utf8");
  const mac = createHmac("sha256", key)
    .update(`${msgId}.${timestampSec}.${body}`)
    .digest("base64");
  return `v1,${mac}`;
}

async function attemptDelivery(deliveryId: string): Promise<void> {
  const [row] = await db
    .select({
      delivery: webhookDeliveries,
      webhook: webhooks,
      event: emailEvents,
    })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
    .innerJoin(emailEvents, eq(webhookDeliveries.eventId, emailEvents.id))
    .where(eq(webhookDeliveries.id, deliveryId));
  if (!row || row.delivery.status !== "pending") return;

  const [email] = await db
    .select()
    .from(emails)
    .where(eq(emails.id, row.event.emailId));

  const payload = JSON.stringify({
    type: row.event.type,
    created_at: row.event.createdAt.toISOString(),
    data: {
      email_id: row.event.emailId,
      from: email?.from,
      to: email?.to,
      subject: email?.subject,
      ...(row.event.data ?? {}),
    },
  });

  const timestampSec = Math.floor(Date.now() / 1000);
  const attempts = row.delivery.attempts + 1;
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let ok = false;

  try {
    const res = await fetch(row.webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": row.delivery.id,
        "webhook-timestamp": String(timestampSec),
        "webhook-signature": signWebhook(
          row.webhook.secret,
          row.delivery.id,
          timestampSec,
          payload,
        ),
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
    responseStatus = res.status;
    responseBody = (await res.text()).slice(0, 2000);
    ok = res.ok;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : String(err);
  }

  if (ok) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "success",
        attempts,
        responseStatus,
        responseBody,
        deliveredAt: new Date(),
        nextAttemptAt: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  } else if (attempts >= MAX_ATTEMPTS) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        attempts,
        responseStatus,
        responseBody,
        nextAttemptAt: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  } else {
    await db
      .update(webhookDeliveries)
      .set({
        attempts,
        responseStatus,
        responseBody,
        nextAttemptAt: new Date(Date.now() + BACKOFF_MS[attempts]),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  }
}

let inFlight: Promise<void> | null = null;

async function runDeliveries(): Promise<void> {
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "pending"),
        isNotNull(webhookDeliveries.nextAttemptAt),
        lte(webhookDeliveries.nextAttemptAt, new Date()),
      ),
    )
    .limit(50);
  for (const { id } of due) {
    await attemptDelivery(id);
  }
}

/** Process all due pending deliveries. Concurrent callers share one run. */
export function processWebhookDeliveries(): Promise<void> {
  inFlight ??= runDeliveries().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Fire-and-forget nudge, used right after new deliveries are inserted. */
export function kickWebhookDispatcher(): void {
  void processWebhookDeliveries().catch((err) =>
    console.error("[sendthen] webhook dispatch error:", err),
  );
}
