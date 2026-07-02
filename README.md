<div align="center">

# sendthen

**Open-source, self-hosted email platform — a Resend alternative you run yourself.**

[![License: MIT](https://img.shields.io/badge/license-MIT-C6FF00?style=flat)](./LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat)](https://nextjs.org)
[![SQLite](https://img.shields.io/badge/database-SQLite-003B57?style=flat)](https://www.sqlite.org)
[![Self-hosted](https://img.shields.io/badge/self--hosted-yes-38BDF8?style=flat)](#deploying)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat)](#contributing)

[Live demo](https://sendthen.net) · [Docs](https://sendthen.net/docs) · [Report a bug](https://github.com/emreisik95/sendthen/issues)

![sendthen dashboard — emails](.github/screenshots/emails.png)

</div>

## Why sendthen

Email APIs are great until you're renting your own sending reputation back at per-seat, per-contact prices. sendthen gives you a Resend-compatible API, dashboard, DKIM signing, tracking, webhooks, broadcasts, and inbound email as **one container backed by one SQLite file** — no external queue, no managed database, nothing else to operate. Bring your own transport (Amazon SES, any SMTP relay, or direct-to-MX) and own your sending infrastructure end to end.

## Features

- **Sending** — Resend-compatible REST API: single, batch (up to 100), scheduled sends, attachments, tags, idempotency keys, template sends. Pluggable transports per team: Amazon SES (native SigV4, no SDK), any SMTP relay, direct-to-MX, or sandbox (DKIM-signed `.eml` captured to disk, zero network). In-process queue with retries and backoff.
- **Deliverability** — 2048-bit DKIM per domain, SPF guidance, one-click DNS verification, suppression list with automatic hard-bounce/complaint handling via SES SNS feedback. Outside sandbox, only verified domains may send.
- **Audiences & broadcasts** — contacts with per-contact `{{variables}}`, broadcast fan-out (one personalized email per subscribed contact), RFC 8058 one-click unsubscribe; suppressed and unsubscribed contacts skipped automatically.
- **Template studio** — reusable subject/html/text templates with `{{variable}}` rendering, plus a no-code visual builder: compose from blocks (logo, buttons, columns, OTP code, social links, footer) and it compiles to table-based, email-client-safe HTML. Built templates stay re-editable.
- **Inbound** — receive mail for your verified domains three ways: built-in SMTP listener (point your MX at the instance), Amazon SES receiving via SNS, or raw-MIME HTTP ingest (works behind Cloudflare Email Workers or any relay). Inbox in the dashboard with one-click forwarding.
- **Teams & access** — multi-team workspaces with owner/member roles and invite links; scoped API keys (`emails.send`, `domains.manage`, …); first signup becomes instance admin, `DISABLE_SIGNUP=true` locks the instance after that.
- **Observability** — full email lifecycle events (`queued → sent → delivered / bounced / failed`), svix-compatible HMAC webhooks with up to 5 backoff-spaced delivery attempts and a delivery log, signed open/click tracking, daily volume and delivery/open/click analytics.

## Screenshots

| Landing | Metrics |
|---|---|
| ![landing](.github/screenshots/landing.png) | ![metrics](.github/screenshots/metrics.png) |

| Template builder | Domain verification |
|---|---|
| ![template builder](.github/screenshots/builder.png) | ![domain DNS records](.github/screenshots/domain.png) |

| Preset gallery | Inbound detail |
|---|---|
| ![preset gallery](.github/screenshots/builder-gallery.png) | ![inbound email](.github/screenshots/inbound.png) |

## Quick start

**Docker:**

```bash
git clone https://github.com/emreisik95/sendthen && cd sendthen
docker compose up -d
# open http://localhost:3000
```

**Local dev:**

```bash
pnpm install
pnpm dev
```

First run: create an account — the **first signup becomes the instance admin**. Set `DISABLE_SIGNUP=true` afterwards to block public registration. Create an API key under **API Keys** and you're ready to send. In the default **sandbox** mode nothing leaves the machine: emails are DKIM-signed, captured to `data/outbox/`, and the full pipeline (queue → send → events → webhooks → tracking) still runs.

## Configuration

| Env | Default | Purpose |
|---|---|---|
| `SENDTHEN_MAIL_MODE` | `sandbox` | Instance default transport: `sandbox` · `smtp` · `ses` · `direct` |
| `SMTP_URL` | — | Instance default SMTP relay (`smtp://user:pass@host:587`) |
| `SENDTHEN_HOSTNAME` | `localhost` | EHLO hostname for `direct` mode |
| `SENDTHEN_PUBLIC_URL` | — | Public base URL; **required** for open/click tracking + unsubscribe links |
| `DISABLE_SIGNUP` | `false` | Block signups after the first (admin) account |
| `AUTH_SECRET` | auto | Signing secret; auto-generated and persisted next to the DB if unset |
| `DATABASE_PATH` | `./data/sendthen.db` | SQLite location |
| `SENDTHEN_OUTBOX_DIR` | `./data/outbox` | Where sandbox mode captures `.eml` files |
| `SENDTHEN_SMTP_PORT` | off | Set a port (e.g. `2525`) to run the built-in inbound SMTP listener |
| `SENDTHEN_INGEST_KEY` | derived | Bearer token for `POST /api/inbound/raw` (defaults to a value derived from the instance secret) |
| `SENDTHEN_DNS_MOCK` | — | `verified` makes every DNS check pass (local dev / e2e only) |

Each team can override the transport in **Settings** (own SES credentials or SMTP URL) and toggle open/click tracking — no env vars needed for per-team SES.

## API at a glance

`Authorization: Bearer st_...` — keys are shown once at creation and stored as SHA-256 hashes.

```bash
curl -X POST http://localhost:3000/api/v1/emails \
  -H "Authorization: Bearer st_..." \
  -H "Content-Type: application/json" \
  -d '{
    "from": "you <hello@yourdomain.com>",
    "to": "user@example.com",
    "subject": "Hello",
    "html": "<strong>It just sends.</strong>"
  }'
```

```
POST   /api/v1/emails              send (scheduled_at, tags, attachments, template_id, Idempotency-Key)
POST   /api/v1/emails/batch        up to 100 at once
GET    /api/v1/emails[/:id]        list / detail
POST   /api/v1/emails/:id/cancel   cancel a queued email
POST/GET /api/v1/domains           add (returns DKIM + SPF records) / list · POST /:id/verify re-checks DNS
POST/GET /api/v1/api-keys          create / list · DELETE /:id revokes
POST/GET /api/v1/webhooks          subscribe / list · GET/PATCH/DELETE /:id
POST/GET /api/v1/templates         CRUD · GET/PATCH/DELETE /:id
POST/GET /api/v1/audiences         create / list · GET/DELETE /:id · /:id/contacts add / list
POST/GET /api/v1/broadcasts        draft · POST /:id/send fans out
```

Webhook events: `email.queued|sent|delivered|bounced|complained|failed|canceled|opened|clicked`, HMAC-signed with svix-compatible headers. The **full API reference ships at `/docs` on every instance** — [see the demo's](https://sendthen.net/docs).

A zero-dependency TypeScript SDK + CLI ships as the [`sendthen`](https://www.npmjs.com/package/sendthen) npm package (Node 18+, Bun, Deno, edge — anything with `fetch`; source in [`sdk/`](./sdk)):

```bash
npm install sendthen
```

```ts
import { SendThen } from "sendthen";

const st = new SendThen("st_...", { baseUrl: "https://send.example.com" });
const { id } = await st.emails.send({ from, to, subject, html });
```

The package also includes a CLI: `npx sendthen login`, then `npx sendthen send …` and `npx sendthen trace <id>`.


### Releasing the SDK

The package publishes itself from CI: bump `sdk/package.json`, tag, push —

```bash
cd sdk && npm version patch          # bumps to e.g. 0.1.1
git push && git push --tags          # tag sdk-v0.1.1 triggers the publish workflow
```

(One-time setup: create an npm Automation token at npmjs.com and add it as the `NPM_TOKEN` repository secret.)

## Architecture

Next.js App Router (one standalone server) + SQLite via Drizzle. Sends go through an in-process queue — a background worker claims due emails (`queued → sending`), makes up to 3 attempts with backoff, and handles scheduled sends and webhook redelivery. Each message is DKIM-signed with the domain's own 2048-bit key, then handed to the configured transport: sandbox (disk capture), SMTP relay, Amazon SES (raw SigV4 call, no SDK), or direct MX delivery. Inbound arrives via the built-in SMTP listener, SES/SNS, or raw-MIME HTTP ingest.

```
POST /api/v1/emails ──► queue (SQLite) ──► DKIM sign ──► transport
        │                 │ ▲                             sandbox · smtp · ses · direct MX
   email.queued           │ └── 3 attempts, backoff            │
                          │     suppression filter             ▼
                          │     tracking injection    email.sent / delivered / bounced
                          │                                    │
                          └────────────────────────────────────┤
                                                               ▼
                                            webhooks (HMAC, 5 attempts) + open/click events
```

## Testing

```bash
pnpm test              # 18 unit tests (vitest)
```

End-to-end (37 checks: auth, domains + DKIM, single/batch/template sends, idempotency, suppressions, tracking, webhook signatures, broadcast fan-out, unsubscribe, inbound):

```bash
# start a server with mocked DNS and a self-pointing public URL
SENDTHEN_DNS_MOCK=verified SENDTHEN_PUBLIC_URL=http://127.0.0.1:3100 pnpm dev -- -p 3100

node scripts/e2e.mjs http://127.0.0.1:3100
```

## Deploying

Any Docker host — the image is a standalone Next.js server. Works out of the box on **CapRover** (`captain-definition` included), **Coolify**, Fly, Railway, or plain `docker compose`.

- Mount the **`/data` volume**: it holds the SQLite database, sandbox outbox, and the persisted instance secret.
- Set **`SENDTHEN_PUBLIC_URL`** to your public URL — open/click tracking and unsubscribe links are silently disabled without it.
- To receive email directly, map a port to the SMTP listener (e.g. `25:2525` with `SENDTHEN_SMTP_PORT=2525`) and point your domain's MX at the host.

## Contributing

Issues and PRs welcome. To hack on it:

```bash
pnpm install
pnpm dev                 # sandbox mode, no network needed
pnpm test                # unit tests
pnpm exec tsc --noEmit   # typecheck
```

## License

[MIT](./LICENSE)
