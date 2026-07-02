/* End-to-end smoke against a running sendthen server.
 * Usage: node scripts/e2e.mjs [baseUrl]
 * Seeds an API key straight into the DB, then exercises:
 * landing → domain add/verify → webhook register → send → delivered → eml → webhook received.
 */
import { createHash, randomBytes, createHmac } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
const DB_PATH = process.env.DATABASE_PATH ?? "./data/sendthen.db";
const OUTBOX = process.env.SENDTHEN_OUTBOX_DIR ?? "./data/outbox";

const ok = (name) => console.log(`  ✓ ${name}`);
const fail = (name, detail) => {
  console.error(`  ✗ ${name}: ${detail}`);
  process.exit(1);
};

// 1. landing
const landing = await fetch(BASE);
landing.ok ? ok("landing 200") : fail("landing", landing.status);

// 2. seed a user + API key directly into DB (multi-user)
const token = "st_" + randomBytes(16).toString("hex");
const db = new Database(DB_PATH);
const e2eUserId = "usr_e2e" + randomBytes(8).toString("hex");
db.prepare(
  "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?,?,?,?,?,?)",
).run(
  e2eUserId,
  `e2e-${Date.now()}@sendthen.dev`,
  "e2e",
  "salt:deadbeef", // never used for login
  "member",
  Date.now(),
);
db.prepare(
  "INSERT INTO api_keys (id, user_id, name, token_hash, token_prefix, permission, created_at) VALUES (?,?,?,?,?,?,?)",
).run(
  "key_e2e" + randomBytes(8).toString("hex"),
  e2eUserId,
  "e2e",
  createHash("sha256").update(token).digest("hex"),
  token.slice(0, 12),
  "full",
  Date.now(),
);
db.close();
ok("user + api key seeded");

const api = async (method, p, body, headers = {}) => {
  const res = await fetch(`${BASE}/api/v1${p}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

// 3. unauthorized rejected
const noauth = await fetch(`${BASE}/api/v1/emails`);
noauth.status === 401 ? ok("401 without key") : fail("auth", noauth.status);

// 4. domain add + verify (SENDTHEN_DNS_MOCK=verified on server)
const dom = await api("POST", "/domains", { name: "mail.e2e.test" });
dom.status === 201 ? ok("domain created") : fail("domain create", JSON.stringify(dom.json));
const ver = await api("POST", `/domains/${dom.json.id}/verify`);
ver.json.status === "verified"
  ? ok("domain verified (mock DNS)")
  : fail("domain verify", JSON.stringify(ver.json));

// 5. webhook receiver + register
const received = [];
const receiver = createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    received.push({ headers: req.headers, body: b });
    res.writeHead(200).end();
  });
});
await new Promise((r) => receiver.listen(0, r));
const port = receiver.address().port;
const hook = await api("POST", "/webhooks", {
  url: `http://127.0.0.1:${port}/hook`,
  events: ["email.delivered"],
});
hook.status === 201 ? ok("webhook registered") : fail("webhook", JSON.stringify(hook.json));

// 6. send email (idempotent)
const idem = "e2e-" + Date.now();
const send = await api(
  "POST",
  "/emails",
  {
    from: "e2e <hi@mail.e2e.test>",
    to: "dest@example.com",
    subject: "e2e smoke",
    html: "<b>e2e</b>",
  },
  { "idempotency-key": idem },
);
send.json.id?.startsWith("em_") ? ok(`email queued ${send.json.id}`) : fail("send", JSON.stringify(send.json));

const dup = await api(
  "POST",
  "/emails",
  { from: "e2e <hi@mail.e2e.test>", to: "x@y.z", subject: "dup", text: "d" },
  { "idempotency-key": idem },
);
dup.json.id === send.json.id ? ok("idempotency honored") : fail("idempotency", JSON.stringify(dup.json));

// 7. poll until delivered
let email;
for (let i = 0; i < 30; i++) {
  ({ json: email } = await api("GET", `/emails/${send.json.id}`));
  if (email.status === "delivered") break;
  await new Promise((r) => setTimeout(r, 500));
}
email.status === "delivered" ? ok("status → delivered") : fail("delivery", email.status);

// 8. captured eml with DKIM
const emlPath = path.join(OUTBOX, `${send.json.id}.eml`);
if (!existsSync(emlPath)) fail("eml capture", `${emlPath} missing`);
const eml = readFileSync(emlPath, "utf8");
eml.includes("DKIM-Signature") ? ok("eml captured, DKIM-signed") : fail("dkim", "no DKIM header");

// 9. webhook arrived + signature verifies
for (let i = 0; i < 20 && received.length === 0; i++) {
  await new Promise((r) => setTimeout(r, 500));
}
if (received.length === 0) fail("webhook delivery", "nothing received");
const { headers, body } = received[0];
const payload = JSON.parse(body);
payload.type === "email.delivered" && payload.data.email_id === send.json.id
  ? ok("webhook event received")
  : fail("webhook payload", body.slice(0, 200));

const secret = hook.json.secret.replace(/^whsec_/, "");
const mac = createHmac("sha256", Buffer.from(secret))
  .update(`${headers["webhook-id"]}.${headers["webhook-timestamp"]}.${body}`)
  .digest("base64");
headers["webhook-signature"] === `v1,${mac}`
  ? ok("webhook signature verified")
  : fail("signature", headers["webhook-signature"]);

receiver.close();
console.log("\nE2E PASS — full pipeline works.");
