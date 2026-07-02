import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, domains } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { verifyDomain } from "@/lib/dns-verify";
import { domainResponse } from "@/lib/serialize";

export async function POST(
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

  await verifyDomain(domain);
  const [fresh] = await db.select().from(domains).where(eq(domains.id, id));
  return NextResponse.json(domainResponse(fresh));
}
