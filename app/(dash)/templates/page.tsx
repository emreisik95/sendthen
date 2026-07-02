import { desc, eq } from "drizzle-orm";
import { db, templates } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { deleteTemplateAction, saveTemplateAction } from "@/app/actions";
import {
  Card,
  Empty,
  PageHeader,
  btnDanger,
  btnPrimary,
  fmtDate,
  inputCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { edit } = await searchParams;
  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.teamId, team.id))
    .orderBy(desc(templates.updatedAt));
  const editing = edit ? rows.find((t) => t.id === edit) : undefined;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Templates">
        <a href="/templates/builder" className={btnPrimary}>
          Open builder →
        </a>
      </PageHeader>
      <p className="mb-6 text-sm text-fg-muted">
        Reusable emails with <code className="font-mono text-fg">{"{{variables}}"}</code>.
        Build visually with the no-code builder, or paste HTML below. Send via{" "}
        <code className="font-mono text-fg">template_id</code> +{" "}
        <code className="font-mono text-fg">variables</code>.
      </p>

      <form
        action={saveTemplateAction}
        className="mb-8 rounded-[10px] border border-line bg-surface p-4"
      >
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <input
            name="name"
            placeholder="template name (e.g. welcome)"
            defaultValue={editing?.name ?? ""}
            required
            className={inputCls}
          />
          <input
            name="subject"
            placeholder="subject — Hi {{name}}!"
            defaultValue={editing?.subject ?? ""}
            required
            className={inputCls}
          />
        </div>
        <textarea
          name="html"
          rows={6}
          placeholder="<h1>Welcome {{name}}</h1>"
          defaultValue={editing?.html ?? ""}
          className={`${inputCls} mb-3 font-mono text-xs`}
        />
        <textarea
          name="text"
          rows={2}
          placeholder="Plain text version (optional)"
          defaultValue={editing?.text ?? ""}
          className={`${inputCls} mb-3 font-mono text-xs`}
        />
        <button type="submit" className={btnPrimary}>
          {editing ? "Update template" : "Create template"}
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>No templates yet.</Empty>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm">{t.name}</div>
                <div className="truncate font-mono text-xs text-fg-faint">
                  {t.id} · {t.subject}
                </div>
              </div>
              <span className="font-mono text-xs text-fg-faint">
                {fmtDate(t.updatedAt)}
              </span>
              {t.design ? (
                <a
                  href={`/templates/builder?id=${t.id}`}
                  className="rounded-md border border-lime/40 px-3 py-1.5 text-xs text-lime transition-colors hover:bg-surface-2"
                >
                  Open in builder
                </a>
              ) : (
                <a
                  href={`/templates?edit=${t.id}`}
                  className="rounded-md border border-line px-3 py-1.5 text-xs text-fg transition-colors hover:bg-surface-2"
                >
                  Edit
                </a>
              )}
              <form action={deleteTemplateAction}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className={btnDanger}>
                  Delete
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
