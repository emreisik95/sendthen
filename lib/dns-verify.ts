import { resolveTxt } from "node:dns/promises";
import { eq } from "drizzle-orm";
import { db, domains, type Domain } from "./db";

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
}

/**
 * Resolve DKIM + SPF TXT records for the domain and persist the result.
 * SENDTHEN_DNS_MOCK=verified makes every check pass (local/sandbox testing).
 */
export async function verifyDomain(domain: Domain): Promise<VerifyResult> {
  let dkim: boolean;
  let spf: boolean;

  if (process.env.SENDTHEN_DNS_MOCK === "verified") {
    dkim = true;
    spf = true;
  } else {
    const [dkimTxts, spfTxts] = await Promise.all([
      txtRecords(`${domain.dkimSelector}._domainkey.${domain.name}`),
      txtRecords(domain.name),
    ]);
    dkim = dkimTxts.some(
      (t) => t.includes("v=DKIM1") && t.includes(domain.dkimPublicKey),
    );
    spf = spfTxts.some((t) => t.startsWith("v=spf1"));
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

  return { dkim, spf, verified };
}
