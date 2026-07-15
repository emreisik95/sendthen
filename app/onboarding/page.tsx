import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, domains, type Domain } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { onboardingProgress } from "@/lib/onboarding";
import { dnsRecordsForDomain } from "@/lib/dkim";
import { mailMode } from "@/lib/mailer";
import { publicUrl } from "@/lib/tracking";
import {
  completeOnboardingAction,
  onboardingCreateDomainAction,
  onboardingCreateKeyAction,
} from "@/app/actions";
import { Card, btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { LiveVerify } from "@/components/domains/live-verify";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Getting started",
};

type StepKey = "welcome" | "domain" | "key" | "send";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "welcome", label: "Welcome" },
  { key: "domain", label: "Domain" },
  { key: "key", label: "API key" },
  { key: "send", label: "Send" },
];

function isStep(s: string | undefined): s is StepKey {
  return s === "welcome" || s === "domain" || s === "key" || s === "send";
}

/* ---------- small pieces ---------- */

function SkipTour() {
  return (
    <form action={completeOnboardingAction}>
      <button
        name="to"
        value="/emails"
        className="inline-flex min-h-10 items-center text-sm text-fg-muted transition-colors hover:text-fg"
      >
        Skip tour →
      </button>
    </form>
  );
}

function Rail({
  current,
  done,
  token,
}: {
  current: StepKey;
  done: Record<StepKey, boolean>;
  token?: string;
}) {
  const href = (step: StepKey) =>
    `/onboarding?step=${step}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
  const completedSteps = STEPS.filter((step) => done[step.key]).length;
  const completion = Math.round((completedSteps / STEPS.length) * 100);

  return (
    <nav
      aria-label="Setup journey"
      className="rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-8 lg:self-start"
    >
      <div className="flex items-start justify-between gap-4 lg:block">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-lime">
            Getting started
          </p>
          <h2
            id="setup-journey-heading"
            className="mt-1.5 text-sm font-medium text-fg"
          >
            Setup journey
          </h2>
        </div>
        <span className="font-mono text-xs text-fg-muted lg:mt-3 lg:block">
          {completedSteps}/{STEPS.length} complete
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Setup completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full bg-lime"
          style={{ width: `${completion}%` }}
        />
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-1.5 lg:block lg:space-y-1">
        {STEPS.map((s, i) => {
          const isCurrent = s.key === current;
          const isDone = done[s.key];
          return (
            <li key={s.key}>
              <Link
                href={href(s.key)}
                className={`group flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-center text-[11px] transition-colors lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-left lg:text-xs ${
                  isCurrent
                    ? "bg-lime/10 text-lime"
                    : isDone
                      ? "text-fg hover:bg-surface-2 hover:text-lime"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isDone ? (
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-[10px] font-bold text-on-lime"
                  >
                    ✓
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] ${
                      isCurrent
                        ? "border-lime text-lime"
                        : "border-line text-fg-faint"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
                <span className="truncate">{s.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepHeading({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {blurb && (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-fg-muted">
          {blurb}
        </p>
      )}
    </header>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-line bg-surface-2 p-4 font-mono text-xs leading-relaxed text-fg">
        {code}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton value={code} />
      </div>
    </div>
  );
}

/* ---------- steps ---------- */

function WelcomeStep({ sandbox }: { sandbox: boolean }) {
  const concepts = [
    {
      title: "Domain",
      body: "Prove you own it by publishing two DNS records, so inboxes trust what you send.",
    },
    {
      title: "API key",
      body: "Your app authenticates with a bearer token — created once, kept secret.",
    },
    {
      title: "Send",
      body: "One POST and sendthen queues, signs and delivers the email for you.",
    },
  ];
  return (
    <section>
      <StepHeading
        title="Let's get you sending."
        blurb="Three small things stand between you and your first email. This tour walks through each one — it takes about two minutes, and you can skip any part."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {concepts.map((c) => (
          <Card key={c.title} className="p-4">
            <p className="mb-1.5 text-sm font-medium text-fg">{c.title}</p>
            <p className="text-xs leading-relaxed text-fg-muted">{c.body}</p>
          </Card>
        ))}
      </div>

      <p className="mb-8 max-w-xl text-sm leading-relaxed text-fg-muted">
        {sandbox ? (
          <>
            This instance is in <span className="text-fg">sandbox mode</span>:
            nothing leaves the server. Emails are signed, queued and marked
            delivered without touching the network — perfect for trying the
            whole flow before any DNS work.
          </>
        ) : (
          <>
            Tip: sandbox mode keeps everything on the server — emails are
            signed and queued but never leave the machine. It&apos;s a safe way
            to try the whole flow before any DNS work.
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/onboarding?step=domain" className={btnPrimary}>
          Start setup →
        </Link>
        <form action={completeOnboardingAction}>
          <button name="to" value="/emails" className={btnSecondary}>
            Skip — I&apos;ll explore on my own
          </button>
        </form>
      </div>
    </section>
  );
}

function DomainStep({
  domain,
  verified,
  error,
}: {
  domain: Domain | null;
  verified: boolean;
  error?: string;
}) {
  return (
    <section>
      <StepHeading
        title="Add a sending domain"
        blurb="A verified domain lets sendthen sign your mail with DKIM and pass SPF checks, which is what keeps you out of spam folders. In sandbox mode you can send without one — but real delivery needs it."
      />

      {!domain ? (
        <Card className="p-5">
          {error === "invalid_domain" && (
            <p className="mb-3 text-sm text-danger">
              That doesn&apos;t look like a valid domain name — try something
              like mail.yourdomain.com.
            </p>
          )}
          {error === "taken" && (
            <p className="mb-3 text-sm text-danger">
              That domain is already registered to another team.
            </p>
          )}
          <form
            action={onboardingCreateDomainAction}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              name="name"
              type="text"
              required
              placeholder="mail.yourdomain.com"
              className={inputCls}
              autoFocus
            />
            <button type="submit" className={`${btnPrimary} shrink-0`}>
              Add domain →
            </button>
          </form>
          <p className="mt-3 text-xs text-fg-muted">
            A subdomain like mail.yourdomain.com keeps sending reputation
            separate from your root domain.
          </p>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-fg-muted">
            Publish these records at your DNS provider for{" "}
            <span className="font-mono text-fg">{domain.name}</span>. They can
            take a few minutes to propagate.
          </p>
          <div className="mb-4 space-y-3">
            {dnsRecordsForDomain(
              domain.name,
              domain.dkimSelector,
              domain.dkimPublicKey,
            ).map((r) => {
              const recordOk =
                r.purpose === "dkim" ? domain.dkimVerified : domain.spfVerified;
              return (
              <Card
                key={r.name}
                className={`p-4 ${recordOk ? "border-lime/50 bg-lime/5" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">
                    {r.purpose} · {r.type}
                  </p>
                  {recordOk ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-lime/15 px-2 py-0.5 font-mono text-[11px] text-lime">
                      ✓ verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 font-mono text-[11px] text-warn">
                      ○ waiting
                    </span>
                  )}
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    Host
                  </span>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                    {r.name}
                  </code>
                  <CopyButton value={r.name} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    Value
                  </span>
                  <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1.5 font-mono text-xs text-fg-muted">
                    {r.value}
                  </code>
                  <CopyButton value={r.value} />
                </div>
                {!recordOk && (
                  <p className="mt-2 text-[11px] text-fg-faint">
                    Create a <b>TXT</b> record at your DNS provider — Host goes
                    in the name field, Value in the content field.
                  </p>
                )}
              </Card>
              );
            })}
          </div>
          {verified ? (
            <p className="mb-4 flex items-center gap-2 text-sm text-lime">
              <span aria-hidden>✓</span> Verified — this domain is ready to
              send.
            </p>
          ) : (
            <div className="mb-4">
              <LiveVerify domainId={domain.id} />
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {verified ? (
          <>
            <Link href="/onboarding?step=key" className={btnPrimary}>
              Continue →
            </Link>
          </>
        ) : (
          <Link href="/onboarding?step=key" className={btnSecondary}>
            I&apos;ll add DNS later — continue →
          </Link>
        )}
      </div>
    </section>
  );
}

function KeyStep({ hasApiKey }: { hasApiKey: boolean }) {
  return (
    <section>
      <StepHeading
        title="Create an API key"
        blurb="Keys are bearer tokens your app sends in the Authorization header. Each token is shown exactly once at creation — you can scope or revoke keys later under API Keys."
      />

      {hasApiKey ? (
        <Card className="p-5">
          <p className="mb-4 text-sm text-fg-muted">
            You already have an active key. If you still have its token saved
            you can keep using it — or mint a fresh one for this walkthrough.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <form action={onboardingCreateKeyAction}>
              <input type="hidden" name="name" value="onboarding key" />
              <button type="submit" className={btnSecondary}>
                Create another anyway
              </button>
            </form>
            <Link href="/onboarding?step=send" className={btnPrimary}>
              Continue →
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <form
            action={onboardingCreateKeyAction}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              name="name"
              type="text"
              placeholder="my first key"
              className={inputCls}
              autoFocus
            />
            <button type="submit" className={`${btnPrimary} shrink-0`}>
              Create key →
            </button>
          </form>
          <p className="mt-3 text-xs text-fg-muted">
            The name is just a label so you can tell keys apart later.
          </p>
        </Card>
      )}
    </section>
  );
}

function SendStep({
  token,
  fromAddr,
  toAddr,
  base,
  sandbox,
}: {
  token?: string;
  fromAddr: string;
  toAddr: string;
  base: string;
  sandbox: boolean;
}) {
  const key = token ?? "st_YOUR_KEY";
  const curl = `curl -X POST ${base}/api/v1/emails \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "${fromAddr}",
    "to": "${toAddr}",
    "subject": "Hello from sendthen",
    "html": "<strong>It just sends.</strong>"
  }'`;
  const sdk = `import { SendThen } from "sendthen";

const st = new SendThen("${key}");

await st.emails.send({ from: "${fromAddr}", to: "${toAddr}", subject: "Hello from sendthen", html: "<strong>It just sends.</strong>" });`;

  return (
    <section>
      <StepHeading
        title="Send your first email"
        blurb="Paste this into a terminal and the email lands in your dashboard within seconds."
      />

      {token && (
        <Card className="mb-5 border-lime/40 bg-lime/5 p-4">
          <p className="mb-2 text-sm font-medium text-fg">
            Your API key — copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1.5 font-mono text-xs text-fg">
              {token}
            </code>
            <CopyButton value={token} />
          </div>
        </Card>
      )}

      {!token && (
        <p className="mb-4 text-sm text-fg-muted">
          Swap <span className="font-mono text-fg">st_YOUR_KEY</span> below for
          a real token from the API key step.
        </p>
      )}

      <div className="mb-3">
        <CodeBlock code={curl} />
      </div>
      <p className="mb-6 text-sm text-fg-muted">
        {sandbox
          ? "In sandbox mode this delivers instantly — watch it land under Emails."
          : "Once sent, watch it move through queued → sent → delivered under Emails."}
      </p>

      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-faint">
        Or from code
      </p>
      <div className="mb-8">
        <CodeBlock code={sdk} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <form action={completeOnboardingAction}>
          <button name="to" value="/emails" className={btnPrimary}>
            Finish — go to my inbox →
          </button>
        </form>
        <form action={completeOnboardingAction}>
          <button
            name="to"
            value="/templates/builder"
            className="text-sm text-fg-muted transition-colors hover:text-fg"
          >
            Open the template builder instead
          </button>
        </form>
      </div>
    </section>
  );
}

/* ---------- page ---------- */

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; token?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { step, token, error } = await searchParams;

  const progress = await onboardingProgress(team);
  let domain: Domain | null = null;
  if (progress.domainId) {
    const [row] = await db
      .select()
      .from(domains)
      .where(eq(domains.id, progress.domainId));
    domain = row ?? null;
  }

  const nothingYet =
    !progress.hasDomain && !progress.hasApiKey && !progress.hasSentEmail;
  const auto: StepKey = nothingYet
    ? "welcome"
    : !progress.hasDomain
      ? "domain"
      : !progress.hasApiKey
        ? "key"
        : "send";
  const current: StepKey = isStep(step) ? step : auto;

  const done: Record<StepKey, boolean> = {
    welcome: !nothingYet,
    domain: progress.hasDomain,
    key: progress.hasApiKey,
    send: progress.hasSentEmail,
  };

  const sandbox = mailMode() === "sandbox";
  const base = publicUrl() || "http://localhost:3000";
  const fromAddr = domain ? `hello@${domain.name}` : "hello@yourdomain.com";

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-lg font-medium tracking-tight"
          >
            send<span className="text-lime">then</span>
          </Link>
          <SkipTour />
        </div>

        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
          <Rail current={current} done={done} token={token} />

          <div className="min-w-0 rounded-xl border border-line bg-surface p-5 sm:p-7 lg:p-8">
            {current === "welcome" && <WelcomeStep sandbox={sandbox} />}
            {current === "domain" && (
              <DomainStep
                domain={domain}
                verified={progress.domainVerified}
                error={error}
              />
            )}
            {current === "key" && <KeyStep hasApiKey={progress.hasApiKey} />}
            {current === "send" && (
              <SendStep
                token={token}
                fromAddr={fromAddr}
                toAddr={user.email}
                base={base}
                sandbox={sandbox}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
