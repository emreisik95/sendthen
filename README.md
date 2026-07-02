# sendthen

**Open-source, self-hosted transactional + marketing email platform.** A Resend-compatible API, multi-user dashboard, DKIM signing, Amazon SES / SMTP / direct-MX transports, open & click tracking, webhooks, broadcasts — one Next.js app, one SQLite file.

## Features

- **Multi-user** — signup/login, per-user API keys, domains, webhooks, settings. First account becomes admin; set `DISABLE_SIGNUP=true` to lock your instance after that.
- **Resend-compatible REST API** — emails (single, batch, scheduled, attachments, tags, idempotency), domains, API keys, webhooks, templates, audiences, broadcasts.
- **Pluggable transports per user** — Amazon SES (native SigV4, no SDK), any SMTP relay, direct-to-MX, or sandbox (captures DKIM-signed `.eml` files locally — full pipeline with zero network).
- **Deliverability** — 2048-bit DKIM per domain, SPF guidance, one-click DNS verification, suppression list with automatic hard-bounce/complaint handling via SES SNS feedback.
- **Tracking** — signed open pixel + click redirects, `email.opened` / `email.clicked` events.
- **Webhooks** — svix-compatible HMAC signatures, 5× retry with backoff, delivery log.
- **Broadcasts** — audiences + contacts, per-contact `{{variables}}`, RFC 8058 one-click unsubscribe.
- **Templates** — reusable subject/html/text with `{{variable}}` rendering, plus a **no-code visual builder** (blocks → email-client-safe table HTML, re-editable designs, starter presets).
- **Analytics** — daily volume by status, delivery/open/click rates.

## Quick start (Docker)

```bash
docker compose up -d
# open http://localhost:3000 → create the admin account → create an API key
```

Or local dev:

```bash
pnpm install
pnpm dev
```

## Send your first email

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

In the default **sandbox** mode nothing leaves the machine — the email is DKIM-signed, captured to `data/outbox/`, and the full pipeline (queue → send → events → webhooks → tracking) still runs.

## Configuration

| Env | Default | Purpose |
|---|---|---|
| `SENDTHEN_MAIL_MODE` | `sandbox` | Instance default transport: `sandbox` · `smtp` · `ses` · `direct` |
| `SMTP_URL` | — | Instance default SMTP relay (`smtp://user:pass@host:587`) |
| `SENDTHEN_PUBLIC_URL` | — | Public base URL; required for tracking + unsubscribe links |
| `DISABLE_SIGNUP` | `false` | Block signups after the first (admin) account |
| `AUTH_SECRET` | auto | Secret for signed URLs (auto-generated + persisted if unset) |
| `DATABASE_PATH` | `./data/sendthen.db` | SQLite location |
| `SENDTHEN_DNS_MOCK` | — | `verified` makes every DNS check pass (local dev) |

Each user can override the transport in **Settings** (own SES credentials or SMTP URL) and toggle open/click tracking.

## Amazon SES

1. Settings → mail provider → *Amazon SES*, enter access key / secret / region (needs `ses:SendRawEmail`).
2. Verify your domain in sendthen (DKIM is signed by sendthen, so no SES domain identity is strictly required for the MIME, but SES requires a verified identity for the `from` — verify it in SES too or use SES's verified domain).
3. Optional: point an SNS topic (bounces + complaints) at `POST /api/ses/feedback` — hard bounces and complaints then auto-populate your suppression list.

## API

`Authorization: Bearer st_...` — full reference lives at `/docs` on your instance.

```
POST   /api/v1/emails              send (scheduled_at, tags, attachments, template_id, Idempotency-Key)
POST   /api/v1/emails/batch        up to 100 at once
GET    /api/v1/emails[/:id]        list / detail
POST   /api/v1/emails/:id/cancel   cancel queued
POST/GET /api/v1/domains           add (returns DKIM+SPF records) / list
POST   /api/v1/domains/:id/verify  re-check DNS
POST/GET /api/v1/api-keys          create / list · DELETE /:id revokes
POST/GET /api/v1/webhooks          subscribe / list · GET/PATCH/DELETE /:id
POST/GET /api/v1/templates         CRUD · GET/PATCH/DELETE /:id
POST/GET /api/v1/audiences         CRUD · /:id/contacts CRUD
POST/GET /api/v1/broadcasts        draft · POST /:id/send fans out
```

Webhook events: `email.queued|sent|delivered|bounced|complained|failed|canceled|opened|clicked` — HMAC-signed with svix-compatible headers.

## SDK

```ts
import { SendThen } from "./sdk";

const st = new SendThen("st_...", { baseUrl: "https://send.example.com" });
await st.emails.send({ from, to, subject, html });
```

## Tests

```bash
pnpm test            # unit + integration (11 tests)
node scripts/e2e.mjs # full pipeline against a running server
```

## Deploy

Any Docker host. The image is a standalone Next.js server; SQLite + captured emails + instance secret live in the `/data` volume. `docker-compose.yml` included; works out of the box on CapRover/Coolify/Fly/Railway.

## License

[MIT](./LICENSE)
