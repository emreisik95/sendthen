import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { DeliveryTrace } from "@/components/landing/trace";
import { CodeTabs } from "@/components/landing/code-tabs";

const FEATURES = [
  {
    title: "Bring your own pipes",
    body: "Amazon SES, any SMTP relay, direct-to-MX, or a zero-network sandbox — per account, switchable in Settings. SES runs on signed HTTP, no SDK.",
  },
  {
    title: "Tuned for the inbox",
    body: "Verified sending domains with one-click DNS checks, 2048-bit DKIM per domain, automatic bounce & complaint suppression via SES feedback.",
  },
  {
    title: "Opens, clicks, webhooks",
    body: "Signed tracking pixel and link redirects, svix-compatible HMAC webhooks retried 5× with backoff — every event lands where you want it.",
  },
  {
    title: "Broadcasts & templates",
    body: "Audiences, per-contact {{variables}}, one-click unsubscribe, reusable templates, batch sends of 100 — the marketing side, self-hosted too.",
  },
];

const FACTS = [
  ["4", "mail providers"],
  ["2048-bit", "DKIM keys"],
  ["9", "event types"],
  ["1", "SQLite file"],
];

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
          <div className="grid gap-4 sm:grid-cols-2">
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
          <span className="font-mono">self-hosted · MIT</span>
        </footer>
      </div>
    </main>
  );
}
