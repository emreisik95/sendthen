import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, emails } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { kickQueue } from "@/lib/queue";
import { SendError, createEmail, sendSchema } from "@/lib/send-email";

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "validation_error", parsed.error.issues[0].message);
  }

  try {
    const { id } = await createEmail(auth.teamId!, auth.userId, auth.id, parsed.data, {
      idempotencyKey: req.headers.get("idempotency-key"),
    });
    kickQueue();
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof SendError) {
      return apiError(err.statusCode, err.code, err.message);
    }
    throw err;
  }
}

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);

  const rows = await db
    .select()
    .from(emails)
    .where(eq(emails.teamId, auth.teamId!))
    .orderBy(desc(emails.createdAt))
    .limit(limit);

  return NextResponse.json({
    data: rows.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      subject: e.subject,
      status: e.status,
      created_at: e.createdAt.toISOString(),
    })),
  });
}
