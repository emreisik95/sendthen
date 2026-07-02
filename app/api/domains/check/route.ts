import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, domains } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { verifyDomain } from "@/lib/dns-verify";

/** Dashboard-session endpoint used by the live domain checker. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { team } = await getActiveTeam(user);

  let id: string;
  try {
    ({ id } = (await req.json()) as { id: string });
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, String(id)), eq(domains.teamId, team.id)));
  if (!domain) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await verifyDomain(domain);
  return NextResponse.json(result);
}
