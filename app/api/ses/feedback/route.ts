import { NextResponse } from "next/server";
import { eq, like } from "drizzle-orm";
import { db, emails } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { addSuppression } from "@/lib/suppress";

/**
 * Amazon SES feedback via SNS (bounces + complaints).
 * Point an SNS topic's HTTPS subscription at this endpoint;
 * subscription confirmation is handled automatically.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // SNS handshake
  if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
    await fetch(String(body.SubscribeURL)).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (body.Type !== "Notification" || typeof body.Message !== "string") {
    return NextResponse.json({ ok: true });
  }

  let msg: {
    notificationType?: string;
    mail?: { messageId?: string };
    bounce?: {
      bounceType?: string;
      bouncedRecipients?: { emailAddress?: string }[];
    };
    complaint?: { complainedRecipients?: { emailAddress?: string }[] };
  };
  try {
    msg = JSON.parse(body.Message);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const sesMessageId = msg.mail?.messageId;
  if (!sesMessageId) return NextResponse.json({ ok: true });

  // our stored message id is "<SESID@region.amazonses.com>"
  const [email] = await db
    .select()
    .from(emails)
    .where(like(emails.messageId, `%${sesMessageId}%`));
  if (!email) return NextResponse.json({ ok: true });

  if (msg.notificationType === "Bounce") {
    const recipients =
      msg.bounce?.bouncedRecipients
        ?.map((r) => r.emailAddress)
        .filter((a): a is string => !!a) ?? [];
    await db
      .update(emails)
      .set({ status: "bounced" })
      .where(eq(emails.id, email.id));
    await recordEvent(email.id, "email.bounced", {
      recipients,
      bounce_type: msg.bounce?.bounceType,
    });
    // only hard bounces go on the suppression list
    if (email.teamId && email.userId && msg.bounce?.bounceType === "Permanent") {
      for (const rcpt of recipients) {
        await addSuppression(email.teamId, email.userId, rcpt, "bounce");
      }
    }
  } else if (msg.notificationType === "Complaint") {
    const recipients =
      msg.complaint?.complainedRecipients
        ?.map((r) => r.emailAddress)
        .filter((a): a is string => !!a) ?? [];
    await recordEvent(email.id, "email.complained", { recipients });
    if (email.teamId && email.userId) {
      for (const rcpt of recipients) {
        await addSuppression(email.teamId, email.userId, rcpt, "complaint");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
