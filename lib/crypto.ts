import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { instanceSecret } from "./secret";

const PREFIX = "enc:v1:";

function key(): Buffer {
  return createHash("sha256").update(instanceSecret()).digest();
}

/** AES-256-GCM. Output: enc:v1:<iv>:<tag>:<cipher> (base64 parts). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return (
    PREFIX +
    [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(":")
  );
}

/** Decrypts enc:v1 values; passes through legacy plaintext unchanged. */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Display hint for a stored secret: last 4 chars of the plaintext. */
export function secretHint(stored: string): string {
  try {
    const plain = decryptSecret(stored);
    return `••••••••${plain.slice(-4)}`;
  } catch {
    return "••••••••";
  }
}
