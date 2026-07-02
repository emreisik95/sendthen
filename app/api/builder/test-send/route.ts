import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, domains, userSettings } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { mailMode } from "@/lib/mailer";
import { compileDesign, designToText } from "@/lib/template-builder/compile";
import { SendError, createEmail } from "@/lib/send-email";
import { kickQueue } from "@/lib/queue";
import type { TemplateDesign } from "@/lib/template-builder/types";

/** Sends the current builder design to the signed-in user's own address. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { team } = await getActiveTeam(user);

  const form = await req.formData();
  const subject = String(form.get("subject") ?? "").trim() || "Builder test";
  let design: TemplateDesign;
  try {
    design = JSON.parse(String(form.get("design") ?? ""));
    if (design.version !== 1 || !Array.isArray(design.blocks)) throw new Error();
  } catch {
    return NextResponse.json({ error: "invalid design" }, { status: 422 });
  }

  // pick a from address: first verified team domain, else sandbox-only fallback
  const [verified] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.teamId, team.id), eq(domains.status, "verified")))
    .limit(1);

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.teamId, team.id));
  const mode =
    settings && settings.mailMode !== "inherit" ? settings.mailMode : mailMode();

  if (!verified && mode !== "sandbox") {
    return NextResponse.json(
      {
        error:
          "Add and verify a sending domain first — test sends need a verified from address outside sandbox mode.",
      },
      { status: 403 },
    );
  }

  const from = verified
    ? `sendthen test <test@${verified.name}>`
    : "sendthen test <test@sandbox.local>";

  // sample variables so the preview reads like a real email
  const vars: Record<string, string> = {
    name: user.name,
    code: "123456",
    title: "A test from the builder",
    unsubscribe_url: "https://example.com/unsubscribe/preview",
  };
  const render = (s: string) =>
    s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => vars[k] ?? `{{${k}}}`);

  try {
    const { id } = await createEmail(team.id, user.id, null, {
      from,
      to: [user.email],
      subject: render(subject),
      html: render(compileDesign(design)),
      text: render(designToText(design)),
    });
    kickQueue();
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof SendError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
