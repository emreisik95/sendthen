import { desc, eq } from "drizzle-orm";
import { db, webhookDeliveries, webhooks } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import {
  createWebhookAction,
  deleteWebhookAction,
  toggleWebhookAction,
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
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

import { EVENT_TYPES } from "@/lib/db";

export default async function WebhooksPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const rows = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.teamId, team.id))
    .orderBy(desc(webhooks.createdAt));

  const deliveries = await db
    .select({
      d: webhookDeliveries,
      url: webhooks.url,
    })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
    .where(eq(webhooks.teamId, team.id))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(20);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Webhooks" />

      <form
        action={createWebhookAction}
        className="mb-6 rounded-[10px] border border-line bg-surface p-4"
      >
        <div className="mb-3 flex gap-2">
          <input
            name="url"
            placeholder="https://example.com/hooks/sendthen"
            required
            className={`${inputCls} font-mono`}
          />
          <button type="submit" className={btnPrimary}>
            Add webhook
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {EVENT_TYPES.map((ev) => (
            <label
              key={ev}
              className="flex items-center gap-1.5 font-mono text-xs text-fg-muted"
            >
              <input
                type="checkbox"
                name="events"
                value={ev}
                defaultChecked={ev !== "email.queued"}
                className="accent-[#C6FF00]"
              />
              {ev}
            </label>
          ))}
        </div>
      </form>

      {rows.length === 0 ? (
        <Empty>No webhooks. Add one to receive email events.</Empty>
      ) : (
        <Card className="mb-8 divide-y divide-hairline">
          {rows.map((h) => (
            <div key={h.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {h.url}
                </code>
                <StatusPill status={h.enabled ? "verified" : "canceled"} />
                <form action={toggleWebhookAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <button type="submit" className={btnSecondary}>
                    {h.enabled ? "Disable" : "Enable"}
                  </button>
                </form>
                <form action={deleteWebhookAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <button type="submit" className={btnDanger}>
                    Delete
                  </button>
                </form>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-xs text-fg-faint">
                  {h.events.join(" · ")}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <code className="truncate font-mono text-xs text-fg-faint">
                  {h.secret}
                </code>
                <CopyButton value={h.secret} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {deliveries.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Recent deliveries
          </h2>
          <Card className="divide-y divide-hairline">
            {deliveries.map(({ d, url }) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted">
                  {url}
                </code>
                <span className="font-mono text-xs tabular-nums text-fg-faint">
                  {d.responseStatus ?? "—"} · try {d.attempts} ·{" "}
                  {fmtDate(d.createdAt)}
                </span>
                <StatusPill status={d.status} />
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
