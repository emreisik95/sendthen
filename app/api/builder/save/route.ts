import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, templates } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { newTemplateId } from "@/lib/id";
import { compileDesign, designToText } from "@/lib/template-builder/compile";
import type { TemplateDesign } from "@/lib/template-builder/types";

/** Dashboard-session endpoint used by the visual builder's Save button. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { team } = await getActiveTeam(user);

  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim() || "untitled";
  const subject = String(form.get("subject") ?? "").trim() || "No subject";

  let design: TemplateDesign;
  try {
    design = JSON.parse(String(form.get("design") ?? ""));
    if (design.version !== 1 || !Array.isArray(design.blocks)) throw new Error();
  } catch {
    return NextResponse.json({ error: "invalid design" }, { status: 422 });
  }

  const html = compileDesign(design);
  const text = designToText(design);
  const now = new Date();

  if (id) {
    const updated = await db
      .update(templates)
      .set({
        name,
        subject,
        html,
        text,
        design: design as unknown as Record<string, unknown>,
        updatedAt: now,
      })
      .where(and(eq(templates.id, id), eq(templates.teamId, team.id)))
      .returning({ id: templates.id });
    if (updated.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ id });
  }

  const newId = newTemplateId();
  await db.insert(templates).values({
    id: newId,
    userId: user.id,
    teamId: team.id,
    name,
    subject,
    html,
    text,
    design: design as unknown as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id: newId });
}
