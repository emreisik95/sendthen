import Link from "next/link";
import { count, desc, eq, inArray } from "drizzle-orm";
import { db, audiences, broadcasts, contacts, domains, emails } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import {
  createBroadcastAction,
  deleteBroadcastAction,
  sendBroadcastAction,
} from "@/app/actions";
import {
  Card,
  PageHeader,
  StatusPill,
  btnDanger,
  btnPrimary,
  btnSecondary,
  fmtDate,
  inputCls,
} from "@/components/ui";
import { IconBroadcast } from "@/components/nav-icons";
import { Select } from "@/components/select";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  no_audience: "Pick a valid audience.",
  missing: "From, subject and HTML are required.",
  not_sendable: "That broadcast was already sent.",
  domain_not_verified:
    "The sender domain is not verified — verify it under Domains first.",
};

const VARIABLES = [
  "{{first_name}}",
  "{{last_name}}",
  "{{email}}",
  "{{unsubscribe_url}}",
];

export default async function BroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { error } = await searchParams;

  const myAudiences = await db
    .select({
      audience: audiences,
      contactCount: count(contacts.id),
    })
    .from(audiences)
    .leftJoin(contacts, eq(contacts.audienceId, audiences.id))
    .where(eq(audiences.teamId, team.id))
    .groupBy(audiences.id)
    .orderBy(desc(audiences.createdAt));

  const verifiedDomains = await db
    .select({ name: domains.name })
    .from(domains)
    .where(eq(domains.teamId, team.id));

  const rows = await db
    .select({ broadcast: broadcasts, audienceName: audiences.name })
    .from(broadcasts)
    .innerJoin(audiences, eq(broadcasts.audienceId, audiences.id))
    .where(eq(broadcasts.teamId, team.id))
    .orderBy(desc(broadcasts.createdAt));

  // delivery counts per sent broadcast
  const sentIds = rows
    .filter(({ broadcast }) => broadcast.status !== "draft")
    .map(({ broadcast }) => broadcast.id);
  const deliveryCounts = new Map<string, number>();
  if (sentIds.length > 0) {
    const counts = await db
      .select({ broadcastId: emails.broadcastId, n: count(emails.id) })
      .from(emails)
      .where(inArray(emails.broadcastId, sentIds))
      .groupBy(emails.broadcastId);
    for (const c of counts) {
      if (c.broadcastId) deliveryCounts.set(c.broadcastId, c.n);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Broadcasts" />
      <p className="mb-6 text-sm text-fg-muted">
        Send one email to a whole audience. Every contact gets their own copy
        with personal variables and a one-click unsubscribe link.
      </p>

      {error && ERRORS[error] && (
        <Card className="mb-6 border-danger/40 px-4 py-3 text-sm text-danger">
          {ERRORS[error]}
        </Card>
      )}

      {myAudiences.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <IconBroadcast
            className="mx-auto mb-4 text-fg-faint"
            width={28}
            height={28}
          />
          <p className="mb-2 text-sm text-fg">
            Broadcasts need someone to talk to.
          </p>
          <p className="mx-auto mb-6 max-w-sm text-sm text-fg-muted">
            Create an audience, add a few contacts, then come back here to
            write your first broadcast.
          </p>
          <Link href="/audiences" className={btnPrimary}>
            Create an audience →
          </Link>
        </Card>
      ) : (
        <>
          {/* compose */}
          <form
            action={createBroadcastAction}
            className="mb-8 rounded-[10px] border border-line bg-surface"
          >
            <div className="border-b border-hairline px-4 py-3">
              <h2 className="text-sm font-medium">New broadcast</h2>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint">
                    Audience
                  </label>
                  <Select
                    name="audienceId"
                    defaultValue={myAudiences[0]?.audience.id}
                    options={myAudiences.map(({ audience, contactCount }) => ({
                      value: audience.id,
                      label: audience.name,
                      hint: `${contactCount} contact${contactCount === 1 ? "" : "s"}`,
                    }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint">
                    From
                  </label>
                  <input
                    name="from"
                    placeholder="Your Name <news@yourdomain.com>"
                    required
                    list="verified-domains"
                    className={`${inputCls} font-mono`}
                  />
                  <datalist id="verified-domains">
                    {verifiedDomains.map((d) => (
                      <option key={d.name} value={`news@${d.name}`} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-faint">
                  Subject
                </label>
                <input
                  name="subject"
                  placeholder="Hey {{first_name}}, here's what's new"
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-medium uppercase tracking-wider text-fg-faint">
                    HTML body
                  </label>
                  <span className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((v) => (
                      <code
                        key={v}
                        className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                      >
                        {v}
                      </code>
                    ))}
                  </span>
                </div>
                <textarea
                  name="html"
                  rows={7}
                  required
                  placeholder={'<h1>Hi {{first_name}}</h1>\n<p>...</p>\n<a href="{{unsubscribe_url}}">Unsubscribe</a>'}
                  className={`${inputCls} font-mono text-xs`}
                />
                <p className="mt-2 text-xs text-fg-faint">
                  Tip: design reusable emails in{" "}
                  <Link href="/templates" className="text-lime hover:underline">
                    Templates
                  </Link>{" "}
                  and paste the HTML here. An unsubscribe header is added
                  automatically even without the link.
                </p>
              </div>

              <div className="flex items-center justify-end border-t border-hairline pt-4">
                <button type="submit" className={btnPrimary}>
                  Save draft
                </button>
              </div>
            </div>
          </form>

          {/* list */}
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            All broadcasts
          </h2>
          {rows.length === 0 ? (
            <Card className="px-6 py-12 text-center text-sm text-fg-muted">
              Nothing here yet — save a draft above, review it, then send when
              ready.
            </Card>
          ) : (
            <Card className="divide-y divide-hairline">
              {rows.map(({ broadcast: b, audienceName }) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{b.subject}</div>
                    <div className="truncate font-mono text-xs text-fg-faint">
                      {b.from} · to {audienceName}
                      {b.status !== "draft" && (
                        <>
                          {" "}
                          · {deliveryCounts.get(b.id) ?? 0} email
                          {(deliveryCounts.get(b.id) ?? 0) === 1 ? "" : "s"}
                        </>
                      )}
                      {" · "}
                      {b.sentAt
                        ? `sent ${fmtDate(b.sentAt)}`
                        : `created ${fmtDate(b.createdAt)}`}
                    </div>
                  </div>
                  <StatusPill
                    status={b.status === "draft" ? "pending" : b.status}
                  />
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
        </>
      )}
    </div>
  );
}
