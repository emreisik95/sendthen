import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, domains } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { domainResponse } from "@/lib/serialize";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.userId, auth.userId!)));
  if (!domain) return apiError(404, "not_found", "Domain not found.");
  return NextResponse.json(domainResponse(domain));
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const deleted = await db
    .delete(domains)
    .where(and(eq(domains.id, id), eq(domains.userId, auth.userId!)))
    .returning({ id: domains.id });
  if (deleted.length === 0) {
    return apiError(404, "not_found", "Domain not found.");
  }
  return NextResponse.json({ id, deleted: true });
}
