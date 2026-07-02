import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, templates } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).optional(),
  html: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const [tpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.teamId, auth.teamId!)));
  if (!tpl) return apiError(404, "not_found", "Template not found.");
  return NextResponse.json({
    id: tpl.id,
    name: tpl.name,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    created_at: tpl.createdAt.toISOString(),
    updated_at: tpl.updatedAt.toISOString(),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "validation_error", parsed.error.issues[0].message);
  }

  const { id } = await params;
  const updated = await db
    .update(templates)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(templates.id, id), eq(templates.teamId, auth.teamId!)))
    .returning({ id: templates.id });
  if (updated.length === 0) {
    return apiError(404, "not_found", "Template not found.");
  }
  return NextResponse.json({ id });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const deleted = await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.teamId, auth.teamId!)))
    .returning({ id: templates.id });
  if (deleted.length === 0) {
    return apiError(404, "not_found", "Template not found.");
  }
  return NextResponse.json({ id, deleted: true });
}
