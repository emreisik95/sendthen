import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, webhooks, EVENT_TYPES } from "@/lib/db";
import { apiError, requireApiKey, requireScope } from "@/lib/api-auth";
import { newWebhookId, newWebhookSecret } from "@/lib/id";

const createSchema = z.object({
  url: z.url(),
  events: z.array(z.enum(EVENT_TYPES)).min(1),
});

export async function POST(req: Request) {
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "validation_error", parsed.error.issues[0].message);
  }

  const [hook] = await db
    .insert(webhooks)
    .values({
      id: newWebhookId(),
      userId: auth.userId,
      teamId: auth.teamId,
      url: parsed.data.url,
      secret: newWebhookSecret(),
      events: [...parsed.data.events],
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json(
    {
      id: hook.id,
      url: hook.url,
      secret: hook.secret,
      events: hook.events,
      enabled: hook.enabled,
      created_at: hook.createdAt.toISOString(),
    },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "webhooks.manage");
  if (denied) return denied;

  const rows = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.teamId, auth.teamId!))
    .orderBy(desc(webhooks.createdAt));
  return NextResponse.json({
    data: rows.map((h) => ({
      id: h.id,
      url: h.url,
      events: h.events,
      enabled: h.enabled,
      created_at: h.createdAt.toISOString(),
    })),
  });
}
