import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, apiKeys, type ApiKey } from "./db";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Granular API key scopes, selectable at key creation. */
export const SCOPES = [
  { value: "emails.send", label: "Send emails", group: "Emails" },
  { value: "emails.read", label: "Read emails & events", group: "Emails" },
  { value: "domains.manage", label: "Manage domains", group: "Resources" },
  { value: "templates.manage", label: "Manage templates", group: "Resources" },
  { value: "audiences.manage", label: "Manage audiences & contacts", group: "Resources" },
  { value: "broadcasts.manage", label: "Manage & send broadcasts", group: "Resources" },
  { value: "webhooks.manage", label: "Manage webhooks", group: "Admin" },
  { value: "keys.manage", label: "Manage API keys", group: "Admin" },
] as const;

export type Scope = (typeof SCOPES)[number]["value"];

const ALL_SCOPES = SCOPES.map((s) => s.value);

/** Effective scopes: explicit list, or derived from the legacy permission. */
export function scopesOf(
  key: Pick<ApiKey, "permission" | "scopes">,
): Scope[] {
  if (key.scopes && key.scopes.length > 0) return key.scopes as Scope[];
  if (key.permission === "sending") return ["emails.send", "emails.read"];
  return [...ALL_SCOPES];
}

/** 403 unless the key carries the scope. */
export function requireScope(
  key: ApiKey,
  scope: Scope,
): NextResponse | null {
  if (scopesOf(key).includes(scope)) return null;
  return apiError(
    403,
    "missing_scope",
    `This API key does not have the ${scope} scope.`,
  );
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
  if (!key.teamId) {
    return apiError(
      401,
      "orphan_api_key",
      "This key is not attached to a team yet. Sign in to the dashboard once to claim it.",
    );
  }

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id));

  return key;
}
