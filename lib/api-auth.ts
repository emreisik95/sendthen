import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, apiKeys, type ApiKey } from "./db";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ApiError {
  statusCode: number;
  name: string;
  message: string;
}

export function apiError(
  statusCode: number,
  name: string,
  message: string,
): NextResponse {
  return NextResponse.json({ statusCode, name, message }, { status: statusCode });
}

/**
 * Authenticate a Bearer st_… token. Returns the ApiKey row or an error
 * response ready to return from the route handler.
 */
export async function requireApiKey(
  req: Request,
): Promise<ApiKey | NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("st_")) {
    return apiError(
      401,
      "missing_api_key",
      "Missing API key. Pass it as: Authorization: Bearer st_…",
    );
  }

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(
      and(eq(apiKeys.tokenHash, hashToken(token)), isNull(apiKeys.revokedAt)),
    );
  if (!key) {
    return apiError(401, "invalid_api_key", "API key is invalid or revoked.");
  }
  if (!key.userId) {
    return apiError(
      401,
      "orphan_api_key",
      "This key predates multi-user support. Sign up in the dashboard to claim it.",
    );
  }

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id));

  return key;
}
