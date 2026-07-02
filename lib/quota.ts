import { and, count, eq, gte } from "drizzle-orm";
import { db, emails, type Team } from "./db";
import { SendError } from "./errors";

/**
 * Hosted pricing. Self-hosted instances can lift limits entirely with
 * SENDTHEN_UNLIMITED=true.
 */
export const PLANS = {
  free: {
    name: "Free",
    priceMonthly: 0,
    dailyLimit: 100,
    monthlyLimit: 3_000,
    overagePer1k: null as number | null,
  },
  pro: {
    name: "Pro",
    priceMonthly: 10,
    dailyLimit: null as number | null,
    monthlyLimit: 50_000,
    // beyond the included volume we bill per extra thousand
    overagePer1k: 0.5,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface Usage {
  today: number;
  month: number;
  plan: PlanKey;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  /** emails past the included monthly volume (pro overage) */
  monthOverage: number;
}

export async function teamUsage(team: Team): Promise<Usage> {
  const plan = (team.plan in PLANS ? team.plan : "free") as PlanKey;
  const limits = PLANS[plan];
  const [[daily], [monthly]] = await Promise.all([
    db
      .select({ n: count() })
      .from(emails)
      .where(
        and(eq(emails.teamId, team.id), gte(emails.createdAt, startOfToday())),
      ),
    db
      .select({ n: count() })
      .from(emails)
      .where(
        and(eq(emails.teamId, team.id), gte(emails.createdAt, startOfMonth())),
      ),
  ]);
  return {
    today: daily.n,
    month: monthly.n,
    plan,
    dailyLimit: limits.dailyLimit,
    monthlyLimit: limits.monthlyLimit,
    monthOverage:
      limits.overagePer1k !== null && limits.monthlyLimit !== null
        ? Math.max(0, monthly.n - limits.monthlyLimit)
        : 0,
  };
}

/**
 * Throws 429 quota_exceeded when the team's plan does not allow another
 * send. Pro overage is allowed (billed), free limits are hard.
 */
export async function enforceQuota(team: Team): Promise<void> {
  if (process.env.SENDTHEN_UNLIMITED === "true") return;
  const usage = await teamUsage(team);
  const limits = PLANS[usage.plan];

  if (limits.dailyLimit !== null && usage.today >= limits.dailyLimit) {
    throw new SendError(
      429,
      "quota_exceeded",
      `Daily limit reached (${limits.dailyLimit} emails/day on the ${limits.name} plan). Upgrade under Billing to keep sending.`,
    );
  }
  if (
    limits.overagePer1k === null &&
    limits.monthlyLimit !== null &&
    usage.month >= limits.monthlyLimit
  ) {
    throw new SendError(
      429,
      "quota_exceeded",
      `Monthly limit reached (${limits.monthlyLimit} emails/month on the ${limits.name} plan). Upgrade under Billing to keep sending.`,
    );
  }
}
