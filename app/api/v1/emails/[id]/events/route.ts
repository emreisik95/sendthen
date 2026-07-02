import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, emailEvents, emails } from "@/lib/db";
import { apiError, requireApiKey, requireScope } from "@/lib/api-auth";

/** Lifecycle events for one email — powers `sendthen trace`. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "emails.read");
  if (denied) return denied;

  const { id } = await params;
  const [email] = await db
    .select({ id: emails.id })
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.teamId, auth.teamId!)));
  if (!email) return apiError(404, "not_found", "Email not found.");

  const rows = await db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.emailId, id))
    .orderBy(asc(emailEvents.createdAt));

  return NextResponse.json({
    data: rows.map((e) => ({
      type: e.type,
      data: e.data,
      created_at: e.createdAt.toISOString(),
    })),
  });
}
