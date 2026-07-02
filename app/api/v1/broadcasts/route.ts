import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, audiences, broadcasts } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { newBroadcastId } from "@/lib/id";

const createSchema = z
  .object({
    audience_id: z.string().min(1),
    from: z.string().min(3),
    subject: z.string().min(1),
    html: z.string().optional(),
    text: z.string().optional(),
  })
  .refine((v) => v.html || v.text, {
    message: "Either html or text must be provided.",
  });

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "validation_error", parsed.error.issues[0].message);
  }

  const [audience] = await db
    .select()
    .from(audiences)
    .where(
      and(
        eq(audiences.id, parsed.data.audience_id),
        eq(audiences.userId, auth.userId!),
      ),
    );
  if (!audience) return apiError(404, "not_found", "Audience not found.");

  const [broadcast] = await db
    .insert(broadcasts)
    .values({
      id: newBroadcastId(),
      userId: auth.userId!,
      audienceId: audience.id,
      from: parsed.data.from,
      subject: parsed.data.subject,
      html: parsed.data.html ?? null,
      text: parsed.data.text ?? null,
      createdAt: new Date(),
    })
    .returning();
  return NextResponse.json({ id: broadcast.id }, { status: 201 });
}

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.userId, auth.userId!))
    .orderBy(desc(broadcasts.createdAt));
  return NextResponse.json({
    data: rows.map((b) => ({
      id: b.id,
      audience_id: b.audienceId,
      from: b.from,
      subject: b.subject,
      status: b.status,
      sent_at: b.sentAt?.toISOString() ?? null,
      created_at: b.createdAt.toISOString(),
    })),
  });
}
