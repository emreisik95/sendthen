import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, apiKeys, domains, emails, webhooks, emailEvents } from "@/lib/db";
import { hashToken, requireApiKey } from "@/lib/api-auth";
import { registerUser } from "@/lib/auth-user";
import { createTeam } from "@/lib/team";
import { newApiKeyId, newApiToken, newDomainId, newEmailId, newWebhookId, newWebhookSecret } from "@/lib/id";
import { generateDkimKeyPair, dnsRecordsForDomain } from "@/lib/dkim";
import { verifyDomain } from "@/lib/dns-verify";
import { processQueue } from "@/lib/queue";
import { recordEvent } from "@/lib/events";
import { processWebhookDeliveries, signWebhook } from "@/lib/webhook-dispatch";
import { eq } from "drizzle-orm";

const TOKEN = newApiToken();
let userId: string;
let teamId: string;

beforeAll(async () => {
  const user = await registerUser("test@sendthen.dev", "Test", "password123");
  userId = user.id;
  const team = await createTeam("test team", userId);
  teamId = team.id;
  await db.insert(apiKeys).values({
    id: newApiKeyId(),
    userId,
    teamId,
    name: "test",
    tokenHash: hashToken(TOKEN),
    tokenPrefix: TOKEN.slice(0, 12),
    permission: "full",
    createdAt: new Date(),
  });
});

describe("api auth", () => {
  it("accepts a valid bearer token", async () => {
    const req = new Request("http://test/api/v1/emails", {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    const result = await requireApiKey(req);
    expect(result).toHaveProperty("id");
  });

  it("rejects a bad token", async () => {
    const req = new Request("http://test/api/v1/emails", {
      headers: { authorization: "Bearer st_nope" },
    });
    const result = await requireApiKey(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});

describe("domains", () => {
  it("generates DKIM keys and DNS records, verifies with mock DNS", async () => {
    const { privateKey, publicKey } = generateDkimKeyPair();
    expect(privateKey).toContain("BEGIN PRIVATE KEY");
    expect(publicKey.length).toBeGreaterThan(200);

    const records = dnsRecordsForDomain("mail.test.dev", "stmail", publicKey);
    expect(records).toHaveLength(2);
    expect(records[0].name).toBe("stmail._domainkey.mail.test.dev");
    expect(records[0].value).toContain(`p=${publicKey}`);

    const id = newDomainId();
    await db.insert(domains).values({
      id,
      userId,
      teamId,
      name: "mail.test.dev",
      dkimPrivateKey: privateKey,
      dkimPublicKey: publicKey,
      createdAt: new Date(),
    });
    const [domain] = await db.select().from(domains).where(eq(domains.id, id));
    const result = await verifyDomain(domain);
    expect(result.verified).toBe(true);

    const [fresh] = await db.select().from(domains).where(eq(domains.id, id));
    expect(fresh.status).toBe("verified");
  });
});

describe("email pipeline (sandbox)", () => {
  it("queued email is sent, delivered, eml captured, events recorded", async () => {
    const id = newEmailId();
    await db.insert(emails).values({
      id,
      userId,
      teamId,
      from: "test <hi@mail.test.dev>",
      to: ["dest@example.com"],
      subject: "Hello",
      html: "<b>hi</b>",
      status: "queued",
      createdAt: new Date(),
    });

    await processQueue();

    const [email] = await db.select().from(emails).where(eq(emails.id, id));
    expect(email.status).toBe("delivered");
    expect(email.messageId).toBeTruthy();

    const eml = fs.readFileSync(
      path.join(process.env.SENDTHEN_OUTBOX_DIR!, `${id}.eml`),
      "utf8",
    );
    expect(eml).toContain("Subject: Hello");
    // DKIM signature present because mail.test.dev domain exists
    expect(eml).toContain("DKIM-Signature");

    const events = await db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.emailId, id));
    const types = events.map((e) => e.type).sort();
    expect(types).toContain("email.sent");
    expect(types).toContain("email.delivered");
  });
});

describe("webhooks", () => {
  let server: Server;
  let port: number;
  const received: { headers: Record<string, string>; body: string }[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push({
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([k, v]) => [k, String(v)]),
          ),
          body,
        });
        res.writeHead(200).end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(() => server.close());

  it("delivers signed events and the signature verifies", async () => {
    const secret = newWebhookSecret();
    await db.insert(webhooks).values({
      id: newWebhookId(),
      userId,
      teamId,
      url: `http://127.0.0.1:${port}/hook`,
      secret,
      events: ["email.opened-test" as never, "email.sent"],
      createdAt: new Date(),
    });

    const emailId = newEmailId();
    await db.insert(emails).values({
      id: emailId,
      userId,
      teamId,
      from: "hi@mail.test.dev",
      to: ["x@example.com"],
      subject: "hook test",
      text: "t",
      status: "sent",
      createdAt: new Date(),
    });

    await recordEvent(emailId, "email.sent", { message_id: "<m@id>" });
    await processWebhookDeliveries();

    expect(received).toHaveLength(1);
    const { headers, body } = received[0];
    const payload = JSON.parse(body);
    expect(payload.type).toBe("email.sent");
    expect(payload.data.email_id).toBe(emailId);

    // verify svix-style signature
    const expected = signWebhook(
      secret,
      headers["webhook-id"],
      Number(headers["webhook-timestamp"]),
      body,
    );
    expect(headers["webhook-signature"]).toBe(expected);

    // manual recompute to prove the scheme
    const mac = createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, "")))
      .update(
        `${headers["webhook-id"]}.${headers["webhook-timestamp"]}.${body}`,
      )
      .digest("base64");
    expect(headers["webhook-signature"]).toBe(`v1,${mac}`);
  });
});
