import { desc, eq } from "drizzle-orm";
import { db, audiences, broadcasts } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import {
  createBroadcastAction,
  deleteBroadcastAction,
  sendBroadcastAction,
} from "@/app/actions";
import {
  Card,
  Empty,
  PageHeader,
  StatusPill,
  btnDanger,
  btnPrimary,
  btnSecondary,
  fmtDate,
  inputCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  no_audience: "Pick a valid audience.",
  missing: "From, subject and HTML are required.",
  not_sendable: "That broadcast was already sent.",
  domain_not_verified:
    "Sender domain is not verified — verify it under Domains first.",
};

export default async function BroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const myAudiences = await db
    .select()
    .from(audiences)
    .where(eq(audiences.userId, user.id))
    .orderBy(desc(audiences.createdAt));
  const rows = await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.userId, user.id))
    .orderBy(desc(broadcasts.createdAt));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Broadcasts" />
      <p className="mb-6 text-sm text-fg-muted">
        One-to-many sends with per-contact{" "}
        <code className="font-mono text-fg">
          {"{{first_name}} {{unsubscribe_url}}"}
        </code>{" "}
        variables and one-click unsubscribe headers.
      </p>

      {error && ERRORS[error] && (
        <Card className="mb-6 border-danger/40 px-4 py-3 text-sm text-danger">
          {ERRORS[error]}
        </Card>
      )}

      {myAudiences.length === 0 ? (
        <Empty>Create an audience with contacts first.</Empty>
      ) : (
        <form
          action={createBroadcastAction}
          className="mb-8 rounded-[10px] border border-line bg-surface p-4"
        >
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <select
              name="audienceId"
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
            >
              {myAudiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              name="from"
              placeholder="Your Name <news@yourdomain.com>"
              required
              className={`${inputCls} font-mono`}
            />
          </div>
          <input
            name="subject"
            placeholder="Subject — Hey {{first_name}}!"
            required
            className={`${inputCls} mb-3`}
          />
          <textarea
            name="html"
            rows={6}
            required
            placeholder={'<h1>Hi {{first_name}}</h1>\n<p>...</p>\n<a href="{{unsubscribe_url}}">Unsubscribe</a>'}
            className={`${inputCls} mb-3 font-mono text-xs`}
          />
          <button type="submit" className={btnPrimary}>
            Save draft
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <Empty>No broadcasts yet.</Empty>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{b.subject}</div>
                <div className="font-mono text-xs text-fg-faint">
                  {b.from} · {fmtDate(b.createdAt)}
                </div>
              </div>
              <StatusPill status={b.status === "draft" ? "pending" : b.status} />
              {b.status === "draft" && (
                <>
                  <form action={sendBroadcastAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className={btnSecondary}>
                      Send now
                    </button>
                  </form>
                  <form action={deleteBroadcastAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className={btnDanger}>
                      Delete
                    </button>
                  </form>
                </>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
