/* Captures README screenshots from a running local instance with data.
 * Prereqs: server on :3100 started with SENDTHEN_DNS_MOCK=verified,
 * SENDTHEN_PUBLIC_URL + SENDTHEN_INGEST_KEY, and scripts/e2e.mjs already
 * run against it (provides delivered emails, domain, broadcast, inbound).
 * Usage: node scripts/screenshots.mjs
 */
import { chromium } from "playwright";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";

const BASE = "http://127.0.0.1:3100";
const DB_PATH = process.env.DATABASE_PATH ?? "./data/sendthen.db";
const OUT = ".github/screenshots";
mkdirSync(OUT, { recursive: true });

// give the freshest e2e user a known password + find showcase records
const PASSWORD = "screenshot-pass-1";
const db = new Database(DB_PATH);
const user = db
  .prepare("SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1")
  .get();
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(PASSWORD, salt, 64).toString("hex");
db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
  `${salt}:${hash}`,
  user.id,
);
const domain = db
  .prepare("SELECT id FROM domains ORDER BY created_at DESC LIMIT 1")
  .get();
const inbound = db
  .prepare("SELECT id FROM inbound_emails ORDER BY created_at DESC LIMIT 1")
  .get();
db.close();
console.log(`user: ${user.email}`);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

const shot = async (path, file, opts = {}) => {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(opts.settle ?? 1200);
  await page.screenshot({ path: `${OUT}/${file}.png` });
  console.log(`  ✓ ${file}.png  (${path})`);
};

// landing (let the reveal + trace play)
await shot("/", "landing", { settle: 4500 });

// login
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', user.email);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/emails", { timeout: 15000 });
console.log("  ✓ signed in");

await shot("/emails", "emails");
await shot("/metrics", "metrics", { settle: 1500 });
await shot("/templates/builder?preset=welcome", "builder", { settle: 1500 });
if (domain) await shot(`/domains/${domain.id}`, "domain");
if (inbound) await shot(`/emails/inbound/${inbound.id}`, "inbound");

await browser.close();
console.log("\nScreenshots captured.");
