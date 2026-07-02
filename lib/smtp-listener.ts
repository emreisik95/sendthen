import { SMTPServer } from "smtp-server";
import { eq } from "drizzle-orm";
import { db, domains } from "./db";
import { parseAndStoreInbound } from "./inbound";

const MAX_SIZE = 15 * 1024 * 1024;

declare global {
  // eslint-disable-next-line no-var
  var __sendthenSmtp: SMTPServer | undefined;
}

/**
 * Inbound SMTP listener. Enabled only when SENDTHEN_SMTP_PORT is set.
 * Accepts mail for registered domains and stores it via parseAndStoreInbound.
 */
export function startSmtpListener(): void {
  const port = Number(process.env.SENDTHEN_SMTP_PORT);
  if (!process.env.SENDTHEN_SMTP_PORT || !Number.isFinite(port)) return;
  if (globalThis.__sendthenSmtp) return;

  const server = new SMTPServer({
    disabledCommands: ["AUTH"],
    authOptional: true,
    size: MAX_SIZE,
    onRcptTo(address, _session, cb) {
      const at = address.address.lastIndexOf("@");
      const domainName =
        at === -1 ? "" : address.address.slice(at + 1).toLowerCase();
      db.select({ id: domains.id })
        .from(domains)
        .where(eq(domains.name, domainName))
        .then(([found]) => {
          if (!found) {
            const err = new Error("550 Mailbox unavailable");
            (err as Error & { responseCode: number }).responseCode = 550;
            cb(err);
          } else {
            cb();
          }
        })
        .catch((err) => cb(err as Error));
    },
    onData(stream, session, cb) {
      const chunks: Buffer[] = [];
      let size = 0;
      let rejected = false;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_SIZE) {
          rejected = true;
          return;
        }
        chunks.push(chunk);
      });
      stream.on("end", () => {
        if (rejected || stream.sizeExceeded) {
          const err = new Error("552 Message exceeds maximum size");
          (err as Error & { responseCode: number }).responseCode = 552;
          cb(err);
          return;
        }
        parseAndStoreInbound(
          Buffer.concat(chunks),
          session.envelope.rcptTo.map((r) => r.address),
        )
          .then(() => cb())
          .catch((err: Error) => cb(err));
      });
      stream.on("error", (err: Error) => cb(err));
    },
  });

  server.on("error", (err) => {
    console.error("[smtp] server error:", err);
  });

  server.listen(port, () => {
    console.log(`[smtp] inbound listener on port ${port}`);
  });
  globalThis.__sendthenSmtp = server;
}
