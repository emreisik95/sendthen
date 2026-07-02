import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, audiences } from "@/lib/db";
import { apiError, requireApiKey, requireScope } from "@/lib/api-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "audiences.manage");
  if (denied) return denied;

  const { id } = await params;
  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.teamId, auth.teamId!)));
  if (!audience) return apiError(404, "not_found", "Audience not found.");
  return NextResponse.json({
    id: audience.id,
    name: audience.name,
    created_at: audience.createdAt.toISOString(),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "audiences.manage");
  if (denied) return denied;

  const { id } = await params;
  const deleted = await db
    .delete(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.teamId, auth.teamId!)))
    .returning({ id: audiences.id });
  if (deleted.length === 0) {
    return apiError(404, "not_found", "Audience not found.");
  }
  return NextResponse.json({ id, deleted: true });
}
