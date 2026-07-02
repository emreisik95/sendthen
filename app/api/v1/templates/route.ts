import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, templates } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { newTemplateId } from "@/lib/id";

const createSchema = z
  .object({
    name: z.string().min(1).max(100),
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

  const now = new Date();
  const [tpl] = await db
    .insert(templates)
    .values({
      id: newTemplateId(),
      userId: auth.userId!,
      name: parsed.data.name,
      subject: parsed.data.subject,
      html: parsed.data.html ?? null,
      text: parsed.data.text ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json(
    { id: tpl.id, name: tpl.name, created_at: tpl.createdAt.toISOString() },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.userId, auth.userId!))
    .orderBy(desc(templates.updatedAt));

  return NextResponse.json({
    data: rows.map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      updated_at: t.updatedAt.toISOString(),
    })),
  });
}
