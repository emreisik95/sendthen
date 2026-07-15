import Link from "next/link";
import {
  comparisonCaveat,
  comparisonDate,
  comparisonMethodology,
  comparisonProducts,
  comparisonRows,
  featureGroups,
  landingCopy,
  operationsNote,
  outcomePillars,
  primaryNavigation,
  proofStages,
  quickstartLines,
} from "@/lib/marketing";

const GITHUB_URL = "https://github.com/emreisik95/sendthen";

const API_REQUEST = `POST /api/v1/emails HTTP/1.1
Authorization: Bearer st_••••••••
Content-Type: application/json
Idempotency-Key: export-ready-42

{
  "from": "Acme <updates@acme.test>",
  "to": "ada@example.net",
  "subject": "Your export is ready",
  "html": "<p>Your export is ready to download.</p>",
  "tags": { "flow": "export" }
}`;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "sendthen",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: "https://sendthen.net",
  sameAs: [GITHUB_URL],
  license: "https://opensource.org/license/mit",
  description:
    "Own your email stack with an open-source, self-hosted email control plane and your choice of delivery transport.",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1 rounded-[0.65rem] border border-transparent px-[1.1rem] py-3 text-center text-sm font-bold leading-tight no-underline transition-[background-color,border-color,box-shadow,color,transform] duration-150 motion-safe:hover:-translate-y-px";
const BUTTON_PRIMARY = `${BUTTON_BASE} bg-lime text-on-lime shadow-[0_10px_34px_rgba(198,255,0,0.13)] hover:bg-lime-hover hover:text-on-lime hover:shadow-[0_14px_42px_rgba(198,255,0,0.2)]`;
const BUTTON_SECONDARY = `${BUTTON_BASE} border-white/20 bg-white/[0.035] text-fg hover:border-lime/50 hover:bg-lime/[0.055]`;
const KICKER =
  "font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-lime";
const SECTION_TITLE =
  "mt-3 max-w-[13ch] text-balance text-[clamp(2.25rem,5vw,4.35rem)] font-bold leading-[1.02] tracking-[-0.055em]";
const SECTION_COPY = "text-base leading-7 text-[var(--landing-text-secondary)]";
const CONSOLE_LABEL =
  "flex items-center justify-between gap-3 px-4 py-3 font-mono text-[0.75rem] uppercase tracking-[0.12em] text-[var(--landing-text-tertiary)]";
const PROJECT_FACTS = ["MIT licensed", "One container", "SQLite-backed"] as const;
const PRODUCT_SPANS = [
  "md:col-span-7",
  "md:col-span-5",
  "md:col-span-5",
  "md:col-span-7",
] as const;

export default function Landing() {
  return (
    <div className="landing-shell relative isolate min-w-0 overflow-x-clip bg-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <a className="landing-skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="landing-header sticky top-0 z-50 border-b border-hairline">
        <nav
          className="landing-container flex min-h-[4.25rem] min-w-0 flex-wrap items-center gap-x-2 gap-y-0 py-2 sm:gap-x-4 lg:flex-nowrap lg:py-0"
          aria-label="Primary"
        >
          <Link
            className="inline-flex shrink-0 items-center font-mono text-[1.05rem] font-semibold leading-none tracking-[-0.04em] text-fg no-underline"
            href="/"
            aria-label="sendthen home"
          >
            send<span className="text-lime">then</span>
          </Link>

          <div className="ml-auto hidden min-w-0 items-center gap-0.5 lg:flex">
            {primaryNavigation.map((item) => (
              <a
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-[0.82rem] font-medium text-[var(--landing-text-secondary)] no-underline transition-colors hover:text-fg"
                key={item.label}
                href={item.href}
                target={item.href.startsWith("https://") ? "_blank" : undefined}
                rel={
                  item.href.startsWith("https://")
                    ? "noopener noreferrer"
                    : undefined
                }
              >
                {item.label}
                {item.href.startsWith("https://") ? (
                  <>
                    <span aria-hidden> ↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </>
                ) : null}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link
              className="inline-flex min-h-11 items-center rounded-lg px-2 text-[0.82rem] font-medium text-[var(--landing-text-secondary)] no-underline transition-colors hover:text-fg sm:px-3"
              href="/login"
            >
              Sign in
            </Link>
            <Link className={`${BUTTON_PRIMARY} min-h-10 px-4 py-2 text-[0.8rem]`} href="#self-host">
              Self-host
            </Link>
          </div>

          <ul
            className="flex basis-full items-center gap-0.5 overflow-x-auto border-t border-white/10 pt-1 lg:hidden"
            aria-label="Primary links"
          >
            {primaryNavigation.map((item) => (
              <li className="shrink-0" key={item.label}>
                <a
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-[0.82rem] font-medium text-[var(--landing-text-secondary)] no-underline transition-colors hover:text-fg"
                  href={item.href}
                  target={
                    item.href.startsWith("https://") ? "_blank" : undefined
                  }
                  rel={
                    item.href.startsWith("https://")
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  {item.label}
                  {item.href.startsWith("https://") ? (
                    <>
                      <span aria-hidden> ↗</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section
          className="landing-hero relative py-[clamp(4rem,8vw,7.5rem)]"
          aria-labelledby="hero-heading"
        >
          <div className="landing-container relative z-10 grid min-w-0 items-center gap-[clamp(2.75rem,6vw,6.5rem)] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
            <div className="min-w-0">
              <p className={`${KICKER} landing-reveal`}>
                <span className="text-[var(--landing-text-tertiary)]" aria-hidden>
                  {"01 / "}
                </span>
                {landingCopy.eyebrow}
              </p>
              <h1
                id="hero-heading"
                className="landing-reveal mt-4 max-w-[12ch] text-balance text-[clamp(2.85rem,10vw,5.7rem)] font-bold leading-[0.96] tracking-[-0.065em] lg:max-w-[10.5ch] lg:text-[clamp(3.2rem,6.4vw,5.7rem)]"
              >
                {landingCopy.headline}
              </h1>
              <p className="landing-reveal mt-7 max-w-[39rem] text-[clamp(1rem,1.6vw,1.16rem)] leading-[1.72] text-[var(--landing-text-secondary)]">
                {landingCopy.description}
              </p>
              <div className="landing-reveal mt-8 flex flex-wrap items-center gap-3">
                <Link className={`${BUTTON_PRIMARY} min-h-12 max-sm:flex-1`} href={landingCopy.primaryCta.href}>
                  {landingCopy.primaryCta.label}
                  <span aria-hidden> →</span>
                </Link>
                <Link className={`${BUTTON_SECONDARY} min-h-12 max-sm:flex-1`} href={landingCopy.secondaryCta.href}>
                  {landingCopy.secondaryCta.label}
                </Link>
              </div>
              <ul className="landing-reveal mt-5 flex flex-wrap gap-2" aria-label="Project facts">
                {PROJECT_FACTS.map((fact) => (
                  <li
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 font-mono text-[0.75rem] text-[var(--landing-text-secondary)]"
                    key={fact}
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-lime shadow-[0_0_12px_rgba(198,255,0,0.55)]" aria-hidden />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>

            <figure className="landing-proof landing-reveal min-w-0 overflow-hidden rounded-3xl border border-white/15">
              <figcaption className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 px-4 font-mono text-[0.75rem] text-[var(--landing-text-secondary)]">
                <span className="flex items-center gap-1.5" aria-hidden>
                  <i className="size-2 rounded-full bg-[var(--landing-text-tertiary)]" />
                  <i className="size-2 rounded-full bg-[var(--landing-text-tertiary)] opacity-60" />
                  <i className="size-2 rounded-full bg-[var(--landing-text-tertiary)] opacity-40" />
                </span>
                <span className="max-sm:hidden">delivery proof / live path</span>
                <span className="text-lime">
                  <span aria-hidden>● </span>ready
                </span>
              </figcaption>

              <section
                className="min-w-0 border-b border-white/10"
                aria-labelledby="api-request-label"
              >
                <div className={CONSOLE_LABEL}>
                  <span id="api-request-label">request.http</span>
                  <span>application/json</span>
                </div>
                <pre className="m-0 max-h-[18.25rem] max-w-full overflow-x-auto px-4 pb-5 font-mono text-[clamp(0.75rem,1.2vw,0.8rem)] leading-[1.72] text-[#dce3e8]">
                  <code>{API_REQUEST}</code>
                </pre>
              </section>

              <div className="px-4 pb-3">
                <p className={CONSOLE_LABEL}>
                  <span>message path</span>
                  <span>owned control plane</span>
                </p>
                <ol className="py-1">
                  {proofStages.map((stage, index) => (
                    <li
                      className="landing-pipeline-step relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 py-2 max-sm:grid-cols-[1.75rem_minmax(0,1fr)]"
                      key={stage.key}
                    >
                      <span className="relative z-10 inline-flex size-8 items-center justify-center rounded-lg border border-lime/35 bg-[#0d100c] font-mono text-[0.75rem] text-lime max-sm:size-7" aria-hidden>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <strong className="block text-[0.78rem] font-semibold text-fg">
                          {stage.label}
                        </strong>
                        <span className="block [overflow-wrap:anywhere] font-mono text-[0.75rem] leading-relaxed text-[var(--landing-text-tertiary)]">
                          {stage.detail}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-lime/20 bg-lime/[0.055] px-4 py-3 max-md:flex-col max-md:items-start max-md:gap-1">
                <span className="font-mono text-[0.75rem] uppercase tracking-[0.1em] text-[var(--landing-text-tertiary)]">
                  example SMTP outcome
                </span>
                <strong className="text-end font-mono text-[0.75rem] font-semibold text-lime max-md:text-start">
                  <span aria-hidden>250 · </span>accepted by receiving server
                </strong>
              </div>
            </figure>
          </div>
        </section>

        <section className="py-[var(--landing-section-space)]" aria-labelledby="outcomes-heading">
          <div className="landing-container">
            <div className="grid items-end gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(18rem,0.72fr)] md:gap-[clamp(1.5rem,5vw,6rem)]">
              <div>
                <p className={KICKER}>Operating model</p>
                <h2 id="outcomes-heading" className={SECTION_TITLE}>
                  Ownership where it matters.
                </h2>
              </div>
              <p className={SECTION_COPY}>
                Keep the application surface your team needs while retaining a
                clear boundary between the control plane, the transport, and the
                infrastructure you operate.
              </p>
            </div>

            <div className="mt-[clamp(2.5rem,5vw,4.5rem)] grid divide-y divide-white/10 border-y border-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
              {outcomePillars.map((pillar, index) => (
                <article className="min-w-0 p-[clamp(1.6rem,3vw,2.5rem)]" key={pillar.key}>
                  <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--landing-text-tertiary)]" aria-hidden>
                    0{index + 1}
                  </p>
                  <h3 className="mt-6 text-[clamp(1.2rem,2vw,1.55rem)] font-semibold leading-tight tracking-[-0.025em]">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-[0.91rem] leading-[1.7] text-[var(--landing-text-secondary)]">
                    {pillar.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="product"
          className="landing-product-section scroll-mt-24 border-y border-hairline py-[var(--landing-section-space)]"
          aria-labelledby="product-heading"
        >
          <div className="landing-container">
            <div className="grid items-end gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(18rem,0.72fr)] md:gap-[clamp(1.5rem,5vw,6rem)]">
              <div>
                <p className={KICKER}>Product surfaces</p>
                <h2 id="product-heading" className={SECTION_TITLE}>
                  The whole email loop, in one system.
                </h2>
              </div>
              <p className={SECTION_COPY}>
                Transactional and broadcast sending, inbound workflows, and
                reusable visual templates share the same control plane and
                operational context.
              </p>
            </div>

            <div className="mt-[clamp(2.5rem,6vw,5rem)] grid min-w-0 grid-cols-1 gap-4 md:grid-cols-12">
              {featureGroups.map((group, index) => (
                <article
                  className={`landing-product-card ${PRODUCT_SPANS[index]} flex min-h-96 min-w-0 flex-col overflow-hidden rounded-[1.125rem] border border-white/10 p-[clamp(1.5rem,3vw,2.25rem)] max-md:min-h-0`}
                  key={group.key}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--landing-text-tertiary)]">
                      Surface 0{index + 1}
                    </p>
                    <span className="font-mono text-lg text-lime" aria-hidden>
                      +
                    </span>
                  </div>
                  <h3 className="mt-6 text-[clamp(1.2rem,2vw,1.55rem)] font-semibold leading-tight tracking-[-0.025em]">
                    {group.title}
                  </h3>
                  <p className="mt-3 max-w-[38rem] text-[0.91rem] leading-[1.7] text-[var(--landing-text-secondary)]">
                    {group.description}
                  </p>
                  <ul className="mt-auto pt-8 max-md:mt-0">
                    {group.capabilities.map((capability) => (
                      <li className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 border-t border-white/10 py-3 text-[0.83rem] leading-relaxed text-[var(--landing-text-secondary)]" key={capability}>
                        <span className="font-mono text-lime" aria-hidden>
                          →
                        </span>
                        <span>{capability}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="compare"
          className="landing-compare-section scroll-mt-24 py-[var(--landing-section-space)]"
          aria-labelledby="compare-heading"
        >
          <div className="landing-container">
            <div className="grid items-end gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(18rem,0.72fr)] md:gap-[clamp(1.5rem,5vw,6rem)]">
              <div>
                <p className={KICKER}>
                  Architecture comparison · checked{" "}
                  <time dateTime={comparisonDate}>{comparisonDate}</time>
                </p>
                <h2 id="compare-heading" className={SECTION_TITLE}>
                  Compare the ownership boundary.
                </h2>
              </div>
              <p className={SECTION_COPY}>
                This compares operating models, transport boundaries, testing,
                and state portability. It is not a feature-completeness or
                deliverability ranking.
              </p>
            </div>

            <div className="landing-compare-panel mt-[clamp(2.5rem,5vw,4.5rem)] min-w-0 overflow-hidden rounded-[1.125rem] border border-white/10 bg-[var(--landing-panel-solid)]">
              <div className="landing-table-scroll" role="region" aria-label="Email platform architecture comparison" tabIndex={0}>
                <table>
                  <caption className="sr-only">
                    Architecture comparison of Sendthen, Resend, Postmark,
                    SendGrid, and Mailgun, checked {comparisonDate}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Architecture property</th>
                      {comparisonProducts.map((product) => (
                        <th className={product.key === "sendthen" ? "landing-compare-sendthen" : undefined} key={product.key} scope="col">
                          <span>{product.name}</span>
                          {product.key === "sendthen" ? <small>this project</small> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.key}>
                        <th scope="row">{row.label}</th>
                        {comparisonProducts.map((product) => (
                          <td className={product.key === "sendthen" ? "landing-compare-sendthen" : undefined} key={product.key}>
                            {row.values[product.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-px border-t border-white/10 bg-white/10 md:grid-cols-2">
                <p className="bg-[var(--landing-panel-raised)] p-4 text-[0.76rem] leading-relaxed text-fg">
                  {comparisonCaveat}
                </p>
                <p className="bg-[var(--landing-panel-raised)] p-4 text-[0.76rem] leading-relaxed text-[var(--landing-text-secondary)]">
                  {comparisonMethodology}
                </p>
              </div>
            </div>

            <section className="mt-8" aria-labelledby="sources-heading">
              <h3 id="sources-heading" className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--landing-text-secondary)]">
                Official sources
              </h3>
              <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
                {comparisonProducts.map((product) => (
                  <article className="min-w-0 border-t border-white/10 pt-4" key={product.key}>
                    <h4 className="text-[0.84rem] font-semibold">{product.name}</h4>
                    <ul className="mt-2 space-y-2">
                      {product.sources.map((source) => (
                        <li key={source.url}>
                          <a className="inline-block [overflow-wrap:anywhere] text-[0.75rem] leading-normal text-[var(--landing-text-secondary)] underline decoration-white/35 underline-offset-4 hover:text-lime" href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.label}
                            <span aria-hidden> ↗</span>
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section id="self-host" className="scroll-mt-24 py-[var(--landing-section-space)]" aria-labelledby="self-host-heading">
          <div className="landing-container">
            <div className="grid min-w-0 items-center gap-[clamp(2.5rem,7vw,7rem)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <div>
                <p className={KICKER}>Three-line quickstart</p>
                <h2 id="self-host-heading" className={`${SECTION_TITLE} max-w-[13ch] lg:max-w-[10ch]`}>
                  Run the control plane yourself.
                </h2>
                <p className={`${SECTION_COPY} mt-6 max-w-[34rem]`}>
                  Clone the MIT-licensed repository, start the container, and
                  open the local setup flow. Your deployment and transport
                  remain explicit choices.
                </p>
              </div>

              <div className="landing-quickstart min-w-0 overflow-hidden rounded-[1.125rem] border border-white/15 bg-[var(--landing-panel-solid)]">
                <div className={`${CONSOLE_LABEL} border-b border-white/10`}>
                  <span>terminal</span>
                  <span>quickstart</span>
                </div>
                <pre className="m-0 max-w-full overflow-x-auto p-[clamp(1.25rem,3vw,2rem)] font-mono text-[clamp(0.75rem,1.3vw,0.83rem)] leading-[1.72] text-lime">
                  <code>{quickstartLines.join("\n")}</code>
                </pre>
                <aside className="border-t border-white/10 bg-white/[0.025] px-[clamp(1.25rem,3vw,2rem)] py-4" aria-label="Operations note">
                  <strong className="font-mono text-[0.75rem] uppercase tracking-[0.1em] text-fg">
                    Operations note
                  </strong>
                  <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--landing-text-secondary)]">
                    {operationsNote}
                  </p>
                </aside>
              </div>
            </div>

            <div className="mt-[clamp(3rem,7vw,6rem)] grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <article className="landing-choice-primary min-w-0 rounded-[1.125rem] border border-lime/35 p-[clamp(1.5rem,4vw,2.5rem)]">
                <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--landing-text-tertiary)]">
                  Choice 01 · primary
                </p>
                <h3 className="mt-6 text-[clamp(1.2rem,2vw,1.55rem)] font-semibold leading-tight tracking-[-0.025em]">
                  Self-host Sendthen
                </h3>
                <p className="mt-3 max-w-[36rem] text-[0.9rem] leading-[1.7] text-[var(--landing-text-secondary)]">
                  Operate the control plane and portable <code className="font-mono text-lime">/data</code> volume on infrastructure you choose, then select the transport that fits your system.
                </p>
                <a className={`${BUTTON_PRIMARY} mt-7 min-h-12`} href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  Get the MIT source
                  <span aria-hidden> ↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </article>

              <article className="min-w-0 rounded-[1.125rem] border border-white/10 bg-white/[0.025] p-[clamp(1.5rem,4vw,2.5rem)]">
                <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--landing-text-tertiary)]">
                  Choice 02 · secondary
                </p>
                <h3 className="mt-6 text-[clamp(1.2rem,2vw,1.55rem)] font-semibold leading-tight tracking-[-0.025em]">
                  Use the hosted service
                </h3>
                <p className="mt-3 max-w-[36rem] text-[0.9rem] leading-[1.7] text-[var(--landing-text-secondary)]">
                  Use Sendthen without operating the deployment yourself. The
                  hosted path stays a separate, optional choice.
                </p>
                <Link className={`${BUTTON_SECONDARY} mt-7 min-h-12`} href={landingCopy.secondaryCta.href}>
                  {landingCopy.secondaryCta.label}
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="pb-[var(--landing-section-space)]" aria-labelledby="final-cta-heading">
          <div className="landing-container">
            <div className="landing-final-panel overflow-hidden rounded-3xl border border-lime/25 p-[clamp(2rem,7vw,5.5rem)]">
              <p className={KICKER}>Your stack, your boundary</p>
              <h2 id="final-cta-heading" className={`${SECTION_TITLE} max-w-[16ch]`}>
                Own the control plane. Choose the route out.
              </h2>
              <p className={`${SECTION_COPY} mt-5 max-w-[42rem]`}>
                Start with one container, keep the application state portable,
                and decide how each message leaves your system.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link className={`${BUTTON_PRIMARY} min-h-12 max-sm:flex-1`} href={landingCopy.primaryCta.href}>
                  {landingCopy.primaryCta.label}
                  <span aria-hidden> →</span>
                </Link>
                <Link className={`${BUTTON_SECONDARY} min-h-12 max-sm:flex-1`} href="/docs">
                  Read the docs
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="landing-container flex min-h-28 flex-col items-start justify-center gap-5 py-6 text-[0.76rem] text-[var(--landing-text-tertiary)] md:flex-row md:items-center md:justify-between md:gap-8">
          <p className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center font-mono text-[0.9rem] font-semibold tracking-[-0.04em] text-fg">
              send<span className="text-lime">then</span>
            </span>
            <span>MIT-licensed email control plane.</span>
          </p>
          <nav className="flex flex-wrap items-center gap-4" aria-label="Footer">
            <a className="text-[var(--landing-text-secondary)] no-underline transition-colors hover:text-fg" href="#product">Product</a>
            <a className="text-[var(--landing-text-secondary)] no-underline transition-colors hover:text-fg" href="#compare">Compare</a>
            <Link className="text-[var(--landing-text-secondary)] no-underline transition-colors hover:text-fg" href="/docs">Docs</Link>
            <a className="text-[var(--landing-text-secondary)] no-underline transition-colors hover:text-fg" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
