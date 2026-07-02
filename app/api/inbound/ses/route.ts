import { X509Certificate, verify as cryptoVerify } from "node:crypto";
import { NextResponse } from "next/server";
import { parseAndStoreInbound } from "@/lib/inbound";

/** Hostnames SNS signing certs (and SubscribeURLs) are allowed to come from. */
const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

const certCache = new Map<string, string>();
const CERT_CACHE_MAX = 10;

function snsUrl(raw: unknown): URL | null {
  if (typeof raw !== "string") return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !SNS_HOST.test(url.hostname)) return null;
  return url;
}

/**
 * Verify an SNS message signature (SignatureVersion 1 = SHA1withRSA,
 * 2 = SHA256withRSA) against its signing certificate. The cert URL host is
 * pinned to sns.<region>.amazonaws.com so forged messages can't point us at
 * an attacker-controlled certificate.
 */
async function verifySnsSignature(
  body: Record<string, unknown>,
): Promise<boolean> {
  const version = String(body.SignatureVersion ?? "");
  if (version !== "1" && version !== "2") return false;
  if (typeof body.Signature !== "string") return false;

  const certUrl = snsUrl(body.SigningCertURL ?? body.SigningCertUrl);
  if (!certUrl || !certUrl.pathname.endsWith(".pem")) return false;

  const keys =
    body.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : [
          "Message",
          "MessageId",
          "SubscribeURL",
          "Timestamp",
          "Token",
          "TopicArn",
          "Type",
        ];
  let toSign = "";
  for (const key of keys) {
    const value = body[key];
    if (value === undefined || value === null) {
      if (key === "Subject") continue; // optional on notifications
      return false;
    }
    if (typeof value !== "string") return false;
    toSign += `${key}\n${value}\n`;
  }

  let pem = certCache.get(certUrl.href);
  if (!pem) {
    const res = await fetch(certUrl.href).catch(() => null);
    if (!res || !res.ok) return false;
    pem = await res.text();
    if (certCache.size >= CERT_CACHE_MAX) certCache.clear();
    certCache.set(certUrl.href, pem);
  }

  try {
    const publicKey = new X509Certificate(pem).publicKey;
    return cryptoVerify(
      version === "1" ? "sha1" : "sha256",
      Buffer.from(toSign, "utf8"),
      publicKey,
      Buffer.from(body.Signature, "base64"),
    );
  } catch {
    return false;
  }
}

/**
 * Amazon SES email receiving via SNS. Configure an SES receipt rule with an
 * SNS action and point the topic's HTTPS subscription at this endpoint;
 * subscription confirmation is handled automatically.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!(await verifySnsSignature(body))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  // SNS handshake — SubscribeURL host is validated above via the signed
  // payload, but re-check before fetching to avoid SSRF.
  if (body.Type === "SubscriptionConfirmation") {
    const subscribeUrl = snsUrl(body.SubscribeURL);
    if (subscribeUrl) await fetch(subscribeUrl.href).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (body.Type !== "Notification" || typeof body.Message !== "string") {
    return NextResponse.json({ ok: true });
  }

  let msg: {
    notificationType?: string;
    mail?: { destination?: string[] };
    receipt?: { action?: { encoding?: string } };
    content?: string;
  };
  try {
    msg = JSON.parse(body.Message);
  } catch {
    return NextResponse.json({ ok: true });
  }

  // content is absent when the message exceeds the SNS payload limit or the
  // receipt rule doesn't include the raw email — nothing to store then.
  if (msg.notificationType !== "Received" || !msg.content) {
    return NextResponse.json({ ok: true });
  }

  // The SES→SNS action encodes content as UTF-8 by default; BASE64 only when
  // the receipt rule says so.
  const isBase64 = msg.receipt?.action?.encoding?.toUpperCase() === "BASE64";
  const raw = Buffer.from(msg.content, isBase64 ? "base64" : "utf8");
  const { stored } = await parseAndStoreInbound(raw, msg.mail?.destination);
  return NextResponse.json({ ok: true, stored });
}
