import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db, templates } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { PRESETS } from "@/lib/template-builder/presets";
import {
  DEFAULT_STYLES,
  type TemplateDesign,
} from "@/lib/template-builder/types";
import { Editor } from "@/components/builder/editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Template builder",
};

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; preset?: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { id, preset } = await searchParams;

  let initial:
    | { id?: string; name: string; subject: string; design: TemplateDesign }
    | undefined;

  if (id) {
    const [tpl] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.teamId, team.id)));
    if (tpl?.design) {
      initial = {
        id: tpl.id,
        name: tpl.name,
        subject: tpl.subject,
        design: tpl.design as unknown as TemplateDesign,
      };
    }
  } else if (preset) {
    const p = PRESETS.find((x) => x.key === preset);
    if (p) {
      initial = { name: p.name, subject: p.subject, design: p.design };
    }
  }

  initial ??= {
    name: "untitled",
    subject: "Hello {{name}}",
    design: { version: 1, styles: { ...DEFAULT_STYLES }, blocks: [] },
  };

  return <Editor initial={initial} presets={PRESETS} />;
}
