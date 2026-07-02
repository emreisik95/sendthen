import { generateKeyPairSync } from "node:crypto";

export interface DkimKeyPair {
  privateKey: string; // PEM PKCS#8
  publicKey: string; // base64 DER, ready for DNS TXT p= value
}

export function generateDkimKeyPair(): DkimKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    privateKey,
    publicKey: publicKey.toString("base64"),
  };
}

export interface DnsRecord {
  type: "TXT" | "MX" | "CNAME";
  name: string;
  value: string;
  purpose: "dkim" | "spf";
}

/** DNS records the user must publish for a sending domain. */
export function dnsRecordsForDomain(
  domain: string,
  selector: string,
  dkimPublicKey: string,
): DnsRecord[] {
  return [
    {
      type: "TXT",
      name: `${selector}._domainkey.${domain}`,
      value: `v=DKIM1; k=rsa; p=${dkimPublicKey}`,
      purpose: "dkim",
    },
    {
      type: "TXT",
      name: domain,
      value: "v=spf1 a mx ~all",
      purpose: "spf",
    },
  ];
}
