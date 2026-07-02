import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { kickQueue } from "@/lib/queue";
import { SendError, createEmail, sendSchema } from "@/lib/send-email";

const batchSchema = z.array(sendSchema).min(1).max(100);

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "validation_error", parsed.error.issues[0].message);
  }

  // all-or-nothing validation first pass is too expensive; process in order
  // and report per-item results like Resend's batch API returns data[].
  const data: { id: string }[] = [];
  try {
    for (const item of parsed.data) {
      data.push(await createEmail(auth.teamId!, auth.userId, auth.id, item));
    }
  } catch (err) {
    if (err instanceof SendError) {
      return apiError(
        err.statusCode,
        err.code,
        `Item ${data.length}: ${err.message} (${data.length} emails already queued)`,
      );
    }
    throw err;
  } finally {
    if (data.length > 0) kickQueue();
  }

  return NextResponse.json({ data });
}
