/* End-to-end smoke against a running sendthen server.
 * Usage: node scripts/e2e.mjs [baseUrl]
 * Requires the server to run with SENDTHEN_DNS_MOCK=verified and
 * SENDTHEN_PUBLIC_URL pointing at itself (for tracking + unsubscribe).
 *
 * Covers: auth, domains+DKIM, single/batch/template sends, idempotency,
 * suppressions, open/click tracking, webhooks + signatures, audiences,
 * broadcast fan-out, one-click unsubscribe.
 */
import { createHash, randomBytes, createHmac } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
const DB_PATH = process.env.DATABASE_PATH ?? "./data/sendthen.db";
const OUTBOX = process.env.SENDTHEN_OUTBOX_DIR ?? "./data/outbox";

let passed = 0;
const ok = (name) => {
  passed++;
  console.log(`  ✓ ${name}`);
};
const fail = (name, detail) => {
  console.error(`  ✗ ${name}: ${detail}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 1. public pages */
for (const p of ["/", "/docs", "/signup", "/login"]) {
  const res = await fetch(BASE + p);
  res.ok ? ok(`GET ${p} 200`) : fail(p, res.status);
}

/* 2. seed user + team + api key + tracking settings */
const token = "st_" + randomBytes(16).toString("hex");
const db = new Database(DB_PATH);
const uid = "usr_e2e" + randomBytes(6).toString("hex");
const tid = "team_e2e" + randomBytes(6).toString("hex");
db.prepare(
  "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?,?,?,?,?,?)",
).run(uid, `e2e-${Date.now()}@sendthen.dev`, "e2e", "salt:deadbeef", "member", Date.now());
db.prepare("INSERT INTO teams (id, name, created_at) VALUES (?,?,?)").run(
  tid,
  "e2e team",
  Date.now(),
);
db.prepare(
  "INSERT INTO team_members (id, team_id, user_id, role, created_at) VALUES (?,?,?,?,?)",
).run("mem_e2e" + randomBytes(6).toString("hex"), tid, uid, "owner", Date.now());
db.prepare(
  "INSERT INTO api_keys (id, user_id, team_id, name, token_hash, token_prefix, permission, created_at) VALUES (?,?,?,?,?,?,?,?)",
).run(
  "key_e2e" + randomBytes(6).toString("hex"),
  uid,
  tid,
  "e2e",
  createHash("sha256").update(token).digest("hex"),
  token.slice(0, 12),
  "full",
  Date.now(),
);
db.prepare(
  "INSERT INTO user_settings (id, user_id, team_id, mail_mode, track_opens, track_clicks, updated_at) VALUES (?,?,?,?,?,?,?)",
).run("set_e2e" + randomBytes(6).toString("hex"), uid, tid, "sandbox", 1, 1, Date.now());
db.close();
ok("seeded user + team + key + tracking settings");

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

const waitDelivered = async (id, label) => {
  for (let i = 0; i < 30; i++) {
    const { json } = await api("GET", `/emails/${id}`);
    if (json.status === "delivered") return json;
    await sleep(400);
  }
  fail(label, "never delivered");
};

/* 3. auth */
const noauth = await fetch(`${BASE}/api/v1/emails`);
noauth.status === 401 ? ok("401 without key") : fail("auth", noauth.status);

/* 4. domain + DKIM verify (mock DNS) */
const DOMAIN = `mail-${randomBytes(4).toString("hex")}.e2e.test`;
const dom = await api("POST", "/domains", { name: DOMAIN });
dom.status === 201 ? ok("domain created") : fail("domain", JSON.stringify(dom.json));
const ver = await api("POST", `/domains/${dom.json.id}/verify`);
ver.json.status === "verified" ? ok("domain verified") : fail("verify", JSON.stringify(ver.json));

/* 5. webhook receiver (all events) */
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
  events: ["email.delivered", "email.opened", "email.clicked"],
});
hook.status === 201 ? ok("webhook registered") : fail("webhook", JSON.stringify(hook.json));

/* 6. single send + idempotency + tracking injection */
const idem = "e2e-" + Date.now();
const send = await api(
  "POST",
  "/emails",
  {
    from: `e2e <hi@${DOMAIN}>`,
    to: "dest@example.com",
    subject: "e2e smoke",
    html: '<p>hello</p><a href="https://example.com/target">click</a>',
  },
  { "idempotency-key": idem },
);
send.json.id?.startsWith("em_") ? ok(`email queued ${send.json.id}`) : fail("send", JSON.stringify(send.json));
const dup = await api("POST", "/emails", { from: `e2e <hi@${DOMAIN}>`, to: "x@y.z", subject: "dup", text: "d" }, { "idempotency-key": idem });
dup.json.id === send.json.id ? ok("idempotency honored") : fail("idempotency", JSON.stringify(dup.json));
await waitDelivered(send.json.id, "single send");
ok("status → delivered");

const emlPath = path.join(OUTBOX, `${send.json.id}.eml`);
if (!existsSync(emlPath)) fail("eml capture", `${emlPath} missing`);
const eml = readFileSync(emlPath, "utf8");
eml.includes("DKIM-Signature") ? ok("eml DKIM-signed") : fail("dkim", "missing");
const emlDecoded = eml.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
emlDecoded.includes(`/t/o/${send.json.id}.gif`) ? ok("open pixel injected") : fail("pixel", "not injected");
emlDecoded.includes(`/t/c/${send.json.id}?u=`) ? ok("click link rewritten") : fail("click", "not rewritten");

/* 7. open + click tracking hits */
const pixel = await fetch(`${BASE}/t/o/${send.json.id}.gif`);
pixel.headers.get("content-type") === "image/gif" ? ok("open pixel serves gif") : fail("pixel", pixel.status);
const clickUrl = emlDecoded.match(/(\/t\/c\/em_[a-z0-9]+\?u=[^"'\s]+)/)?.[1]
  ?.replace(/&amp;/g, "&");
if (!clickUrl) fail("click url", "not found in eml");
const click = await fetch(BASE + clickUrl, { redirect: "manual" });
click.status === 302 && click.headers.get("location") === "https://example.com/target"
  ? ok("click redirects to target")
  : fail("click", `${click.status} → ${click.headers.get("location")}`);

/* 8. batch send */
const batch = await api("POST", "/emails/batch", [
  { from: `e2e <hi@${DOMAIN}>`, to: "b1@example.com", subject: "b1", text: "1" },
  { from: `e2e <hi@${DOMAIN}>`, to: "b2@example.com", subject: "b2", text: "2" },
]);
batch.json.data?.length === 2 ? ok("batch queued 2") : fail("batch", JSON.stringify(batch.json));

/* 9. template send */
const tpl = await api("POST", "/templates", {
  name: "welcome",
  subject: "Hi {{name}}",
  html: "<h1>Welcome {{name}}</h1>",
});
tpl.status === 201 ? ok("template created") : fail("template", JSON.stringify(tpl.json));
const tplSend = await api("POST", "/emails", {
  from: `e2e <hi@${DOMAIN}>`,
  to: "tpl@example.com",
  template_id: tpl.json.id,
  variables: { name: "Ada" },
});
const tplEmail = await waitDelivered(tplSend.json.id, "template send");
tplEmail.subject === "Hi Ada" && tplEmail.html.includes("Welcome Ada")
  ? ok("template variables rendered")
  : fail("template render", tplEmail.subject);

/* 10. suppression blocks send */
const db2 = new Database(DB_PATH);
db2.prepare(
  "INSERT INTO suppressions (id, user_id, team_id, email, reason, created_at) VALUES (?,?,?,?,?,?)",
).run("sup_e2e" + randomBytes(6).toString("hex"), uid, tid, "blocked@example.com", "manual", Date.now());
db2.close();
const blocked = await api("POST", "/emails", {
  from: `e2e <hi@${DOMAIN}>`,
  to: "blocked@example.com",
  subject: "nope",
  text: "x",
});
blocked.status === 422 && blocked.json.name === "recipients_suppressed"
  ? ok("suppressed recipient rejected")
  : fail("suppression", JSON.stringify(blocked.json));

/* 11. audience + contacts + broadcast fan-out */
const aud = await api("POST", "/audiences", { name: "e2e-news" });
aud.status === 201 ? ok("audience created") : fail("audience", JSON.stringify(aud.json));
await api("POST", `/audiences/${aud.json.id}/contacts`, { email: "c1@example.com", first_name: "Ada" });
await api("POST", `/audiences/${aud.json.id}/contacts`, { email: "c2@example.com", unsubscribed: true });
const contacts = await api("GET", `/audiences/${aud.json.id}/contacts`);
contacts.json.data?.length === 2 ? ok("contacts added") : fail("contacts", JSON.stringify(contacts.json));

const bc = await api("POST", "/broadcasts", {
  audience_id: aud.json.id,
  from: `e2e <news@${DOMAIN}>`,
  subject: "Hey {{first_name}}",
  html: '<p>news</p><a href="{{unsubscribe_url}}">unsub</a>',
});
const bcSend = await api("POST", `/broadcasts/${bc.json.id}/send`);
bcSend.json.queued === 1 ? ok("broadcast fanned out (1 queued, unsub skipped)") : fail("broadcast", JSON.stringify(bcSend.json));

/* 12. unsubscribe link from broadcast email */
const list = await api("GET", "/emails?limit=10");
const bcEmail = list.json.data.find((e) => e.to.includes("c1@example.com"));
if (!bcEmail) fail("broadcast email", "not in list");
const full = await waitDelivered(bcEmail.id, "broadcast delivery");
const unsubUrl = full.html.match(/href="([^"]*\/unsubscribe\/[^"]+)"/)?.[1];
if (!unsubUrl) fail("unsubscribe url", "not in html");
const unsub = await fetch(unsubUrl);
unsub.ok ? ok("one-click unsubscribe works") : fail("unsubscribe", unsub.status);
const contacts2 = await api("GET", `/audiences/${aud.json.id}/contacts`);
contacts2.json.data.find((c) => c.email === "c1@example.com")?.unsubscribed
  ? ok("contact marked unsubscribed")
  : fail("unsubscribe state", "still subscribed");

/* 13. webhook deliveries arrived + signature verifies */
for (let i = 0; i < 20 && received.length < 2; i++) await sleep(500);
if (received.length === 0) fail("webhook delivery", "nothing received");
const types = received.map((r) => JSON.parse(r.body).type);
types.includes("email.delivered") ? ok("email.delivered webhook received") : fail("webhook types", types.join(","));
types.includes("email.opened") ? ok("email.opened webhook received") : fail("webhook opened", types.join(","));
types.includes("email.clicked") ? ok("email.clicked webhook received") : fail("webhook clicked", types.join(","));

const { headers, body } = received[0];
const secret = hook.json.secret.replace(/^whsec_/, "");
const mac = createHmac("sha256", Buffer.from(secret))
  .update(`${headers["webhook-id"]}.${headers["webhook-timestamp"]}.${body}`)
  .digest("base64");
headers["webhook-signature"] === `v1,${mac}`
  ? ok("webhook signature verified")
  : fail("signature", headers["webhook-signature"]);

/* 14. invalid invite bounces to login */
const badInvite = await fetch(`${BASE}/invite/notarealtoken`, { redirect: "manual" });
[302, 307].includes(badInvite.status) ? ok("bad invite redirects") : fail("invite", badInvite.status);

receiver.close();
console.log(`\nE2E PASS — ${passed} checks, full pipeline works.`);
