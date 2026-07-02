import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, emails } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const [email] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.teamId, auth.teamId!)));
  if (!email) return apiError(404, "not_found", "Email not found.");

  return NextResponse.json({
    id: email.id,
    from: email.from,
    to: email.to,
    cc: email.cc,
    bcc: email.bcc,
    reply_to: email.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
    status: email.status,
    message_id: email.messageId,
    scheduled_at: email.scheduledAt?.toISOString() ?? null,
    sent_at: email.sentAt?.toISOString() ?? null,
    last_error: email.lastError,
    created_at: email.createdAt.toISOString(),
  });
}
