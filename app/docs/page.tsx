import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Docs — sendthen",
  description:
    "SendThen documentation: REST API, SDK reference, webhooks, domains, sandbox mode.",
};

const NAV = [
  ["getting-started", "Getting started"],
  ["authentication", "Authentication"],
  ["mail-modes", "Mail modes & providers"],
  ["emails", "Emails API"],
  ["templates", "Templates"],
  ["audiences", "Audiences & broadcasts"],
  ["tracking", "Open & click tracking"],
  ["suppressions", "Suppressions"],
  ["domains", "Domains API"],
  ["api-keys", "API Keys"],
  ["webhooks", "Webhooks"],
  ["sdk", "SDK reference"],
  ["errors", "Errors"],
] as const;

export default function DocsPage() {
  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-6">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-0.5 overflow-y-auto py-8 lg:flex">
        <Link href="/" className="mb-6 font-mono text-lg font-medium">
          send<span className="text-lime">then</span>
        </Link>
        <span className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-fg-faint">
          Documentation
        </span>
        {NAV.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {label}
          </a>
        ))}
        <Link
          href="/login"
          className="mt-6 rounded-md px-3 py-1.5 text-sm text-lime transition-colors hover:bg-surface-2"
        >
          Open dashboard →
        </Link>
      </aside>

      {/* content */}
      <main className="min-w-0 flex-1 py-10">
        <div className="mb-10 lg:hidden">
          <Link href="/" className="font-mono text-lg font-medium">
            send<span className="text-lime">then</span>
          </Link>
        </div>

        <h1 className="text-[40px] font-bold tracking-[-1.5px]">
          Documentation
        </h1>
        <p className="mt-3 max-w-xl text-fg-muted">
          Everything you need to send your first email and wire sendthen into
          production — REST API, TypeScript SDK, webhooks, and domains.
        </p>

        {/* ---------------------------------------------------------- */}
        <Section id="getting-started" title="Getting started">
          <P>
            sendthen is a single Next.js app backed by one SQLite file. Run it
            locally with pnpm, or in production with Docker:
          </P>
          <Code>{`# local
pnpm install
cp .env.example .env.local   # set ADMIN_PASSWORD
pnpm dev

# production
docker build -t sendthen .
docker run -p 3000:3000 -v sendthen-data:/data -e ADMIN_PASSWORD=... sendthen`}</Code>
          <P>
            Open the dashboard and create the first account — it becomes the
            instance admin (set <Mono>DISABLE_SIGNUP=true</Mono> afterwards to
            block public registration). Create an API key under{" "}
            <b>API Keys</b>, then send:
          </P>
          <Code>{`curl -X POST http://localhost:3000/api/v1/emails \\
  -H "Authorization: Bearer st_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "you <hello@yourdomain.com>",
    "to": "user@example.com",
    "subject": "Hello",
    "html": "<strong>It just sends.</strong>"
  }'`}</Code>
          <P>
            In the default sandbox mode the email is DKIM-signed, captured to
            disk, and marked delivered — the entire pipeline (queue → send →
            events → webhooks) runs without touching the network.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="authentication" title="Authentication">
          <P>
            Every API request needs a bearer token. Keys start with{" "}
            <Mono>st_</Mono>, are shown once at creation, and are stored as
            SHA-256 hashes.
          </P>
          <Code>{`Authorization: Bearer st_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          <Table
            head={["Permission", "Can do"]}
            rows={[
              ["full", "Everything, including managing API keys"],
              ["sending", "Everything except creating or revoking API keys"],
            ]}
          />
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="mail-modes" title="Mail modes & providers">
          <P>
            The instance default transport is <Mono>SENDTHEN_MAIL_MODE</Mono>;
            every user can override it in <b>Settings</b> with their own SES
            credentials or SMTP relay:
          </P>
          <Table
            head={["Mode", "Behavior"]}
            rows={[
              [
                "sandbox (default)",
                "Full MIME built + DKIM-signed, captured to data/outbox/<id>.eml, auto-marked delivered. No network.",
              ],
              [
                "smtp",
                "Relayed through an SMTP URL (e.g. smtp://user:pass@host:587). Any provider or your own MTA.",
              ],
              [
                "ses",
                "Amazon SES v2 SendRawEmail with your IAM access key / secret / region. No AWS SDK involved.",
              ],
              [
                "direct",
                "Delivered straight to each recipient's MX on port 25. Needs clean IP, PTR record, and port-25 egress.",
              ],
            ]}
          />
          <P>
            Outside sandbox mode, only <b>verified domains</b> may send.
            Locally you can set <Mono>SENDTHEN_DNS_MOCK=verified</Mono> to make
            every DNS check pass.
          </P>
          <H3>Amazon SES bounce feedback</H3>
          <P>
            Point an SNS topic (bounces + complaints) at{" "}
            <Mono>POST /api/ses/feedback</Mono>. Subscription confirmation is
            automatic; hard bounces and complaints update email status and
            auto-populate your suppression list.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="emails" title="Emails API">
          <Endpoint method="POST" path="/api/v1/emails" desc="Send an email">
            <Table
              head={["Field", "Type", "Notes"]}
              rows={[
                ["from", "string", 'Required. "Name <a@b.com>" or bare address'],
                ["to", "string | string[]", "Required, max 50 recipients"],
                ["subject", "string", "Required unless template_id is set"],
                ["html / text", "string", "One required (or template_id)"],
                ["cc, bcc, reply_to", "string | string[]", "Optional"],
                ["headers", "object", "Optional extra headers"],
                ["tags", "object", "Optional key/value metadata"],
                [
                  "attachments",
                  "[{filename, content, content_type?}]",
                  "content is base64; 7 MB total",
                ],
                [
                  "scheduled_at",
                  "ISO 8601",
                  "Optional — queue now, send at this time",
                ],
                [
                  "track_opens / track_clicks",
                  "boolean",
                  "Override your Settings defaults",
                ],
                [
                  "template_id + variables",
                  "string + object",
                  "Render a stored template with {{variables}}",
                ],
              ]}
            />
            <P>
              Pass an <Mono>Idempotency-Key</Mono> header to make retries safe:
              the same key always returns the original email id.
            </P>
            <Code>{`{ "id": "em_4kq0w2xr..." }`}</Code>
          </Endpoint>
          <Endpoint
            method="POST"
            path="/api/v1/emails/batch"
            desc="Send up to 100 emails in one call"
          >
            <P>
              Body is a JSON array of send objects (same fields as above,
              minus the idempotency header). Returns{" "}
              <Mono>{`{ data: [{ id }, …] }`}</Mono> in input order.
            </P>
          </Endpoint>
          <Endpoint method="GET" path="/api/v1/emails" desc="List emails">
            <P>
              Returns the latest emails (<Mono>?limit=</Mono>, max 100).
            </P>
          </Endpoint>
          <Endpoint
            method="GET"
            path="/api/v1/emails/:id"
            desc="Get one email"
          >
            <P>
              Full record including <Mono>status</Mono> (
              <Mono>
                queued · sending · sent · delivered · bounced · failed ·
                canceled
              </Mono>
              ), <Mono>message_id</Mono>, and <Mono>last_error</Mono>.
            </P>
          </Endpoint>
          <Endpoint
            method="POST"
            path="/api/v1/emails/:id/cancel"
            desc="Cancel a queued email"
          >
            <P>Only emails still in the queue can be canceled.</P>
          </Endpoint>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="templates" title="Templates">
          <P>
            Store reusable emails with <Mono>{"{{variables}}"}</Mono> in
            subject and body, then send by id:
          </P>
          <Code>{`POST /api/v1/templates        { "name": "welcome", "subject": "Hi {{name}}", "html": "<h1>Hey {{name}}</h1>" }
GET  /api/v1/templates        list
GET/PATCH/DELETE /api/v1/templates/:id

POST /api/v1/emails           { "from": "...", "to": "...", "template_id": "tpl_...", "variables": { "name": "Ada" } }`}</Code>
          <P>Unknown variables are left as-is; explicit html/text/subject in the send call win over the template.</P>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="audiences" title="Audiences & broadcasts">
          <P>
            Audiences hold contacts; broadcasts fan out one personalized email
            per subscribed contact with{" "}
            <Mono>{"{{first_name}} {{last_name}} {{email}} {{unsubscribe_url}}"}</Mono>{" "}
            substitution and RFC 8058 one-click unsubscribe headers.
          </P>
          <Code>{`POST /api/v1/audiences                  { "name": "newsletter" }
POST /api/v1/audiences/:id/contacts     { "email": "a@b.com", "first_name": "Ada" }
GET  /api/v1/audiences/:id/contacts     list

POST /api/v1/broadcasts                 { "audience_id": "aud_...", "from": "...", "subject": "Hey {{first_name}}", "html": "..." }
POST /api/v1/broadcasts/:id/send        → { "queued": 120, "skipped": 3 }`}</Code>
          <P>
            Unsubscribed and suppressed contacts are skipped automatically.
            Unsubscribe links are HMAC-signed and work without login.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="tracking" title="Open & click tracking">
          <P>
            Enable per-account in <b>Settings</b> or per-send with{" "}
            <Mono>track_opens</Mono> / <Mono>track_clicks</Mono>. Requires{" "}
            <Mono>SENDTHEN_PUBLIC_URL</Mono>. Opens use a signed 1×1 pixel;
            clicks rewrite links through a signed redirect. Both emit{" "}
            <Mono>email.opened</Mono> / <Mono>email.clicked</Mono> events to
            your webhooks and show up in Overview analytics.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="suppressions" title="Suppressions">
          <P>
            Addresses on your suppression list never receive email: they are
            dropped at send time, and an email whose every recipient is
            suppressed fails with <Mono>recipients_suppressed</Mono>. Hard
            bounces and complaints (via SES feedback) are added automatically;
            manual entries via the dashboard.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="domains" title="Domains API">
          <P>
            Adding a domain generates a 2048-bit DKIM keypair and returns the
            DNS records to publish:
          </P>
          <Code>{`POST /api/v1/domains          { "name": "mail.yourdomain.com" }
GET  /api/v1/domains          list
GET  /api/v1/domains/:id      detail incl. records[]
POST /api/v1/domains/:id/verify   re-check DNS
DELETE /api/v1/domains/:id    remove`}</Code>
          <Table
            head={["Record", "Host", "Value"]}
            rows={[
              [
                "TXT (DKIM)",
                "stmail._domainkey.<domain>",
                "v=DKIM1; k=rsa; p=<public key>",
              ],
              ["TXT (SPF)", "<domain>", "v=spf1 a mx ~all"],
            ]}
          />
          <P>
            <Mono>status</Mono> becomes <Mono>verified</Mono> once both records
            resolve. Verification also runs from the dashboard with one click.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="api-keys" title="API Keys">
          <Code>{`POST   /api/v1/api-keys      { "name": "production", "permission": "full" | "sending" }
GET    /api/v1/api-keys      list (prefixes only)
DELETE /api/v1/api-keys/:id  revoke`}</Code>
          <P>
            The full token is returned <b>only once</b>, in the create
            response. Requires a <Mono>full</Mono>-permission key.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="webhooks" title="Webhooks">
          <P>
            Subscribe to lifecycle events. Deliveries are retried 5× with
            backoff (5s → 5m → 30m → 2h) and logged in the dashboard.
          </P>
          <Code>{`POST /api/v1/webhooks   { "url": "https://you.com/hooks", "events": ["email.delivered"] }`}</Code>
          <Table
            head={["Event", "Fires when"]}
            rows={[
              ["email.queued", "Accepted by the API"],
              ["email.sent", "Handed to the transport (SMTP 250 / captured)"],
              ["email.delivered", "Delivery confirmed (sandbox: immediately)"],
              ["email.bounced", "Recipient server rejected the message"],
              ["email.complained", "Recipient marked it as spam (SES feedback)"],
              ["email.failed", "All send attempts exhausted"],
              ["email.canceled", "Canceled while queued"],
              ["email.opened", "Tracking pixel loaded"],
              ["email.clicked", "Tracked link followed"],
            ]}
          />
          <H3>Payload</H3>
          <Code>{`{
  "type": "email.delivered",
  "created_at": "2026-07-02T09:31:04.220Z",
  "data": {
    "email_id": "em_4kq0w2xr...",
    "from": "you <hello@yourdomain.com>",
    "to": ["user@example.com"],
    "subject": "Hello",
    "message_id": "<...>"
  }
}`}</Code>
          <H3>Verifying signatures</H3>
          <P>
            Headers are svix-compatible: <Mono>webhook-id</Mono>,{" "}
            <Mono>webhook-timestamp</Mono>, <Mono>webhook-signature</Mono>. The
            signed content is <Mono>{"`${id}.${timestamp}.${body}`"}</Mono>,
            HMAC-SHA256 with your endpoint&apos;s <Mono>whsec_</Mono> secret:
          </P>
          <Code>{`import { createHmac, timingSafeEqual } from "node:crypto";

function verify(req: Request, rawBody: string, secret: string) {
  const id = req.headers.get("webhook-id")!;
  const ts = req.headers.get("webhook-timestamp")!;
  const sig = req.headers.get("webhook-signature")!;

  const mac = createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, "")))
    .update(\`\${id}.\${ts}.\${rawBody}\`)
    .digest("base64");

  const expected = Buffer.from(\`v1,\${mac}\`);
  const received = Buffer.from(sig);
  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}`}</Code>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="sdk" title="SDK reference">
          <P>
            The TypeScript SDK lives in <Mono>sdk/index.ts</Mono> — zero
            dependencies, works in Node 18+, Bun, Deno, and edge runtimes
            (anything with <Mono>fetch</Mono>).
          </P>

          <H3>Constructor</H3>
          <Code>{`import { SendThen } from "./sdk";

const st = new SendThen("st_xxxxxxxx", {
  baseUrl: "https://send.yourdomain.com", // default: SENDTHEN_BASE_URL env or http://localhost:3000
  fetch: customFetch,                     // optional fetch override
});`}</Code>
          <P>
            Every method returns a promise. Non-2xx responses throw{" "}
            <Mono>SendThenError</Mono> with <Mono>statusCode</Mono>,{" "}
            <Mono>name</Mono>, and <Mono>message</Mono>.
          </P>

          <H3>st.emails</H3>
          <Table
            head={["Method", "Returns", "Notes"]}
            rows={[
              [
                "send(options, { idempotencyKey? })",
                "{ id }",
                "options mirrors POST /emails fields",
              ],
              ["get(id)", "email object", "status, message_id, last_error…"],
              ["list()", "{ data: [...] }", "latest emails"],
              ["cancel(id)", "{ id }", "queued emails only"],
            ]}
          />
          <Code>{`const { id } = await st.emails.send(
  {
    from: "you <hello@yourdomain.com>",
    to: ["user@example.com"],
    subject: "Welcome aboard",
    html: "<strong>It just sends.</strong>",
    scheduled_at: "2026-07-03T09:00:00+03:00", // optional
  },
  { idempotencyKey: "welcome-user-42" },       // optional, retry-safe
);

const email = await st.emails.get(id);
console.log(email.status); // queued → sent → delivered`}</Code>

          <H3>st.domains</H3>
          <Table
            head={["Method", "Returns", "Notes"]}
            rows={[
              [
                "create(name)",
                "domain + records[]",
                "generates the DKIM keypair",
              ],
              ["get(id)", "domain", "records[] include per-record status"],
              ["list()", "{ data: [...] }", ""],
              ["verify(id)", "domain", "re-resolves DKIM + SPF TXT records"],
              ["remove(id)", "{ id }", ""],
            ]}
          />
          <Code>{`const domain = await st.domains.create("mail.yourdomain.com");
// publish domain.records, then:
const verified = await st.domains.verify(domain.id);
console.log(verified.status); // "verified"`}</Code>

          <H3>st.apiKeys</H3>
          <Table
            head={["Method", "Returns", "Notes"]}
            rows={[
              [
                'create(name, permission = "full")',
                "{ id, token }",
                "token is shown only here",
              ],
              ["list()", "{ data: [...] }", "prefixes only"],
              ["remove(id)", "{ id }", "revoke"],
            ]}
          />

          <H3>st.webhooks</H3>
          <Table
            head={["Method", "Returns", "Notes"]}
            rows={[
              [
                "create(url, events)",
                "{ id, secret }",
                "secret is your whsec_ signing key",
              ],
              ["list()", "{ data: [...] }", ""],
              ["remove(id)", "{ id }", ""],
            ]}
          />
          <Code>{`const hook = await st.webhooks.create(
  "https://you.com/hooks/sendthen",
  ["email.delivered", "email.bounced"],
);
// store hook.secret for signature verification`}</Code>
        </Section>

        {/* ---------------------------------------------------------- */}
        <Section id="errors" title="Errors">
          <P>All errors share one JSON shape:</P>
          <Code>{`{ "statusCode": 422, "name": "validation_error", "message": "Either html or text must be provided." }`}</Code>
          <Table
            head={["Status", "Name", "When"]}
            rows={[
              ["400", "invalid_json", "Body is not valid JSON"],
              ["401", "missing_api_key / invalid_api_key", "Bad bearer token"],
              [
                "403",
                "domain_not_verified / forbidden",
                "Unverified sender domain, or key lacks permission",
              ],
              ["404", "not_found", "Resource does not exist"],
              ["409", "already_exists", "Duplicate domain"],
              [
                "422",
                "validation_error / not_cancelable",
                "Bad fields, or email already sent",
              ],
            ]}
          />
        </Section>

        <footer className="mt-16 flex items-center justify-between border-t border-hairline py-8 text-xs text-fg-faint">
          <span className="font-mono">
            send<span className="text-lime">then</span> docs
          </span>
          <Link href="/" className="font-mono hover:text-fg">
            ← home
          </Link>
        </footer>
      </main>
    </div>
  );
}

/* ---------- local building blocks ---------- */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-8">
      <h2 className="mb-4 border-b border-hairline pb-3 text-[24px] font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Endpoint({
  method,
  path,
  desc,
  children,
}: {
  method: string;
  path: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="my-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 font-mono text-xs font-medium ${
            method === "GET"
              ? "bg-info/14 text-info"
              : method === "DELETE"
                ? "bg-danger/14 text-danger"
                : "bg-ok/14 text-lime"
          }`}
        >
          {method}
        </span>
        <code className="font-mono text-sm text-fg">{path}</code>
        <span className="text-sm text-fg-faint">— {desc}</span>
      </div>
      {children}
    </div>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-8 text-[17px] font-medium">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return (
    <p className="my-3 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
      {children}
    </p>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[13px] text-fg">
      {children}
    </code>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-[10px] border border-line bg-surface-3 p-4 font-mono text-[13px] leading-relaxed text-fg-muted">
      {children}
    </pre>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-[10px] border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-fg-faint"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-hairline">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 align-top ${
                    j === 0 ? "font-mono text-xs text-fg" : "text-fg-muted"
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
