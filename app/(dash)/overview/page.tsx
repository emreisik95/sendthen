import { and, eq, gte, inArray } from "drizzle-orm";
import { db, emailEvents, emails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAYS = 14;

const SEGMENTS = [
  { key: "delivered", label: "Delivered", color: "var(--ok)" },
  { key: "sent", label: "Sent", color: "var(--info)" },
  { key: "queued", label: "Queued", color: "var(--fg-muted)" },
  { key: "failed", label: "Bounced / failed", color: "var(--danger)" },
  { key: "canceled", label: "Canceled", color: "var(--fg-faint)" },
] as const;

type SegKey = (typeof SEGMENTS)[number]["key"];

function bucketOf(status: string): SegKey {
  if (status === "delivered") return "delivered";
  if (status === "sent" || status === "sending") return "sent";
  if (status === "queued") return "queued";
  if (status === "canceled") return "canceled";
  return "failed"; // bounced + failed
}

export default async function OverviewPage() {
  const user = await requireUser();
  const since = new Date(Date.now() - DAYS * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ status: emails.status, createdAt: emails.createdAt, id: emails.id })
    .from(emails)
    .where(and(eq(emails.userId, user.id), gte(emails.createdAt, since)));

  // day buckets, oldest → newest
  const days: { label: string; key: string; counts: Record<SegKey, number> }[] =
    [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toDateString(),
      label: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
      }).format(d),
      counts: { delivered: 0, sent: 0, queued: 0, failed: 0, canceled: 0 },
    });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const row of rows) {
    const day = byKey.get(new Date(row.createdAt).toDateString());
    if (day) day.counts[bucketOf(row.status)]++;
  }
  const maxTotal = Math.max(
    1,
    ...days.map((d) => Object.values(d.counts).reduce((a, b) => a + b, 0)),
  );

  // engagement: unique emails opened / clicked among this window
  const ids = rows.map((r) => r.id);
  const events =
    ids.length > 0
      ? await db
          .select({ type: emailEvents.type, emailId: emailEvents.emailId })
          .from(emailEvents)
          .where(
            and(
              inArray(emailEvents.emailId, ids.slice(0, 5000)),
              inArray(emailEvents.type, ["email.opened", "email.clicked"]),
            ),
          )
      : [];
  const opened = new Set(
    events.filter((e) => e.type === "email.opened").map((e) => e.emailId),
  ).size;
  const clicked = new Set(
    events.filter((e) => e.type === "email.clicked").map((e) => e.emailId),
  ).size;

  const total = rows.length;
  const delivered = rows.filter((r) => bucketOf(r.status) === "delivered").length;
  const failed = rows.filter((r) => bucketOf(r.status) === "failed").length;
  const pct = (n: number, of: number) =>
    of === 0 ? "—" : `${Math.round((n / of) * 100)}%`;

  const tiles = [
    { label: `Emails · ${DAYS}d`, value: String(total) },
    { label: "Delivered", value: pct(delivered, total) },
    { label: "Opened", value: pct(opened, delivered) },
    { label: "Clicked", value: pct(clicked, delivered) },
    { label: "Bounced / failed", value: String(failed) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Overview" />

      {/* stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="px-4 py-3">
            <div className="font-mono text-xl tabular-nums text-fg">
              {t.value}
            </div>
            <div className="mt-0.5 text-xs text-fg-faint">{t.label}</div>
          </Card>
        ))}
      </div>

      {/* daily volume, segmented by status */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Daily volume</h2>
          <ul className="flex flex-wrap gap-3">
            {SEGMENTS.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-1.5 text-xs text-fg-muted"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute right-0 top-0 font-mono text-[10px] text-fg-faint">
            max {maxTotal}
          </div>
          <div className="flex h-40 items-end gap-1.5 border-b border-line pt-4">
            {days.map((d) => {
              const dayTotal = Object.values(d.counts).reduce(
                (a, b) => a + b,
                0,
              );
              return (
                <div
                  key={d.key}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                >
                  {/* hover tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface-3 px-3 py-2 font-mono text-[11px] leading-relaxed group-hover:block">
                    <div className="text-fg">{d.label} — {dayTotal}</div>
                    {SEGMENTS.filter((s) => d.counts[s.key] > 0).map((s) => (
                      <div key={s.key} className="text-fg-muted">
                        <span
                          aria-hidden
                          className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ background: s.color }}
                        />
                        {s.label}: {d.counts[s.key]}
                      </div>
                    ))}
                    {dayTotal === 0 && (
                      <div className="text-fg-faint">no emails</div>
                    )}
                  </div>

                  {/* segments, top segment rounded */}
                  {SEGMENTS.map((s, i) => {
                    const value = d.counts[s.key];
                    if (value === 0) return null;
                    const isTop = SEGMENTS.slice(0, i).every(
                      (p) => d.counts[p.key] === 0,
                    );
                    return (
                      <div
                        key={s.key}
                        style={{
                          background: s.color,
                          height: `max(${(value / maxTotal) * 100}%, 3px)`,
                          borderRadius: isTop ? "4px 4px 0 0" : 0,
                          marginTop: 2,
                        }}
                      />
                    );
                  })}
                  {dayTotal === 0 && (
                    <div className="h-px w-full bg-surface-3" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {days.map((d, i) => (
              <div
                key={d.key}
                className="flex-1 text-center font-mono text-[10px] text-fg-faint"
              >
                {i % 2 === DAYS % 2 ? d.label.split(" ")[0] : ""}
              </div>
            ))}
          </div>
        </div>

        {/* table view for accessibility */}
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-fg-faint hover:text-fg-muted">
            View as table
          </summary>
          <table className="mt-3 w-full text-xs">
            <thead className="text-left text-fg-faint">
              <tr>
                <th className="py-1 pr-4 font-medium">Day</th>
                {SEGMENTS.map((s) => (
                  <th key={s.key} className="py-1 pr-4 font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-fg-muted">
              {days.map((d) => (
                <tr key={d.key} className="border-t border-hairline">
                  <td className="py-1 pr-4">{d.label}</td>
                  {SEGMENTS.map((s) => (
                    <td key={s.key} className="py-1 pr-4">
                      {d.counts[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>
    </div>
  );
}
