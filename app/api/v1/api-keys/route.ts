import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, apiKeys } from "@/lib/db";
import { apiError, hashToken, requireApiKey } from "@/lib/api-auth";
import { newApiKeyId, newApiToken } from "@/lib/id";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  permission: z.enum(["full", "sending"]).default("full"),
});

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.permission !== "full") {
    return apiError(403, "forbidden", "This key cannot manage API keys.");
  }

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

  const token = newApiToken();
  const [key] = await db
    .insert(apiKeys)
    .values({
      id: newApiKeyId(),
      userId: auth.userId,
      teamId: auth.teamId,
      name: parsed.data.name,
      tokenHash: hashToken(token),
      tokenPrefix: token.slice(0, 12),
      permission: parsed.data.permission,
      createdAt: new Date(),
    })
    .returning();

  // token is returned exactly once
  return NextResponse.json({ id: key.id, name: key.name, token }, { status: 201 });
}

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(isNull(apiKeys.revokedAt), eq(apiKeys.teamId, auth.teamId!)))
    .orderBy(desc(apiKeys.createdAt));

  return NextResponse.json({
    data: rows.map((k) => ({
      id: k.id,
      name: k.name,
      token_prefix: k.tokenPrefix,
      permission: k.permission,
      last_used_at: k.lastUsedAt?.toISOString() ?? null,
      created_at: k.createdAt.toISOString(),
    })),
  });
}
