import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, audiences } from "@/lib/db";
import { apiError, requireApiKey, requireScope } from "@/lib/api-auth";
import { newAudienceId } from "@/lib/id";

const createSchema = z.object({ name: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "audiences.manage");
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

  const [audience] = await db
    .insert(audiences)
    .values({
      id: newAudienceId(),
      userId: auth.userId!,
      teamId: auth.teamId,
      name: parsed.data.name,
      createdAt: new Date(),
    })
    .returning();
  return NextResponse.json(
    {
      id: audience.id,
      name: audience.name,
      created_at: audience.createdAt.toISOString(),
    },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireScope(auth, "audiences.manage");
  if (denied) return denied;

  const rows = await db
    .select()
    .from(audiences)
    .where(eq(audiences.teamId, auth.teamId!))
    .orderBy(desc(audiences.createdAt));
  return NextResponse.json({
    data: rows.map((a) => ({
      id: a.id,
      name: a.name,
      created_at: a.createdAt.toISOString(),
    })),
  });
}
