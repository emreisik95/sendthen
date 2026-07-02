import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, audiences, contacts } from "@/lib/db";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { newContactId } from "@/lib/id";

const createSchema = z.object({
  email: z.email(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  unsubscribed: z.boolean().optional(),
});

async function ownedAudience(audienceId: string, userId: string) {
  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, audienceId), eq(audiences.userId, userId)));
  return audience;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!(await ownedAudience(id, auth.userId!))) {
    return apiError(404, "not_found", "Audience not found.");
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

  const [contact] = await db
    .insert(contacts)
    .values({
      id: newContactId(),
      audienceId: id,
      email: parsed.data.email.toLowerCase(),
      firstName: parsed.data.first_name ?? null,
      lastName: parsed.data.last_name ?? null,
      unsubscribed: parsed.data.unsubscribed ?? false,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (!contact) {
    return apiError(409, "already_exists", "Contact already in audience.");
  }
  return NextResponse.json({ id: contact.id }, { status: 201 });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!(await ownedAudience(id, auth.userId!))) {
    return apiError(404, "not_found", "Audience not found.");
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.audienceId, id))
    .orderBy(desc(contacts.createdAt));
  return NextResponse.json({
    data: rows.map((c) => ({
      id: c.id,
      email: c.email,
      first_name: c.firstName,
      last_name: c.lastName,
      unsubscribed: c.unsubscribed,
      created_at: c.createdAt.toISOString(),
    })),
  });
}
