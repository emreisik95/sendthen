import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, emails } from "@/lib/db";
import { apiError, requireApiKey, requireScope } from "@/lib/api-auth";
import { recordEvent } from "@/lib/events";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "emails.send");
  if (denied) return denied;

  const { id } = await params;
  const updated = await db
    .update(emails)
    .set({ status: "canceled" })
    .where(
      and(
        eq(emails.id, id),
        eq(emails.status, "queued"),
        eq(emails.teamId, auth.teamId!),
      ),
    )
    .returning();
  if (updated.length === 0) {
    return apiError(
      422,
      "not_cancelable",
      "Email not found or already sent — only queued emails can be canceled.",
    );
  }
  await recordEvent(id, "email.canceled");
  return NextResponse.json({ id });
}
