#!/usr/bin/env node
/**
 * sendthen — CLI for your self-hosted SendThen instance.
 *
 * Zero dependencies. Node 18+ built-ins only.
 *
 *   sendthen login
 *   sendthen send --from you@x.dev --to a@b.co --subject Hi --text "Hello"
 *   sendthen trace <id> --watch
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const colorEnabled =
  process.env.NO_COLOR === undefined && Boolean(process.stdout.isTTY);

function paint(code: string): (s: string) => string {
  return (s: string) => (colorEnabled ? `\x1b[${code}m${s}\x1b[0m` : s);
}

const bold = paint("1");
const dim = paint("2");
const red = paint("31");
const green = paint("32");
const yellow = paint("33");
const cyan = paint("36");
const gray = paint("90");
const lime = paint("92"); // brand accent

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface Config {
  baseUrl: string;
  apiKey: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".config", "sendthen");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

function loadConfig(): Config | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    if (typeof parsed.baseUrl === "string" && typeof parsed.apiKey === "string") {
      return { baseUrl: parsed.baseUrl, apiKey: parsed.apiKey };
    }
    return null;
  } catch {
    return null;
  }
}

function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // best effort (e.g. exotic filesystems)
  }
}

function requireConfig(): Config {
  const envKey = process.env.SENDTHEN_API_KEY;
  if (envKey) {
    return {
      baseUrl: (process.env.SENDTHEN_BASE_URL ?? "https://sendthen.net").replace(/\/$/, ""),
      apiKey: envKey,
    };
  }
  const config = loadConfig();
  if (!config) {
    fail("Not logged in. Run `sendthen login` first.");
  }
  return config;
}

// ---------------------------------------------------------------------------
// Errors / exit
// ---------------------------------------------------------------------------

function fail(message: string): never {
  process.stderr.write(red(`error: ${message}`) + "\n");
  process.exit(1);
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function api<T>(
  config: Config,
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<T> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/api/v1${apiPath}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, `could not reach ${url} (${detail})`);
  }
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    throw new ApiError(res.status, String(json.message ?? `Request failed (${res.status})`));
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// argv parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const name = arg.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[name] = next;
          i++;
        } else {
          flags[name] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function flagString(flags: Record<string, string | boolean>, name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}

function requireFlag(flags: Record<string, string | boolean>, name: string): string {
  const v = flagString(flags, name);
  if (!v) fail(`missing required flag --${name}`);
  return v;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function colorStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "queued" || s === "sent" || s === "sending" || s === "scheduled") return cyan(s);
  if (s === "delivered" || s === "opened" || s === "clicked" || s === "verified" || s === "active")
    return green(s);
  if (s === "bounced" || s === "failed" || s === "complained" || s === "rejected") return red(s);
  if (s === "canceled" || s === "cancelled" || s === "not_started") return gray(s);
  if (s === "pending" || s === "verifying") return yellow(s);
  return s;
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const p = (n: number): string => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => str(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function printTable(headers: string[], rows: string[][], colorCols: number[] = []): void {
  // widths computed on raw (uncolored) text
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const headerLine = headers.map((h, i) => pad(h.toUpperCase(), widths[i])).join("  ");
  process.stdout.write(dim(headerLine) + "\n");
  for (const row of rows) {
    const cells = row.map((cell, i) => {
      const padded = pad(cell, widths[i]);
      if (colorCols.includes(i)) {
        // color the value but keep padding uncolored so alignment survives
        return colorStatus(cell) + " ".repeat(widths[i] - cell.length);
      }
      return padded;
    });
    process.stdout.write(cells.join("  ") + "\n");
  }
}

// ---------------------------------------------------------------------------
// readline prompt
// ---------------------------------------------------------------------------

function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? dim(` (${defaultValue})`) : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || "");
    });
  });
}

// ---------------------------------------------------------------------------
// Shared API shapes
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

interface EmailEvent {
  type: string;
  data: Json | null;
  created_at: string;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  purpose?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdLogin(): Promise<void> {
  process.stdout.write(lime(bold("sendthen login")) + "\n\n");
  const baseUrl = (await prompt("Base URL", "https://sendthen.net")).replace(/\/$/, "");
  const apiKey = await prompt("API key");
  if (!apiKey) fail("API key is required.");

  const config: Config = { baseUrl, apiKey };
  process.stdout.write(dim("Validating…") + "\n");
  try {
    await api<Json>(config, "GET", "/emails?limit=1");
  } catch (err) {
    if (err instanceof ApiError) {
      fail(err.statusCode ? `${err.statusCode}: ${err.message}` : err.message);
    }
    throw err;
  }
  saveConfig(config);
  process.stdout.write(
    green("✓") + ` Logged in to ${bold(baseUrl)}. Config saved to ${dim(CONFIG_PATH)}\n`,
  );
}

async function cmdSend(flags: Record<string, string | boolean>): Promise<void> {
  const config = requireConfig();
  const from = requireFlag(flags, "from");
  const to = requireFlag(flags, "to");
  const subject = requireFlag(flags, "subject");
  const html = flagString(flags, "html");
  const text = flagString(flags, "text");
  if (!html && !text) fail("provide --html or --text");

  const body: Json = { from, to: to.split(","), subject };
  if (html) body.html = html;
  if (text) body.text = text;
  const cc = flagString(flags, "cc");
  const bcc = flagString(flags, "bcc");
  if (cc) body.cc = cc.split(",");
  if (bcc) body.bcc = bcc.split(",");

  const result = await api<{ id: string }>(config, "POST", "/emails", body);
  process.stdout.write(green("✓") + ` Email queued ${bold(result.id)}\n`);
  process.stdout.write(dim("  follow it live: ") + lime(`sendthen trace ${result.id}`) + "\n");
}

async function cmdEmailsList(flags: Record<string, string | boolean>): Promise<void> {
  const config = requireConfig();
  const limit = flagString(flags, "limit");
  const qs = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  const result = await api<{ data: Json[] }>(config, "GET", `/emails${qs}`);
  const emails = result.data ?? [];
  if (emails.length === 0) {
    process.stdout.write(dim("No emails yet.") + "\n");
    return;
  }
  const rows = emails.map((e) => [
    str(e.id),
    str(e.status ?? e.last_event ?? "unknown"),
    truncate(str(e.to), 32),
    truncate(str(e.subject), 40),
    formatTimestamp(e.created_at),
  ]);
  printTable(["id", "status", "to", "subject", "created"], rows, [1]);
}

async function cmdEmailsGet(id: string): Promise<void> {
  const config = requireConfig();
  const email = await api<Json>(config, "GET", `/emails/${encodeURIComponent(id)}`);
  const keys = Object.keys(email);
  const width = Math.max(...keys.map((k) => k.length));
  for (const key of keys) {
    const value = email[key];
    let rendered: string;
    if (key === "status" || key === "last_event") rendered = colorStatus(str(value));
    else if (key.endsWith("_at") || key === "created_at") rendered = formatTimestamp(value);
    else rendered = str(value);
    process.stdout.write(`${dim(pad(key, width))}  ${rendered}\n`);
  }
}

const TERMINAL_EVENTS = new Set(["delivered", "bounced", "failed", "canceled", "cancelled"]);

function normalizeEventType(type: string): string {
  return type.replace(/^email\./, "").toLowerCase();
}

function eventDetail(type: string, data: Json | null): string {
  if (!data) return "";
  switch (type) {
    case "sent":
      return data.message_id ? dim(str(data.message_id)) : "";
    case "clicked":
      return data.url ? str(data.url) : "";
    case "failed":
    case "bounced":
      return red(str(data.error ?? data.reason ?? data.message ?? ""));
    case "opened":
      return data.user_agent ? dim(truncate(str(data.user_agent), 60)) : "";
    default: {
      const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
      if (entries.length === 0) return "";
      return dim(entries.map(([k, v]) => `${k}=${str(v)}`).join(" ").slice(0, 80));
    }
  }
}

function eventColor(type: string): (s: string) => string {
  if (type === "queued" || type === "sent") return cyan;
  if (type === "delivered" || type === "opened" || type === "clicked") return green;
  if (type === "bounced" || type === "failed" || type === "complained") return red;
  if (type === "canceled" || type === "cancelled") return gray;
  return (s: string) => s;
}

function printEvent(event: EmailEvent): string {
  const type = normalizeEventType(event.type);
  const word = eventColor(type)(pad(type, 10));
  const detail = eventDetail(type, event.data);
  process.stdout.write(`${dim(formatTimestamp(event.created_at))}  ${word}  ${detail}\n`);
  return type;
}

async function cmdTrace(id: string, flags: Record<string, string | boolean>): Promise<void> {
  const config = requireConfig();
  const watch = flags.watch === true;
  const fetchEvents = (): Promise<EmailEvent[]> =>
    api<{ data: EmailEvent[] }>(
      config,
      "GET",
      `/emails/${encodeURIComponent(id)}/events`,
    ).then((r) => r.data ?? []);

  process.stdout.write(dim(`trace ${id}`) + "\n");
  let events = await fetchEvents();
  if (events.length === 0 && !watch) {
    process.stdout.write(dim("No events yet.") + "\n");
    return;
  }
  let lastType = "";
  for (const event of events) lastType = printEvent(event);

  if (!watch) return;
  if (TERMINAL_EVENTS.has(lastType)) return;

  process.stdout.write(dim("watching… (ctrl-c to stop)") + "\n");
  let seen = events.length;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    events = await fetchEvents();
    let terminal = false;
    for (let i = seen; i < events.length; i++) {
      const type = printEvent(events[i]);
      if (TERMINAL_EVENTS.has(type)) terminal = true;
    }
    seen = Math.max(seen, events.length);
    if (terminal) return;
  }
}

async function cmdDomainsList(): Promise<void> {
  const config = requireConfig();
  const result = await api<{ data: Json[] }>(config, "GET", "/domains");
  const domains = result.data ?? [];
  if (domains.length === 0) {
    process.stdout.write(dim("No domains. Add one: ") + lime("sendthen domains add <name>") + "\n");
    return;
  }
  const rows = domains.map((d) => [str(d.id), str(d.name), str(d.status ?? "unknown")]);
  printTable(["id", "name", "status"], rows, [2]);
}

function printDnsRecords(records: DnsRecord[]): void {
  if (records.length === 0) return;
  process.stdout.write("\n" + bold("Add these DNS records:") + "\n\n");
  const typeW = Math.max(4, ...records.map((r) => r.type.length));
  const hostW = Math.max(4, ...records.map((r) => r.name.length));
  process.stdout.write(
    dim(`${pad("TYPE", typeW)}  ${pad("HOST", hostW)}  VALUE`) + "\n",
  );
  for (const record of records) {
    process.stdout.write(
      `${lime(pad(record.type, typeW))}  ${pad(record.name, hostW)}  ${record.value}\n`,
    );
  }
  process.stdout.write("\n" + dim("Then run: ") + lime("sendthen domains verify <name>") + "\n");
}

async function cmdDomainsAdd(name: string): Promise<void> {
  const config = requireConfig();
  const domain = await api<{ id: string; name: string; status: string; records: DnsRecord[] }>(
    config,
    "POST",
    "/domains",
    { name },
  );
  process.stdout.write(
    green("✓") + ` Domain ${bold(domain.name)} created (${colorStatus(domain.status)})\n`,
  );
  printDnsRecords(domain.records ?? []);
}

async function resolveDomainId(config: Config, idOrName: string): Promise<string> {
  if (!idOrName.includes(".")) return idOrName; // looks like an id
  const result = await api<{ data: Json[] }>(config, "GET", "/domains");
  const match = (result.data ?? []).find((d) => str(d.name) === idOrName);
  if (!match) fail(`domain "${idOrName}" not found`);
  return str(match.id);
}

async function cmdDomainsVerify(idOrName: string): Promise<void> {
  const config = requireConfig();
  const id = await resolveDomainId(config, idOrName);
  const result = await api<{ status?: string; records?: DnsRecord[] }>(
    config,
    "POST",
    `/domains/${encodeURIComponent(id)}/verify`,
  );
  const records = result.records ?? [];
  if (records.length > 0) {
    const typeW = Math.max(4, ...records.map((r) => r.type.length));
    const hostW = Math.max(4, ...records.map((r) => r.name.length));
    for (const record of records) {
      const ok = (record.status ?? "").toLowerCase() === "verified";
      const mark = ok ? green("✓") : yellow("…");
      process.stdout.write(
        `${mark} ${pad(record.type, typeW)}  ${pad(record.name, hostW)}  ${colorStatus(record.status ?? "pending")}\n`,
      );
    }
  }
  const status = result.status ?? "pending";
  process.stdout.write(`\nDomain status: ${colorStatus(str(status))}\n`);
}

async function cmdKeys(): Promise<void> {
  const config = requireConfig();
  const result = await api<{ data: Json[] }>(config, "GET", "/api-keys");
  const keys = result.data ?? [];
  if (keys.length === 0) {
    process.stdout.write(dim("No API keys.") + "\n");
    return;
  }
  const rows = keys.map((k) => [
    str(k.id),
    str(k.name),
    str(k.prefix ?? k.token_prefix ?? ""),
    str(k.scopes ?? k.permission ?? ""),
  ]);
  printTable(["id", "name", "prefix", "scopes"], rows);
}

// ---------------------------------------------------------------------------
// version / help
// ---------------------------------------------------------------------------

function readVersion(): string {
  try {
    // dist/cli.js lives one level below package.json
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp(): void {
  const cmd = (name: string, desc: string): string =>
    `  ${lime(pad(name, 34))} ${desc}\n`;
  process.stdout.write(
    `\n${bold(lime("sendthen"))} ${dim("v" + readVersion())} — email that tells you what happened next\n\n` +
      bold("USAGE\n") +
      `  sendthen ${dim("<command> [options]")}\n\n` +
      bold("COMMANDS\n") +
      cmd("login", "connect to your SendThen instance") +
      cmd("send --from --to --subject …", "send an email (--html or --text, --cc, --bcc)") +
      cmd("emails [--limit N]", "list recent emails") +
      cmd("emails get <id>", "show one email in detail") +
      cmd("trace <id> [--watch]", "event timeline for an email (live with --watch)") +
      cmd("domains", "list sending domains") +
      cmd("domains add <name>", "add a domain + print DNS records") +
      cmd("domains verify <id|name>", "check DNS and verify a domain") +
      cmd("keys", "list API keys") +
      cmd("help", "show this screen") +
      cmd("--version", "print version") +
      "\n" +
      bold("EXAMPLES\n") +
      dim("  sendthen send --from hi@you.dev --to a@b.co --subject Hey --text 'Hello'\n") +
      dim("  sendthen trace em_1a2b3c --watch\n") +
      "\n" +
      dim(`  config: ${CONFIG_PATH}\n`) +
      "\n",
  );
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { positional, flags } = parseArgs(argv);
  const command = positional[0];

  if (flags.version === true || command === "--version" || command === "version") {
    process.stdout.write(readVersion() + "\n");
    return;
  }
  if (!command || command === "help" || flags.help === true) {
    printHelp();
    return;
  }

  switch (command) {
    case "login":
      await cmdLogin();
      return;
    case "send":
      await cmdSend(flags);
      return;
    case "emails":
      if (positional[1] === "get") {
        const id = positional[2];
        if (!id) fail("usage: sendthen emails get <id>");
        await cmdEmailsGet(id);
      } else {
        await cmdEmailsList(flags);
      }
      return;
    case "trace": {
      const id = positional[1];
      if (!id) fail("usage: sendthen trace <id> [--watch]");
      await cmdTrace(id, flags);
      return;
    }
    case "domains": {
      const sub = positional[1];
      if (sub === "add") {
        const name = positional[2];
        if (!name) fail("usage: sendthen domains add <name>");
        await cmdDomainsAdd(name);
      } else if (sub === "verify") {
        const target = positional[2];
        if (!target) fail("usage: sendthen domains verify <id-or-name>");
        await cmdDomainsVerify(target);
      } else if (sub === undefined) {
        await cmdDomainsList();
      } else {
        fail(`unknown domains subcommand "${sub}"`);
      }
      return;
    }
    case "keys":
      await cmdKeys();
      return;
    default:
      fail(`unknown command "${command}" — run \`sendthen help\``);
  }
}

main().catch((err: unknown) => {
  if (err instanceof ApiError) {
    fail(err.statusCode ? `${err.statusCode}: ${err.message}` : err.message);
  }
  fail(err instanceof Error ? err.message : String(err));
});
