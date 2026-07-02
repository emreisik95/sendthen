import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db, domains, emails, userSettings, type Email } from "./db";
import { effectiveMode, mailMode, sendEmail } from "./mailer";
import { recordEvent } from "./events";
import { processWebhookDeliveries } from "./webhook-dispatch";
import { suppressedAmong } from "./suppress";
import { injectTracking } from "./tracking";

const MAX_ATTEMPTS = 3;
// 30s, 5m between send retries
const BACKOFF_MS = [0, 30_000, 300_000];

function fromDomainOf(email: Email): string | null {
  const match = email.from.match(/@([^>\s]+)>?$/);
  return match ? match[1].toLowerCase() : null;
}

async function processOne(email: Email): Promise<void> {
  // claim: queued -> sending (guards against double-send)
  const claimed = await db
    .update(emails)
    .set({ status: "sending" })
    .where(and(eq(emails.id, email.id), eq(emails.status, "queued")))
    .returning();
  if (claimed.length === 0) return;

  const domainName = fromDomainOf(email);
  const [domain] =
    domainName && email.teamId
      ? await db
          .select()
          .from(domains)
          .where(
            and(
              eq(domains.name, domainName),
              eq(domains.teamId, email.teamId),
            ),
          )
      : [];

  const [settings] = email.teamId
    ? await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.teamId, email.teamId))
    : [];

  // drop suppressed recipients (bounces, complaints, manual blocks)
  let outgoing: Email = email;
  if (email.teamId) {
    const all = [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])];
    const suppressed = new Set(await suppressedAmong(email.teamId, all));
    if (suppressed.size > 0) {
      const keep = (list: string[] | null) =>
        list?.filter((a) => !suppressed.has(a.toLowerCase())) ?? null;
      const to = keep(email.to) ?? [];
      if (to.length === 0) {
        await db
          .update(emails)
          .set({
            status: "failed",
            lastError: "All recipients are suppressed",
            nextAttemptAt: null,
          })
          .where(eq(emails.id, email.id));
        await recordEvent(email.id, "email.failed", {
          error: "all_recipients_suppressed",
        });
        return;
      }
      outgoing = { ...email, to, cc: keep(email.cc), bcc: keep(email.bcc) };
    }
  }

  // open/click tracking on the outgoing copy only
  if (outgoing.html && (outgoing.trackOpens || outgoing.trackClicks)) {
    outgoing = {
      ...outgoing,
      html: injectTracking(outgoing.html, outgoing.id, {
        opens: outgoing.trackOpens,
        clicks: outgoing.trackClicks,
      }),
    };
  }

  const attempts = email.attempts + 1;
  try {
    const { messageId } = await sendEmail(
      outgoing,
      domain ?? null,
      settings ?? null,
    );
    await db
      .update(emails)
      .set({
        status: "sent",
        messageId,
        sentAt: new Date(),
        attempts,
        nextAttemptAt: null,
        lastError: null,
      })
      .where(eq(emails.id, email.id));
    await recordEvent(email.id, "email.sent", { message_id: messageId });

    // sandbox has no real delivery pipeline — mark delivered immediately
    if (effectiveMode(settings ?? null) === "sandbox") {
      await db
        .update(emails)
        .set({ status: "delivered" })
        .where(eq(emails.id, email.id));
      await recordEvent(email.id, "email.delivered", {
        message_id: messageId,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (attempts >= MAX_ATTEMPTS) {
      await db
        .update(emails)
        .set({
          status: "failed",
          attempts,
          nextAttemptAt: null,
          lastError: message,
        })
        .where(eq(emails.id, email.id));
      await recordEvent(email.id, "email.failed", { error: message });
    } else {
      await db
        .update(emails)
        .set({
          status: "queued",
          attempts,
          nextAttemptAt: new Date(Date.now() + BACKOFF_MS[attempts]),
          lastError: message,
        })
        .where(eq(emails.id, email.id));
    }
  }
}

let inFlight: Promise<void> | null = null;

async function runQueue(): Promise<void> {
  const now = new Date();
  const due = await db
    .select()
    .from(emails)
    .where(
      and(
        eq(emails.status, "queued"),
        or(isNull(emails.nextAttemptAt), lte(emails.nextAttemptAt, now)),
        or(isNull(emails.scheduledAt), lte(emails.scheduledAt, now)),
      ),
    )
    .limit(20);
  for (const email of due) {
    await processOne(email);
  }
}

/** Send every due queued email. Concurrent callers share one run. */
export function processQueue(): Promise<void> {
  inFlight ??= runQueue().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Fire-and-forget nudge, used right after an email is enqueued. */
export function kickQueue(): void {
  void processQueue().catch((err) =>
    console.error("[sendthen] queue error:", err),
  );
}

declare global {
  var __sendthenWorker: ReturnType<typeof setInterval> | undefined;
}

/** Background poller: retries, scheduled sends, webhook redelivery. */
export function startWorker(intervalMs = 5_000): void {
  if (globalThis.__sendthenWorker) return;
  globalThis.__sendthenWorker = setInterval(() => {
    void processQueue().catch((err) =>
      console.error("[sendthen] queue error:", err),
    );
    void processWebhookDeliveries().catch((err) =>
      console.error("[sendthen] webhook dispatch error:", err),
    );
  }, intervalMs);
  globalThis.__sendthenWorker.unref?.();
  console.log(`[sendthen] worker started (mode=${mailMode()})`);
}
