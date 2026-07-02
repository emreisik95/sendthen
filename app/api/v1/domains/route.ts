import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, domains } from "@/lib/db";
import { apiError, requireApiKey, requireScope } from "@/lib/api-auth";
import { newDomainId } from "@/lib/id";
import { generateDkimKeyPair } from "@/lib/dkim";
import { domainResponse } from "@/lib/serialize";

const createSchema = z.object({
  name: z
    .string()
    .regex(
      /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i,
      "Invalid domain name.",
    )
    .transform((v) => v.toLowerCase()),
});

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "domains.manage");
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

  const [existing] = await db
    .select()
    .from(domains)
    .where(eq(domains.name, parsed.data.name));
  if (existing) {
    return apiError(409, "already_exists", "Domain already added.");
  }

  const { privateKey, publicKey } = generateDkimKeyPair();
  const [domain] = await db
    .insert(domains)
    .values({
      id: newDomainId(),
      userId: auth.userId,
      teamId: auth.teamId,
      name: parsed.data.name,
      dkimPrivateKey: privateKey,
      dkimPublicKey: publicKey,
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json(domainResponse(domain), { status: 201 });
}

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "domains.manage");
  if (denied) return denied;

  const rows = await db
    .select()
    .from(domains)
    .where(eq(domains.teamId, auth.teamId!))
    .orderBy(desc(domains.createdAt));
  return NextResponse.json({ data: rows.map(domainResponse) });
}
