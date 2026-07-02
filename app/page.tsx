import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { DeliveryTrace } from "@/components/landing/trace";
import { CodeTabs } from "@/components/landing/code-tabs";

const FEATURES = [
  {
    title: "Bring your own pipes",
    body: "Amazon SES, any SMTP relay, direct-to-MX, or a zero-network sandbox — per team, switchable in Settings. SES runs on signed HTTP, no SDK.",
  },
  {
    title: "Tuned for the inbox",
    body: "Verified sending domains with one-click DNS checks, 2048-bit DKIM per domain, automatic bounce & complaint suppression via SES feedback.",
  },
  {
    title: "Opens, clicks, webhooks",
    body: "Signed tracking pixel and link redirects, svix-compatible HMAC webhooks with up to 5 delivery attempts and backoff — nine event types, delivered and logged.",
  },
  {
    title: "Broadcasts & templates",
    body: "Audiences, per-contact {{variables}}, RFC 8058 one-click unsubscribe, reusable templates, batch and scheduled sends — the marketing side, self-hosted too.",
  },
  {
    title: "Inbound too",
    body: "Receive mail on your domains via MX, SES, or HTTP ingest. Read parsed messages in the dashboard and forward them anywhere.",
  },
  {
    title: "A no-code studio",
    body: "A visual template builder with 12 blocks and starter presets. Designs stay re-editable and compile to bulletproof table HTML.",
  },
];

const FACTS = [
  ["4", "transports"],
  ["12", "builder blocks"],
  ["8", "API scopes"],
  ["9", "webhook events"],
];

const CHECKLIST = [
  "teams & invites",
  "scoped API keys",
  "batch sending",
  "scheduled sends",
  "idempotency keys",
  "attachments",
  "templates + variables",
  "broadcasts + one-click unsubscribe",
  "suppression list",
  "SES / SMTP / direct / sandbox",
  "open & click tracking",
  "svix-compatible webhooks",
  "inbound email + forwarding",
  "analytics",
  "one SQLite file",
];

const QUICKSTART = `git clone https://github.com/emreisik95/sendthen && cd sendthen
docker compose up -d
# open http://localhost:3000 → create the admin account`;

const GITHUB_URL = "https://github.com/emreisik95/sendthen";

function GitHubMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default function Landing() {
  return (
    <main className="relative overflow-hidden">
      {/* faint grid + lime halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-240px] h-[480px] w-[720px] -translate-x-1/2 rounded-full"
        style={{
          background: "var(--lime-glow)",
          filter: "blur(140px)",
          opacity: 0.5,
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6">
        {/* nav */}
        <nav className="flex items-center justify-between py-6">
          <span className="font-mono text-lg font-medium">
            send<span className="text-lime">then</span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg"
            >
              Docs
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg"
            >
              <GitHubMark />
              GitHub
            </a>
            <Link href="/login" className={btnSecondary}>
              Sign in
            </Link>
          </div>
        </nav>

        {/* hero */}
        <section className="pb-16 pt-20 text-center">
          <p
            className="st-up mb-4 font-mono text-xs uppercase tracking-[0.2em] text-fg-faint"
            style={{ animationDelay: "0.05s" }}
          >
            self-hosted transactional email
          </p>
          <h1
            className="st-up mx-auto max-w-3xl text-[44px] font-bold leading-[1.05] tracking-[-1.5px] sm:text-[56px]"
            style={{ animationDelay: "0.15s" }}
          >
            Email that is <span className="text-lime">deliverable.</span>
          </h1>
          <p
            className="st-up mx-auto mt-6 max-w-xl text-lg text-fg-muted"
            style={{ animationDelay: "0.25s" }}
          >
            An open-source, Resend-compatible email platform you run yourself.
            Accounts for your team, Amazon SES or any SMTP behind it, DKIM,
            tracking, broadcasts — one container, zero vendors.
          </p>
          <div
            className="st-up mt-9 flex items-center justify-center gap-3"
            style={{ animationDelay: "0.35s" }}
          >
            <Link href="/login" className={`${btnPrimary} st-glow px-6 py-3`}>
              Open dashboard →
            </Link>
            <Link href="/docs" className={`${btnSecondary} px-6 py-3`}>
              Read the docs
            </Link>
          </div>
          <p
            className="st-up mt-5 font-mono text-xs text-fg-faint"
            style={{ animationDelay: "0.42s" }}
          >
            docker compose up -d · MIT licensed · your data stays yours
          </p>

          {/* signature: live delivery trace */}
          <div
            className="st-up mx-auto mt-14 max-w-3xl"
            style={{ animationDelay: "0.5s" }}
          >
            <DeliveryTrace />
          </div>
        </section>

        {/* facts strip */}
        <section className="border-y border-hairline py-6">
          <dl className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
            {FACTS.map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-mono text-xl text-lime">{value}</dd>
                <dd className="mt-1 text-xs uppercase tracking-wider text-fg-faint">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* code */}
        <section id="code" className="py-24">
          <h2 className="mb-6 text-center text-[28px] font-semibold tracking-tight">
            Your first email is one <span className="text-lime">POST</span>{" "}
            away.
          </h2>
          <CodeTabs />
        </section>

        {/* features */}
        <section className="pb-24">
          <h2 className="mb-10 text-center text-[28px] font-semibold tracking-tight">
            Every message,{" "}
            <span className="text-lime">routed &amp; delivered.</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-[10px] border border-line bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-lime/40 hover:bg-surface-2"
              >
                <h3 className="mb-2 font-medium transition-colors group-hover:text-lime">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-fg-muted">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* everything in the box */}
        <section className="pb-24">
          <h2 className="mb-8 text-center text-[28px] font-semibold tracking-tight">
            Everything in <span className="text-lime">the box.</span>
          </h2>
          <ul className="mx-auto grid max-w-3xl gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKLIST.map((item) => (
              <li
                key={item}
                className="flex items-baseline gap-2 font-mono text-[13px] text-fg-muted"
              >
                <span aria-hidden className="text-lime">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* self-host */}
        <section className="pb-24">
          <h2 className="mb-6 text-center text-[28px] font-semibold tracking-tight">
            Self-host in <span className="text-lime">a minute.</span>
          </h2>
          <div className="mx-auto max-w-2xl overflow-hidden rounded-[14px] border border-line bg-surface-3">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-mono text-xs text-fg-faint">
                quickstart.sh
              </span>
              <span className="font-mono text-xs text-lime">3 lines</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-fg-muted">
              {QUICKSTART}
            </pre>
          </div>
          <p className="mx-auto mt-5 max-w-md text-center text-sm text-fg-muted">
            One container, one SQLite file — back it up with a copy, move it
            with a scp.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/docs" className={btnSecondary}>
              Read the docs
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSecondary}
            >
              <GitHubMark />
              Star on GitHub
            </a>
          </div>
        </section>

        {/* CTA band */}
        <section className="pb-24">
          <div
            className="rounded-[14px] border border-lime/25 bg-surface p-10 text-center"
            style={{ boxShadow: "inset 0 0 80px rgba(198,255,0,0.04)" }}
          >
            <h2 className="text-[28px] font-semibold tracking-tight">
              Own your email pipeline{" "}
              <span className="text-lime">tonight.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
              docker run, set a password, add your domain. Everything on this
              page runs on your box.
            </p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <Link href="/docs" className={`${btnPrimary} px-6 py-3`}>
                Get started →
              </Link>
              <Link href="/login" className={`${btnSecondary} px-6 py-3`}>
                Open dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* footer */}
        <footer className="flex items-center justify-between border-t border-hairline py-8 text-xs text-fg-faint">
          <span className="font-mono">
            send<span className="text-lime">then</span> — email for developers
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-fg"
            >
              GitHub
            </a>
            <span aria-hidden>·</span>
            <Link href="/docs" className="transition-colors hover:text-fg">
              Docs
            </Link>
            <span aria-hidden>·</span>
            <a
              href={`${GITHUB_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-fg"
            >
              MIT
            </a>
          </span>
        </footer>
      </div>
    </main>
  );
}
