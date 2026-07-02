import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { PLANS, teamUsage } from "@/lib/quota";
import { Card, PageHeader, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

function Bar({ value, limit }: { value: number; limit: number | null }) {
  if (limit === null) return null;
  const pct = Math.min(100, Math.round((value / limit) * 100));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warn" : "bg-lime"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default async function BillingPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const usage = await teamUsage(team);
  const unlimited = process.env.SENDTHEN_UNLIMITED === "true";
  const upgradeUrl = process.env.STRIPE_PAYMENT_LINK ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Billing" />
      <p className="mb-6 text-sm text-fg-muted">
        Usage and plan for the <span className="text-fg">{team.name}</span>{" "}
        team.
      </p>

      {/* usage */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-fg-faint">
            Today
          </div>
          <div className="mt-1 font-mono text-2xl tabular-nums">
            {usage.today}
            {!unlimited && usage.dailyLimit !== null && (
              <span className="text-sm text-fg-faint"> / {usage.dailyLimit}</span>
            )}
          </div>
          {!unlimited && <Bar value={usage.today} limit={usage.dailyLimit} />}
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-fg-faint">
            This month
          </div>
          <div className="mt-1 font-mono text-2xl tabular-nums">
            {usage.month}
            {!unlimited && usage.monthlyLimit !== null && (
              <span className="text-sm text-fg-faint">
                {" "}
                / {usage.monthlyLimit.toLocaleString()}
              </span>
            )}
          </div>
          {!unlimited && <Bar value={usage.month} limit={usage.monthlyLimit} />}
          {usage.monthOverage > 0 && (
            <p className="mt-2 font-mono text-xs text-warn">
              +{usage.monthOverage.toLocaleString()} over the included volume
              (billed at ${PLANS.pro.overagePer1k}/1,000)
            </p>
          )}
        </Card>
      </div>

      {unlimited ? (
        <Card className="p-6 text-sm text-fg-muted">
          This instance runs with unlimited sending — plans and limits are
          disabled by the operator.
        </Card>
      ) : (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-faint">
            Plans
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              className={`p-6 ${usage.plan === "free" ? "border-lime/50" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold">Free</h3>
                <span className="font-mono text-xl">$0</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-fg-muted">
                <li>✓ {PLANS.free.dailyLimit} emails / day</li>
                <li>✓ {PLANS.free.monthlyLimit.toLocaleString()} emails / month</li>
                <li>✓ Every feature — domains, webhooks, broadcasts, inbound</li>
              </ul>
              {usage.plan === "free" && (
                <p className="mt-4 font-mono text-xs text-lime">current plan</p>
              )}
            </Card>

            <Card
              className={`p-6 ${usage.plan === "pro" ? "border-lime/50" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold">Pro</h3>
                <span className="font-mono text-xl">
                  ${PLANS.pro.priceMonthly}
                  <span className="text-sm text-fg-faint">/mo</span>
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-fg-muted">
                <li>
                  ✓ {PLANS.pro.monthlyLimit.toLocaleString()} emails / month
                  included
                </li>
                <li>✓ No daily cap</li>
                <li>
                  ✓ ${PLANS.pro.overagePer1k} per extra 1,000 emails
                </li>
                <li>✓ Priority delivery through the managed pipeline</li>
              </ul>
              {usage.plan === "pro" ? (
                <p className="mt-4 font-mono text-xs text-lime">current plan</p>
              ) : upgradeUrl ? (
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener"
                  className={`${btnPrimary} mt-5 w-full justify-center`}
                >
                  Upgrade to Pro →
                </a>
              ) : (
                <p className="mt-5 text-xs text-fg-faint">
                  Payments aren&apos;t configured on this instance yet
                  {user.role === "admin"
                    ? " — set a payment link in the deployment configuration to enable upgrades."
                    : " — contact the instance admin to upgrade."}
                </p>
              )}
            </Card>
          </div>
          <p className="mt-6 text-xs text-fg-faint">
            Cheaper than the incumbents, and the whole platform is open source
            — you can always self-host with no limits at all.
          </p>
        </>
      )}
    </div>
  );
}
