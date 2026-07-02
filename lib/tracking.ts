import { createHmac, timingSafeEqual } from "node:crypto";
import { instanceSecret } from "./secret";

export function publicUrl(): string | null {
  return process.env.SENDTHEN_PUBLIC_URL?.replace(/\/$/, "") ?? null;
}

export function trackSign(emailId: string, url = ""): string {
  return createHmac("sha256", instanceSecret())
    .update(`${emailId}.${url}`)
    .digest("hex")
    .slice(0, 32);
}

export function trackVerify(
  emailId: string,
  url: string,
  sig: string,
): boolean {
  const expected = Buffer.from(trackSign(emailId, url));
  const received = Buffer.from(sig);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

/**
 * Inject open pixel and/or rewrite links for click tracking.
 * No-op when SENDTHEN_PUBLIC_URL is not configured.
 */
export function injectTracking(
  html: string,
  emailId: string,
  opts: { opens: boolean; clicks: boolean },
): string {
  const base = publicUrl();
  if (!base) return html;
  let out = html;

  if (opts.clicks) {
    out = out.replace(
      /href="(https?:\/\/[^"]+)"/gi,
      (_m, url: string) =>
        `href="${base}/t/c/${emailId}?u=${encodeURIComponent(url)}&s=${trackSign(emailId, url)}"`,
    );
  }

  if (opts.opens) {
    const pixel = `<img src="${base}/t/o/${emailId}.gif" width="1" height="1" alt="" style="display:none" />`;
    out = out.includes("</body>")
      ? out.replace("</body>", `${pixel}</body>`)
      : out + pixel;
  }

  return out;
}
