import { resolveMx, resolveTxt } from "node:dns/promises";
import { eq } from "drizzle-orm";
import { db, domains, type Domain } from "./db";
import { publicUrl } from "./tracking";

async function txtRecords(name: string): Promise<string[]> {
  try {
    const records = await resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

export interface VerifyResult {
  dkim: boolean;
  spf: boolean;
  verified: boolean;
  /** what the DNS actually returned, for user-facing diagnostics */
  dkimFound: string[];
  spfFound: string[];
}

/**
 * Resolve DKIM + SPF TXT records for the domain and persist the result.
 * SENDTHEN_DNS_MOCK=verified makes every check pass (local/sandbox testing).
 */
export async function verifyDomain(domain: Domain): Promise<VerifyResult> {
  let dkim: boolean;
  let spf: boolean;
  let dkimFound: string[] = [];
  let spfFound: string[] = [];

  if (process.env.SENDTHEN_DNS_MOCK === "verified") {
    dkim = true;
    spf = true;
  } else {
    [dkimFound, spfFound] = await Promise.all([
      txtRecords(`${domain.dkimSelector}._domainkey.${domain.name}`),
      txtRecords(domain.name),
    ]);
    dkim = dkimFound.some(
      (t) => t.includes("v=DKIM1") && t.includes(domain.dkimPublicKey),
    );
    spf = spfFound.some((t) => t.startsWith("v=spf1"));
  }

  const verified = dkim && spf;
  const now = new Date();
  await db
    .update(domains)
    .set({
      dkimVerified: dkim,
      spfVerified: spf,
      status: verified ? "verified" : "pending",
      verifiedAt: verified ? (domain.verifiedAt ?? now) : null,
      lastCheckedAt: now,
    })
    .where(eq(domains.id, domain.id));

  return { dkim, spf, verified, dkimFound, spfFound };
}

async function mxRecords(name: string): Promise<string[]> {
  try {
    const records = await resolveMx(name);
    return records.map((r) => r.exchange.replace(/\.$/, "").toLowerCase());
  } catch {
    return [];
  }
}

export interface MxVerifyResult {
  mx: boolean;
  /** what the DNS actually returned, for user-facing diagnostics */
  mxFound: string[];
  /** hostname we expect an MX record to point at (this instance) */
  expectedHost: string | null;
}

/**
 * Resolve the MX record for the domain and check it points at this
 * instance's public host, then persist the result. Mirrors verifyDomain's
 * DNS-check pattern. SENDTHEN_DNS_MOCK=verified makes the check pass
 * (local/sandbox testing).
 */
export async function verifyMx(domain: Domain): Promise<MxVerifyResult> {
  const base = publicUrl();
  const expectedHost = base ? new URL(base).hostname.toLowerCase() : null;

  let mx: boolean;
  let mxFound: string[] = [];

  if (process.env.SENDTHEN_DNS_MOCK === "verified") {
    mx = true;
  } else if (!expectedHost) {
    mx = false;
  } else {
    mxFound = await mxRecords(domain.name);
    mx = mxFound.includes(expectedHost);
  }

  const now = new Date();
  await db
    .update(domains)
    .set({ mxVerified: mx, mxCheckedAt: now })
    .where(eq(domains.id, domain.id));

  return { mx, mxFound, expectedHost };
}
