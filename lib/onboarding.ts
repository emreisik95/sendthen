import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, apiKeys, domains, emails, webhooks, type Team } from "./db";

export interface OnboardingProgress {
  hasDomain: boolean;
  domainVerified: boolean;
  hasApiKey: boolean;
  hasSentEmail: boolean;
  hasWebhook: boolean;
  /** completed step count out of stepsTotal (domain, key, send) */
  stepsDone: number;
  stepsTotal: number;
  /** most recent pending or verified domain, for the DNS step */
  domainId: string | null;
}

/** Live setup state derived from the team's real resources. */
export async function onboardingProgress(
  team: Team,
): Promise<OnboardingProgress> {
  const [[domain], [keyCount], [emailCount], [webhookCount]] =
    await Promise.all([
      db
        .select({ id: domains.id, status: domains.status })
        .from(domains)
        .where(eq(domains.teamId, team.id))
        .orderBy(desc(domains.createdAt))
        .limit(1),
      db
        .select({ n: count() })
        .from(apiKeys)
        .where(and(eq(apiKeys.teamId, team.id), isNull(apiKeys.revokedAt))),
      db
        .select({ n: count() })
        .from(emails)
        .where(and(eq(emails.teamId, team.id), isNotNull(emails.sentAt))),
      db
        .select({ n: count() })
        .from(webhooks)
        .where(eq(webhooks.teamId, team.id)),
    ]);

  const hasDomain = !!domain;
  const hasApiKey = keyCount.n > 0;
  const hasSentEmail = emailCount.n > 0;
  const stepsDone = [hasDomain, hasApiKey, hasSentEmail].filter(Boolean).length;

  return {
    hasDomain,
    domainVerified: domain?.status === "verified",
    hasApiKey,
    hasSentEmail,
    hasWebhook: webhookCount.n > 0,
    stepsDone,
    stepsTotal: 3,
    domainId: domain?.id ?? null,
  };
}
