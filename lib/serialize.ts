import type { Domain } from "./db";
import { dnsRecordsForDomain } from "./dkim";

export function domainResponse(d: Domain) {
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    records: dnsRecordsForDomain(d.name, d.dkimSelector, d.dkimPublicKey).map(
      (r) => ({
        ...r,
        status:
          r.purpose === "dkim"
            ? d.dkimVerified
              ? "verified"
              : "pending"
            : d.spfVerified
              ? "verified"
              : "pending",
      }),
    ),
    created_at: d.createdAt.toISOString(),
  };
}
