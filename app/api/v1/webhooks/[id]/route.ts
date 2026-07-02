import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, webhooks } from "@/lib/db";
import { apiError, requireApiKey, requireScope } from "@/lib/api-auth";

const patchSchema = z.object({
  url: z.url().optional(),
  events: z.array(z.string()).min(1).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "webhooks.manage");
  if (denied) return denied;

  const { id } = await params;
  const [hook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.teamId, auth.teamId!)));
  if (!hook) return apiError(404, "not_found", "Webhook not found.");
  return NextResponse.json({
    id: hook.id,
    url: hook.url,
    secret: hook.secret,
    events: hook.events,
    enabled: hook.enabled,
    created_at: hook.createdAt.toISOString(),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "webhooks.manage");
  if (denied) return denied;

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
    .update(webhooks)
    .set(parsed.data)
    .where(and(eq(webhooks.id, id), eq(webhooks.teamId, auth.teamId!)))
    .returning();
  if (updated.length === 0) {
    return apiError(404, "not_found", "Webhook not found.");
  }
  const hook = updated[0];
  return NextResponse.json({
    id: hook.id,
    url: hook.url,
    events: hook.events,
    enabled: hook.enabled,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "webhooks.manage");
  if (denied) return denied;

  const { id } = await params;
  const deleted = await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.teamId, auth.teamId!)))
    .returning({ id: webhooks.id });
  if (deleted.length === 0) {
    return apiError(404, "not_found", "Webhook not found.");
  }
  return NextResponse.json({ id, deleted: true });
}
