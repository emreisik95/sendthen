"use client";

import { useState, type ReactNode } from "react";
import { Card, PageHeader, btnPrimary, inputCls } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { SES_REGIONS, type SettingsFormProps, type SecretState } from "./props";

type MailMode = SettingsFormProps["initial"]["mailMode"];

const INSTANCE_DEFAULT_COPY: Record<SettingsFormProps["instanceMode"], string> = {
  sandbox:
    "Emails are captured on the server and marked delivered — nothing is actually sent. Great for testing.",
  smtp: "Emails are relayed through the SMTP server configured by the instance operator.",
  ses: "Emails are sent through the Amazon SES account configured by the instance operator.",
  direct: "Emails are delivered directly to each recipient's mail server.",
};

const MODE_CARDS: { value: MailMode; title: string; subtitle: string }[] = [
  {
    value: "inherit",
    title: "Instance default",
    subtitle: "Use this server's built-in delivery",
  },
  {
    value: "sandbox",
    title: "Sandbox",
    subtitle: "Capture emails locally, nothing leaves the server",
  },
  {
    value: "smtp",
    title: "SMTP",
    subtitle: "Relay through any SMTP provider",
  },
  {
    value: "ses",
    title: "Amazon SES",
    subtitle: "Send with your own AWS SES account",
  },
];

function RadioCard({
  value,
  title,
  subtitle,
  selected,
  onSelect,
}: {
  value: MailMode;
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: (value: MailMode) => void;
}) {
  return (
    <label
      className={`block cursor-pointer rounded-[10px] border px-4 py-3 transition-colors focus-within:border-lime ${
        selected
          ? "border-lime bg-lime/[0.06]"
          : "border-line bg-surface hover:bg-surface-2"
      }`}
    >
      <input
        type="radio"
        name="mailModePicker"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span className={`block text-sm font-medium ${selected ? "text-lime" : "text-fg"}`}>
        {title}
      </span>
      <span className="mt-0.5 block text-xs text-fg-muted">{subtitle}</span>
    </label>
  );
}

function InfoPanel({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn";
  children: ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-warn/30 bg-warn/[0.07] text-warn"
      : "border-info/30 bg-info/[0.07] text-info";
  return (
    <div className={`rounded-md border px-3 py-2.5 text-xs leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

function SecretInput({
  id,
  label,
  name,
  clearName,
  stored,
  placeholder,
}: {
  id: string;
  label: string;
  name: string;
  clearName: string;
  stored: SecretState | null;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm text-fg">
        {label}
      </label>
      {stored?.set ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-fg-muted">
            Configured · <span className="font-mono">{stored.hint}</span> — enter a
            new value below to replace it.
          </p>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-danger">
            <input
              type="checkbox"
              name={clearName}
              className="accent-[#EF4444]"
            />
            clear
          </label>
        </div>
      ) : null}
      <input
        id={id}
        type="password"
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}

export function SettingsForm(props: SettingsFormProps) {
  const [mode, setMode] = useState<string>(props.initial.mailMode);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <p className="-mt-4 mb-6 text-sm text-fg-muted">
        Transport and tracking for the {props.teamName} team.
      </p>

      {props.saved ? (
        <Card className="mb-6 border-lime/40 bg-lime/[0.06] px-4 py-3 text-sm text-lime">
          Settings saved.
        </Card>
      ) : null}

      <form action={props.action} className="space-y-6">
        <input type="hidden" name="mailMode" value={mode} />

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-fg">Email delivery</h2>
          <p className="mt-1 text-xs text-fg-muted">
            Choose how this team's emails leave the building.
          </p>

          <fieldset className="mt-4">
            <legend className="sr-only">Email delivery mode</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODE_CARDS.map((card) => (
                <RadioCard
                  key={card.value}
                  value={card.value}
                  title={card.title}
                  subtitle={card.subtitle}
                  selected={mode === card.value}
                  onSelect={setMode}
                />
              ))}
            </div>
          </fieldset>

          {mode === "inherit" ? (
            <div className="mt-4">
              <InfoPanel>{INSTANCE_DEFAULT_COPY[props.instanceMode]}</InfoPanel>
            </div>
          ) : null}

          {mode === "sandbox" ? (
            <div className="mt-4">
              <InfoPanel>
                Emails are captured and stored for inspection — nothing is sent to
                real recipients. Perfect for development and demos.
              </InfoPanel>
            </div>
          ) : null}

          {mode === "smtp" ? (
            <div className="mt-5 space-y-3 border-t border-line pt-5">
              <SecretInput
                id="smtp-url"
                label="SMTP URL"
                name="smtpUrl"
                clearName="smtpUrlClear"
                stored={props.initial.smtpUrl}
                placeholder="smtp://username:password@smtp.provider.com:587"
              />
              <p className="text-xs text-fg-faint">
                Format: smtp://user:pass@host:port (use smtps:// for implicit TLS).
                The URL is stored encrypted and never shown again.
              </p>
            </div>
          ) : null}

          {mode === "ses" ? (
            <div className="mt-5 space-y-4 border-t border-line pt-5">
              <div className="space-y-1.5">
                <label htmlFor="ses-region" className="block text-sm text-fg">
                  Region
                </label>
                <select
                  id="ses-region"
                  name="sesRegion"
                  defaultValue={props.initial.sesRegion || "eu-west-1"}
                  className={inputCls}
                >
                  {SES_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ses-access-key" className="block text-sm text-fg">
                  Access key ID
                </label>
                <input
                  id="ses-access-key"
                  type="text"
                  name="sesAccessKeyId"
                  autoComplete="off"
                  defaultValue={props.initial.sesAccessKeyId}
                  placeholder="AKIA…"
                  className={inputCls}
                />
              </div>

              <SecretInput
                id="ses-secret-key"
                label="Secret access key"
                name="sesSecretAccessKey"
                clearName="sesSecretAccessKeyClear"
                stored={props.initial.sesSecret}
                placeholder="Your AWS secret access key"
              />

              <InfoPanel>
                The IAM user only needs the{" "}
                <code className="font-mono">ses:SendRawEmail</code> permission.
              </InfoPanel>

              {props.feedbackUrl ? (
                <div className="rounded-md border border-line bg-surface-2 px-3 py-3">
                  <h3 className="text-xs font-semibold text-fg">
                    Bounce &amp; complaint feedback
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto rounded border border-line bg-bg px-2 py-1.5 font-mono text-xs text-fg-muted">
                      {props.feedbackUrl}
                    </code>
                    <CopyButton value={props.feedbackUrl} />
                  </div>
                  <p className="mt-2 text-xs text-fg-muted">
                    Point an SNS topic (bounces + complaints) at this URL and hard
                    bounces will automatically populate your suppression list.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-fg">Tracking</h2>
          <p className="mt-1 text-xs text-fg-muted">
            Measure engagement on the emails you send.
          </p>

          {!props.trackingReady ? (
            <div className="mt-4">
              <InfoPanel tone="warn">
                Link and open tracking isn't available yet because this instance
                doesn't know its public address.
                {props.isAdmin
                  ? " As the instance admin, set the public URL in your deployment configuration to enable it."
                  : null}
              </InfoPanel>
            </div>
          ) : null}

          {/* disabled checkboxes don't submit; keep stored prefs intact */}
          {!props.trackingReady && props.initial.trackOpens ? (
            <input type="hidden" name="trackOpens" value="on" />
          ) : null}
          {!props.trackingReady && props.initial.trackClicks ? (
            <input type="hidden" name="trackClicks" value="on" />
          ) : null}

          <div className="mt-4 space-y-3">
            <label
              htmlFor="track-opens"
              className={`flex items-start gap-2.5 text-sm ${
                props.trackingReady ? "cursor-pointer text-fg" : "text-fg-faint"
              }`}
            >
              <input
                id="track-opens"
                type="checkbox"
                name="trackOpens"
                defaultChecked={props.initial.trackOpens}
                disabled={!props.trackingReady}
                className="mt-0.5 accent-[#C6FF00]"
              />
              <span>
                Track opens
                <span className="block text-xs text-fg-muted">
                  Adds an invisible pixel to HTML emails
                </span>
              </span>
            </label>

            <label
              htmlFor="track-clicks"
              className={`flex items-start gap-2.5 text-sm ${
                props.trackingReady ? "cursor-pointer text-fg" : "text-fg-faint"
              }`}
            >
              <input
                id="track-clicks"
                type="checkbox"
                name="trackClicks"
                defaultChecked={props.initial.trackClicks}
                disabled={!props.trackingReady}
                className="mt-0.5 accent-[#C6FF00]"
              />
              <span>
                Track clicks
                <span className="block text-xs text-fg-muted">
                  Routes links through this server before redirecting
                </span>
              </span>
            </label>
          </div>
        </Card>

        <div className="flex justify-end">
          <button type="submit" className={btnPrimary}>
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
