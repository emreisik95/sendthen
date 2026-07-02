import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, apiKeys } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.permission !== "full") {
    return apiError(403, "forbidden", "This key cannot manage API keys.");
  }

  const { id } = await params;
  const revoked = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.teamId, auth.teamId!),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });
  if (revoked.length === 0) {
    return apiError(404, "not_found", "API key not found.");
  }
  return NextResponse.json({ id, revoked: true });
}
