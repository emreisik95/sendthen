import { createHash, createHmac } from "node:crypto";

export interface SesCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const sha256 = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();

/**
 * Send a raw MIME message through Amazon SES v2 without the AWS SDK.
 * POST /v2/email/outbound-emails with SigV4 signing.
 * Returns the SES MessageId.
 */
export async function sendViaSes(
  creds: SesCredentials,
  rawMime: Buffer,
): Promise<string> {
  const host = `email.${creds.region}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";
  const body = JSON.stringify({
    Content: { Raw: { Data: rawMime.toString("base64") } },
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const payloadHash = sha256(body);
  const canonicalRequest = [
    "POST",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${creds.region}/ses/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${creds.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, creds.region);
  const kService = hmac(kRegion, "ses");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  const res = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-amz-date": amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json().catch(() => ({}))) as {
    MessageId?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      `SES ${res.status}: ${json.message ?? JSON.stringify(json)}`,
    );
  }
  return json.MessageId ?? "unknown";
}
