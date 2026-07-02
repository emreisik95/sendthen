import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, broadcasts } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { SendError } from "@/lib/send-email";
import { sendBroadcast } from "@/lib/broadcast";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.teamId, auth.teamId!)));
  if (!broadcast) return apiError(404, "not_found", "Broadcast not found.");

  try {
    const result = await sendBroadcast(broadcast);
    return NextResponse.json({ id, ...result });
  } catch (err) {
    if (err instanceof SendError) {
      return apiError(err.statusCode, err.code, err.message);
    }
    throw err;
  }
}
