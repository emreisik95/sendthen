import Link from "next/link";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import {
  broadcasts,
  db,
  domains,
  emailEvents,
  emails,
  inboundEmails,
} from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { Card, PageHeader, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

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

const DAY_MS = 86_400_000;
const fmtDay = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

interface Bucket {
  key: string;
  label: string;
  start: number; // ms epoch, midnight
  counts: Record<SegKey, number>;
  opens: number;
  clicks: number;
}

function domainOfAddress(from: string): string {
  const m = from.match(/@([a-zA-Z0-9.-]+)/);
  return m ? m[1].toLowerCase() : "unknown";
}

function pct(n: number, of: number): string {
  return of === 0 ? "—" : `${Math.round((n / of) * 100)}%`;
}

/* ---------- range switcher ---------- */

function RangePills({ active }: { active: Range }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Date range">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`/metrics?range=${r}`}
          aria-current={r === active ? "page" : undefined}
          className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
            r === active
              ? "bg-lime text-on-lime"
              : "border border-line text-fg-muted hover:bg-surface-2 hover:text-fg"
          }`}
        >
          {r}d
        </Link>
      ))}
    </div>
  );
}

/* ---------- single-series mini bar chart ---------- */

function MiniBars({
  title,
  buckets,
  pick,
  unit,
  labelStep,
}: {
  title: string;
  buckets: Bucket[];
  pick: (b: Bucket) => number;
  unit: string;
  labelStep: number;
}) {
  const max = Math.max(1, ...buckets.map(pick));
  const lastIdx = buckets.length - 1;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="font-mono text-[10px] text-fg-faint">max {max}</span>
      </div>
      <div className="flex h-24 items-end gap-[2px] border-b border-line">
        {buckets.map((b) => {
          const value = pick(b);
          return (
            <div
              key={b.key}
              className="group relative flex h-full flex-1 flex-col justify-end"
            >
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface-3 px-3 py-2 font-mono text-[11px] leading-relaxed group-hover:block">
                <div className="text-fg">{b.label}</div>
                <div className="text-fg-muted">
                  {unit}: {value}
                </div>
              </div>
              {value > 0 ? (
                <div
                  style={{
                    background: "var(--lime, #C6FF00)",
                    height: `max(${(value / max) * 100}%, 3px)`,
                    borderRadius: "3px 3px 0 0",
                  }}
                />
              ) : (
                <div className="h-px w-full bg-surface-3" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {buckets.map((b, i) => (
          <div
            key={b.key}
            className="flex-1 overflow-visible text-center font-mono text-[10px] text-fg-faint"
          >
            {i % labelStep === lastIdx % labelStep ? b.label.split(" ")[0] : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const sp = await searchParams;
  const rangeParam = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  const range: Range = RANGES.includes(Number(rangeParam) as Range)
    ? (Number(rangeParam) as Range)
    : 30;

  // weekly buckets for 90 days, daily otherwise
  const bucketDays = range === 90 ? 7 : 1;
  const bucketCount = range === 90 ? 13 : range;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Bucket starts use local calendar days (setDate) so boundaries stay on
  // local midnight across DST transitions — same approach as the overview
  // page. Weekly buckets are aligned so the last bucket ends today, covering
  // the full trailing 90 days (not just 84).
  const buckets: Bucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const d = new Date(today);
    d.setDate(
      d.getDate() - ((bucketCount - 1 - i) * bucketDays + (bucketDays - 1)),
    );
    const start = d.getTime();
    buckets.push({
      key: String(start),
      label:
        bucketDays === 1
          ? fmtDay.format(start)
          : `wk of ${fmtDay.format(start)}`,
      start,
      counts: { delivered: 0, sent: 0, queued: 0, failed: 0, canceled: 0 },
      opens: 0,
      clicks: 0,
    });
  }
  const firstStart = buckets[0].start;
  const since = new Date(firstStart);
  const indexFor = (d: Date): number => {
    const m = new Date(d);
    m.setHours(0, 0, 0, 0);
    // Both sides are local midnights; Math.round absorbs the ±1h DST drift.
    const dayDiff = Math.round((m.getTime() - firstStart) / DAY_MS);
    if (dayDiff < 0) return -1;
    const idx = Math.floor(dayDiff / bucketDays);
    return idx < bucketCount ? idx : -1;
  };

  const rows = await db
    .select({
      id: emails.id,
      status: emails.status,
      createdAt: emails.createdAt,
      domainId: emails.domainId,
      from: emails.from,
      broadcastId: emails.broadcastId,
    })
    .from(emails)
    .where(and(eq(emails.teamId, team.id), gte(emails.createdAt, since)));

  const [inboundRow] = await db
    .select({ n: count() })
    .from(inboundEmails)
    .where(
      and(eq(inboundEmails.teamId, team.id), gte(inboundEmails.createdAt, since)),
    );
  const inboundCount = inboundRow?.n ?? 0;

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Analytics">
          <RangePills active={range} />
        </PageHeader>
        <Card className="px-6 py-16 text-center">
          <p className="text-sm text-fg-muted">
            No emails sent in the last {range} days.
          </p>
          <p className="mt-2 text-sm text-fg-faint">
            Send your first email —{" "}
            <Link href="/docs" className="text-lime hover:underline">
              see the docs
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  /* volume buckets */
  for (const row of rows) {
    const idx = indexFor(new Date(row.createdAt));
    if (idx >= 0) buckets[idx].counts[bucketOf(row.status)]++;
  }
  const maxTotal = Math.max(
    1,
    ...buckets.map((b) =>
      Object.values(b.counts).reduce((a, n) => a + n, 0),
    ),
  );

  /* engagement events */
  const ids = rows.map((r) => r.id);
  const events =
    ids.length > 0
      ? await db
          .select({
            type: emailEvents.type,
            emailId: emailEvents.emailId,
            createdAt: emailEvents.createdAt,
          })
          .from(emailEvents)
          .where(
            and(
              inArray(emailEvents.emailId, ids.slice(0, 5000)),
              inArray(emailEvents.type, [
                "email.opened",
                "email.clicked",
                "email.complained",
              ]),
              gte(emailEvents.createdAt, since),
            ),
          )
      : [];

  const openedIds = new Set<string>();
  const clickedIds = new Set<string>();
  const complainedIds = new Set<string>();
  const seenPerBucket = new Set<string>(); // `${idx}:${type}:${emailId}`
  for (const ev of events) {
    if (ev.type === "email.complained") {
      complainedIds.add(ev.emailId);
      continue;
    }
    const idx = indexFor(new Date(ev.createdAt));
    const isOpen = ev.type === "email.opened";
    (isOpen ? openedIds : clickedIds).add(ev.emailId);
    if (idx < 0) continue;
    const dedupeKey = `${idx}:${ev.type}:${ev.emailId}`;
    if (seenPerBucket.has(dedupeKey)) continue;
    seenPerBucket.add(dedupeKey);
    if (isOpen) buckets[idx].opens++;
    else buckets[idx].clicks++;
  }

  /* KPIs */
  const total = rows.length;
  const delivered = rows.filter((r) => bucketOf(r.status) === "delivered").length;
  const bounced = rows.filter((r) => r.status === "bounced").length;
  const badCount = bounced + complainedIds.size;

  const tiles: { label: string; value: string; danger?: boolean }[] = [
    { label: `Sent · ${range}d`, value: String(total) },
    { label: "Delivered rate", value: pct(delivered, total) },
    { label: "Open rate", value: pct(openedIds.size, delivered) },
    { label: "Click rate", value: pct(clickedIds.size, delivered) },
    {
      label: "Bounces + complaints",
      value: String(badCount),
      danger: badCount > 0,
    },
    { label: "Inbound received", value: String(inboundCount) },
  ];

  /* top sending domains by delivered count */
  const teamDomains = await db
    .select({ id: domains.id, name: domains.name })
    .from(domains)
    .where(eq(domains.teamId, team.id));
  const domainName = new Map(teamDomains.map((d) => [d.id, d.name]));
  const byDomain = new Map<string, number>();
  for (const r of rows) {
    if (bucketOf(r.status) !== "delivered") continue;
    const name =
      (r.domainId && domainName.get(r.domainId)) || domainOfAddress(r.from);
    byDomain.set(name, (byDomain.get(name) ?? 0) + 1);
  }
  const topDomains = [...byDomain.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  /* top broadcasts by emails queued */
  const byBroadcast = new Map<string, number>();
  for (const r of rows) {
    if (r.broadcastId)
      byBroadcast.set(r.broadcastId, (byBroadcast.get(r.broadcastId) ?? 0) + 1);
  }
  const topBroadcastIds = [...byBroadcast.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const broadcastRows =
    topBroadcastIds.length > 0
      ? await db
          .select({
            id: broadcasts.id,
            subject: broadcasts.subject,
            status: broadcasts.status,
          })
          .from(broadcasts)
          .where(
            and(
              eq(broadcasts.teamId, team.id),
              inArray(
                broadcasts.id,
                topBroadcastIds.map(([id]) => id),
              ),
            ),
          )
      : [];
  const broadcastMeta = new Map(broadcastRows.map((b) => [b.id, b]));
  const topBroadcasts = topBroadcastIds
    .map(([id, n]) => ({ meta: broadcastMeta.get(id), n }))
    .filter((b): b is { meta: (typeof broadcastRows)[number]; n: number } =>
      Boolean(b.meta),
    );

  const labelStep = bucketCount > 14 ? 5 : bucketCount > 8 ? 2 : 1;
  const lastIdx = bucketCount - 1;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Analytics">
        <RangePills active={range} />
      </PageHeader>

      {/* 1 — KPI tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label} className="px-4 py-3">
            <div
              className={`font-mono text-xl tabular-nums ${
                t.danger ? "text-danger" : "text-fg"
              }`}
            >
              {t.value}
            </div>
            <div className="mt-0.5 text-xs text-fg-faint">{t.label}</div>
          </Card>
        ))}
      </div>

      {/* 2 — volume over time, segmented by status */}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            Volume over time{bucketDays === 7 ? " · weekly" : " · daily"}
          </h2>
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
          <div className="flex h-40 items-end gap-[2px] border-b border-line pt-4">
            {buckets.map((b) => {
              const bucketTotal = Object.values(b.counts).reduce(
                (a, n) => a + n,
                0,
              );
              return (
                <div
                  key={b.key}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface-3 px-3 py-2 font-mono text-[11px] leading-relaxed group-hover:block">
                    <div className="text-fg">
                      {b.label} — {bucketTotal}
                    </div>
                    {SEGMENTS.filter((s) => b.counts[s.key] > 0).map((s) => (
                      <div key={s.key} className="text-fg-muted">
                        <span
                          aria-hidden
                          className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ background: s.color }}
                        />
                        {s.label}: {b.counts[s.key]}
                      </div>
                    ))}
                    {bucketTotal === 0 && (
                      <div className="text-fg-faint">no emails</div>
                    )}
                  </div>

                  {SEGMENTS.map((s, i) => {
                    const value = b.counts[s.key];
                    if (value === 0) return null;
                    const isTop = SEGMENTS.slice(0, i).every(
                      (p) => b.counts[p.key] === 0,
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
                  {bucketTotal === 0 && (
                    <div className="h-px w-full bg-surface-3" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-[2px]">
            {buckets.map((b, i) => (
              <div
                key={b.key}
                className="flex-1 text-center font-mono text-[10px] text-fg-faint"
              >
                {i % labelStep === lastIdx % labelStep
                  ? b.label.replace("wk of ", "").split(" ")[0]
                  : ""}
              </div>
            ))}
          </div>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-fg-faint hover:text-fg-muted">
            View as table
          </summary>
          <table className="mt-3 w-full text-xs">
            <thead className="text-left text-fg-faint">
              <tr>
                <th className="py-1 pr-4 font-medium">
                  {bucketDays === 7 ? "Week" : "Day"}
                </th>
                {SEGMENTS.map((s) => (
                  <th key={s.key} className="py-1 pr-4 font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-fg-muted">
              {buckets.map((b) => (
                <tr key={b.key} className="border-t border-hairline">
                  <td className="py-1 pr-4">{b.label}</td>
                  {SEGMENTS.map((s) => (
                    <td key={s.key} className="py-1 pr-4">
                      {b.counts[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>

      {/* 3 — engagement */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-sm font-medium">Engagement</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <MiniBars
            title={`Unique opens per ${bucketDays === 7 ? "week" : "day"}`}
            buckets={buckets}
            pick={(b) => b.opens}
            unit="opens"
            labelStep={labelStep}
          />
          <MiniBars
            title={`Unique clicks per ${bucketDays === 7 ? "week" : "day"}`}
            buckets={buckets}
            pick={(b) => b.clicks}
            unit="clicks"
            labelStep={labelStep}
          />
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-fg-faint hover:text-fg-muted">
            View as table
          </summary>
          <table className="mt-3 w-full text-xs">
            <thead className="text-left text-fg-faint">
              <tr>
                <th className="py-1 pr-4 font-medium">
                  {bucketDays === 7 ? "Week" : "Day"}
                </th>
                <th className="py-1 pr-4 font-medium">Unique opens</th>
                <th className="py-1 pr-4 font-medium">Unique clicks</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-fg-muted">
              {buckets.map((b) => (
                <tr key={b.key} className="border-t border-hairline">
                  <td className="py-1 pr-4">{b.label}</td>
                  <td className="py-1 pr-4">{b.opens}</td>
                  <td className="py-1 pr-4">{b.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>

      {/* 4 — top performers */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-medium">Top sending domains</h2>
          {topDomains.length === 0 ? (
            <p className="py-4 text-xs text-fg-faint">
              No delivered emails in range.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-fg-faint">
                <tr>
                  <th className="py-1.5 pr-4 font-medium">Domain</th>
                  <th className="py-1.5 text-right font-medium">Delivered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {topDomains.map(([name, n]) => (
                  <tr key={name}>
                    <td className="py-2 pr-4 font-mono text-xs text-fg">
                      {name}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-fg-muted">
                      {n}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-medium">Top campaigns</h2>
          {topBroadcasts.length === 0 ? (
            <p className="py-4 text-xs text-fg-faint">
              No campaign sends in range.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-fg-faint">
                <tr>
                  <th className="py-1.5 pr-4 font-medium">Subject</th>
                  <th className="py-1.5 pr-4 text-right font-medium">Queued</th>
                  <th className="py-1.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {topBroadcasts.map(({ meta, n }) => (
                  <tr key={meta.id}>
                    <td className="max-w-0 truncate py-2 pr-4 text-xs text-fg">
                      {meta.subject}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-fg-muted">
                      {n}
                    </td>
                    <td className="py-2 text-right">
                      <StatusPill status={meta.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
