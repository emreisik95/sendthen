import { desc, eq } from "drizzle-orm";
import { db, templates } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { deleteTemplateAction, saveTemplateAction } from "@/app/actions";
import { PRESETS } from "@/lib/template-builder/presets";
import {
  Card,
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
          Create new →
        </a>
      </PageHeader>
      <p className="mb-6 text-sm text-fg-muted">
        Reusable emails with{" "}
        <code className="font-mono text-fg">{"{{variables}}"}</code>. Send via{" "}
        <code className="font-mono text-fg">template_id</code> +{" "}
        <code className="font-mono text-fg">variables</code>.
      </p>

      {rows.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <p className="mb-2 text-sm text-fg">No templates yet.</p>
          <p className="mb-6 text-sm text-fg-muted">
            Start from a blank canvas or pick a starter preset.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a href="/templates/builder" className={btnPrimary}>
              Create new →
            </a>
            {PRESETS.map((p) => (
              <a
                key={p.key}
                href={`/templates/builder?preset=${p.key}`}
                className="rounded-md border border-line px-4 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                {p.name}
              </a>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  {t.name}
                  {t.design ? (
                    <span className="rounded bg-lime/14 px-1.5 py-0.5 font-mono text-[10px] text-lime">
                      builder
                    </span>
                  ) : (
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-faint">
                      html
                    </span>
                  )}
                </div>
                <div className="truncate font-mono text-xs text-fg-faint">
                  {t.id} · {t.subject}
                </div>
              </div>
              <span className="font-mono text-xs text-fg-faint">
                {fmtDate(t.updatedAt)}
              </span>
              <a
                href={
                  t.design
                    ? `/templates/builder?id=${t.id}`
                    : `/templates?edit=${t.id}`
                }
                className="rounded-md border border-line px-3 py-1.5 text-xs text-fg transition-colors hover:bg-surface-2"
              >
                Edit
              </a>
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

      {/* raw-HTML editing only appears when explicitly editing a non-builder template */}
      {editing && !editing.design && (
        <form
          action={saveTemplateAction}
          className="mt-8 rounded-[10px] border border-line bg-surface p-4"
        >
          <h2 className="mb-3 text-sm font-medium">
            Edit raw HTML template — {editing.name}
          </h2>
          <input type="hidden" name="id" value={editing.id} />
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <input
              name="name"
              defaultValue={editing.name}
              required
              className={inputCls}
            />
            <input
              name="subject"
              defaultValue={editing.subject}
              required
              className={inputCls}
            />
          </div>
          <textarea
            name="html"
            rows={8}
            defaultValue={editing.html ?? ""}
            className={`${inputCls} mb-3 font-mono text-xs`}
          />
          <textarea
            name="text"
            rows={2}
            defaultValue={editing.text ?? ""}
            placeholder="Plain text version (optional)"
            className={`${inputCls} mb-3 font-mono text-xs`}
          />
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary}>
              Save changes
            </button>
            <a
              href="/templates"
              className="rounded-md border border-line px-4 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
            >
              Cancel
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
