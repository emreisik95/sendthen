# sendthen

SDK + CLI for [sendthen](https://github.com/emreisik95/sendthen) — the open-source, self-hosted email platform. Zero dependencies, works anywhere `fetch` does (Node 18+, Bun, Deno, edge).

## Install

```bash
npm i sendthen
```

## SDK

```ts
import { SendThen } from "sendthen";

const st = new SendThen("st_...", { baseUrl: "https://send.example.com" });

const { id } = await st.emails.send({
  from: "Acme <hello@acme.com>",
  to: "user@example.com",
  subject: "Hello",
  html: "<p>It works!</p>",
});
```

Also available: `emails.batch/get/list/cancel`, `templates`, `audiences`, `broadcasts`, `domains` (create/verify), `apiKeys`, `webhooks`.

## CLI

```bash
npx sendthen login                # save your instance URL + API key
npx sendthen send --from hello@acme.com --to user@example.com \
  --subject "Hello" --text "It works!"
npx sendthen trace <email-id>     # follow an email's event timeline
```

## Links

- Repo: https://github.com/emreisik95/sendthen
- Docs: https://sendthen.net/docs

MIT
