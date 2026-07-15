import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
} from "drizzle-orm";
import {
  apiKeys,
  audiences,
  broadcasts,
  db,
  domains,
  emailEvents,
  emails,
  webhooks,
  type ApiKey,
  type Team,
} from "./db";
import type { HomeDomainState, HomeReadiness } from "./dashboard-home";
import { scopesOf } from "./api-auth";
import { teamUsage } from "./quota";

type HomeDomain = Readonly<{
  id: string;
  status: Exclude<HomeDomainState, "missing">;
}>;

type HomeApiKey = Pick<ApiKey, "permission" | "scopes">;

export type HomeReadinessResources = Readonly<{
  latestDomain?: HomeDomain;
  verifiedDomain?: Pick<HomeDomain, "id">;
  activeKeys: readonly HomeApiKey[];
  hasSentEmail: boolean;
}>;

export function resolveHomeReadiness(
  resources: HomeReadinessResources,
): HomeReadiness {
  const domain = resources.verifiedDomain
    ? ({ ...resources.verifiedDomain, status: "verified" } as const)
    : resources.latestDomain;

  return {
    domain: domain?.status ?? "missing",
    domainId: domain?.id,
    hasApiKey: resources.activeKeys.some((key) =>
      scopesOf(key).includes("emails.send"),
    ),
    hasSentEmail: resources.hasSentEmail,
  };
}

export async function loadDashboardHome(team: Team, since: Date) {
  const [
    [latestDomain],
    [verifiedDomain],
    activeKeys,
    [sentEmail],
    statusRows,
    [openedResult],
    recentEmails,
    [webhookResult],
    [audienceResult],
    [campaignResult],
    usage,
  ] = await Promise.all([
    db
      .select({ id: domains.id, status: domains.status })
      .from(domains)
      .where(eq(domains.teamId, team.id))
      .orderBy(desc(domains.createdAt))
      .limit(1),
    db
      .select({ id: domains.id })
      .from(domains)
      .where(and(eq(domains.teamId, team.id), eq(domains.status, "verified")))
      .orderBy(desc(domains.createdAt))
      .limit(1),
    db
      .select({ permission: apiKeys.permission, scopes: apiKeys.scopes })
      .from(apiKeys)
      .where(and(eq(apiKeys.teamId, team.id), isNull(apiKeys.revokedAt))),
    db
      .select({ id: emails.id })
      .from(emails)
      .where(and(eq(emails.teamId, team.id), isNotNull(emails.sentAt)))
      .limit(1),
    db
      .select({ status: emails.status, count: count() })
      .from(emails)
      .where(and(eq(emails.teamId, team.id), gte(emails.createdAt, since)))
      .groupBy(emails.status),
    db
      .select({ count: countDistinct(emailEvents.emailId) })
      .from(emailEvents)
      .innerJoin(emails, eq(emailEvents.emailId, emails.id))
      .where(
        and(
          eq(emails.teamId, team.id),
          gte(emails.createdAt, since),
          eq(emailEvents.type, "email.opened"),
        ),
      ),
    db
      .select({
        id: emails.id,
        to: emails.to,
        subject: emails.subject,
        status: emails.status,
        createdAt: emails.createdAt,
        sentAt: emails.sentAt,
      })
      .from(emails)
      .where(eq(emails.teamId, team.id))
      .orderBy(desc(emails.createdAt))
      .limit(5),
    db
      .select({ count: count() })
      .from(webhooks)
      .where(eq(webhooks.teamId, team.id)),
    db
      .select({ count: count() })
      .from(audiences)
      .where(eq(audiences.teamId, team.id)),
    db
      .select({ count: count() })
      .from(broadcasts)
      .where(eq(broadcasts.teamId, team.id)),
    teamUsage(team),
  ]);

  return {
    readiness: resolveHomeReadiness({
      latestDomain,
      verifiedDomain,
      activeKeys,
      hasSentEmail: Boolean(sentEmail),
    }),
    activeKeyCount: activeKeys.length,
    statusRows,
    openedCount: openedResult.count,
    recentEmails,
    webhookCount: webhookResult.count,
    audienceCount: audienceResult.count,
    campaignCount: campaignResult.count,
    usage,
  };
}
