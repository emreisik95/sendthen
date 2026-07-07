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

  // recipient — defaults to the signed-in user's own address
  const to = String(form.get("to") ?? "").trim() || user.email;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "Invalid recipient address." }, { status: 422 });
  }

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.teamId, team.id));
  const mode =
    settings && settings.mailMode !== "inherit" ? settings.mailMode : mailMode();

  // from address: the caller picks a verified domain (from_local@domain). Fall
  // back to the first verified domain, then to a sandbox address.
  const domainId = String(form.get("domain_id") ?? "").trim();
  let chosen: { name: string } | undefined;
  if (domainId) {
    const [d] = await db
      .select({ name: domains.name })
      .from(domains)
      .where(
        and(
          eq(domains.id, domainId),
          eq(domains.teamId, team.id),
          eq(domains.status, "verified"),
        ),
      )
      .limit(1);
    if (!d) {
      return NextResponse.json(
        { error: "Pick one of your verified sending domains." },
        { status: 422 },
      );
    }
    chosen = d;
  } else {
    const [d] = await db
      .select({ name: domains.name })
      .from(domains)
      .where(and(eq(domains.teamId, team.id), eq(domains.status, "verified")))
      .limit(1);
    chosen = d;
  }

  if (!chosen && mode !== "sandbox") {
    return NextResponse.json(
      {
        error:
          "Add and verify a sending domain first — test sends need a verified from address outside sandbox mode.",
      },
      { status: 403 },
    );
  }

  const fromName = String(form.get("from_name") ?? "").trim() || "sendthen";
  // sanitise the local part to RFC-safe characters; default to "hello"
  const fromLocal =
    String(form.get("from_local") ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._+-]/g, "") || "hello";
  const fromAddr = chosen ? `${fromLocal}@${chosen.name}` : "test@sandbox.local";
  const from = `${fromName} <${fromAddr}>`;

  // caller-supplied variable values, over sample defaults
  let userVars: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(form.get("vars") ?? "{}")) as unknown;
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "string") userVars[k] = v;
      }
    }
  } catch {
    userVars = {};
  }
  const vars: Record<string, string> = {
    name: user.name,
    code: "123456",
    title: "A test from the builder",
    unsubscribe_url: "https://example.com/unsubscribe/preview",
    ...userVars,
  };
  const render = (s: string) =>
    s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => vars[k] ?? `{{${k}}}`);

  try {
    const { id } = await createEmail(team.id, user.id, null, {
      from,
      to: [to],
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
