export interface MarketingCta {
  label: string;
  href: string;
}

export interface MarketingNavigationItem {
  label: string;
  href: string;
}

export interface SocialPreviewImage {
  url: string;
  alt: string;
}

export type ProofStageKey =
  | "request"
  | "queue"
  | "dkim"
  | "transport"
  | "events";

export interface ProofStage {
  key: ProofStageKey;
  label: string;
  detail: string;
}

export interface OutcomePillar {
  key: "controlPlane" | "transportFreedom" | "fullEmailLoop";
  title: string;
  description: string;
}

export interface FeatureGroup {
  key:
    | "transactionalSending"
    | "campaignsAndContacts"
    | "inboundMail"
    | "visualTemplates";
  title: string;
  description: string;
  capabilities: readonly string[];
}

export type ComparisonProductKey =
  | "sendthen"
  | "resend"
  | "postmark"
  | "sendGrid"
  | "mailgun";

export interface ComparisonSource {
  label: string;
  url: string;
}

export interface ComparisonProduct {
  key: ComparisonProductKey;
  name: string;
  sources: readonly ComparisonSource[];
}

export type ComparisonRowKey =
  | "selfHost"
  | "openSource"
  | "transportChoice"
  | "localSandbox"
  | "portableState"
  | "softwareUsageFee";

export interface ComparisonRow {
  key: ComparisonRowKey;
  label: string;
  values: Readonly<Record<ComparisonProductKey, string>>;
}

export const landingCtaPaths = {
  primary: "#self-host",
  secondary: "/signup",
} as const;

export const socialPreviewImage = {
  url: "/og.png",
  alt: "sendthen — Own your email stack.",
} as const satisfies SocialPreviewImage;

export const primaryNavigation = [
  { label: "Product", href: "#product" },
  { label: "Compare", href: "#compare" },
  { label: "Docs", href: "/docs" },
  { label: "GitHub", href: "https://github.com/emreisik95/sendthen" },
] as const satisfies readonly MarketingNavigationItem[];

export const proofStages = [
  {
    key: "request",
    label: "API request",
    detail: "POST /api/v1/emails · request validated",
  },
  {
    key: "queue",
    label: "SQLite queue",
    detail: "message persisted · retry policy attached",
  },
  {
    key: "dkim",
    label: "2048-bit DKIM",
    detail: "signed for the verified sending domain",
  },
  {
    key: "transport",
    label: "Selected transport",
    detail: "SES, SMTP relay, direct MX, or local sandbox",
  },
  {
    key: "events",
    label: "Events & webhooks",
    detail: "lifecycle event stored · signed webhook queued",
  },
] as const satisfies readonly ProofStage[];

export const quickstartLines = [
  "git clone https://github.com/emreisik95/sendthen && cd sendthen",
  "docker compose up -d",
  "# open http://localhost:3000",
] as const satisfies readonly string[];

export const operationsNote =
  "You are responsible for hosting and operating the infrastructure. Transport or delivery-provider costs still apply when a provider is selected." as const;

export const landingCopy = {
  eyebrow: "MIT-licensed email control plane",
  headline: "Own your email stack. Keep the developer experience.",
  description:
    "Run transactional sending, campaigns, inbound mail, templates, events, and webhooks on infrastructure you control. Choose how mail leaves your system without tying the application to one delivery provider.",
  primaryCta: {
    label: "Self-host Sendthen",
    href: landingCtaPaths.primary,
  },
  secondaryCta: {
    label: "Try the hosted service",
    href: landingCtaPaths.secondary,
  },
} as const satisfies {
  eyebrow: string;
  headline: string;
  description: string;
  primaryCta: MarketingCta;
  secondaryCta: MarketingCta;
};

export const outcomePillars = [
  {
    key: "controlPlane",
    title: "Own the control plane",
    description:
      "Keep message history, templates, contacts, configuration, and the application itself in an MIT-licensed instance you operate.",
  },
  {
    key: "transportFreedom",
    title: "Keep transport freedom",
    description:
      "Choose Amazon SES, an SMTP relay, direct MX delivery, or local sandbox capture without changing the API your product calls.",
  },
  {
    key: "fullEmailLoop",
    title: "Operate the full email loop",
    description:
      "Send transactional mail and campaigns, receive replies, edit templates, and route lifecycle events from one control plane.",
  },
] as const satisfies readonly OutcomePillar[];

export const featureGroups = [
  {
    key: "transactionalSending",
    title: "Transactional sending",
    description:
      "A sending API backed by the queue, signing, tracking, and event machinery your application needs.",
    capabilities: [
      "Single, batch, and scheduled sends through the REST API",
      "Attachments, tags, idempotency keys, and stored-template sends",
      "DKIM signing, queue retries, lifecycle events, and signed webhooks",
    ],
  },
  {
    key: "campaignsAndContacts",
    title: "Campaigns and contacts",
    description:
      "Keep the audience data and campaign workflow alongside transactional mail.",
    capabilities: [
      "Audiences with contact records and per-contact variables",
      "Personalized broadcast fan-out to subscribed contacts",
      "RFC 8058 one-click unsubscribe and suppression skipping",
    ],
  },
  {
    key: "inboundMail",
    title: "Inbound mail",
    description:
      "Receive and work with mail for domains connected to your instance.",
    capabilities: [
      "Built-in SMTP listener for registered domains",
      "Amazon SES/SNS and raw-MIME HTTP ingestion",
      "Dashboard inbox with stored messages and one-click forwarding",
    ],
  },
  {
    key: "visualTemplates",
    title: "Visual templates",
    description:
      "Build reusable messages visually while retaining editable source data.",
    capabilities: [
      "Reusable subject, HTML, and text templates with variables",
      "Visual builder with composable blocks and starter presets",
      "Re-editable designs compiled to table-based email HTML",
    ],
  },
] as const satisfies readonly FeatureGroup[];

export const comparisonDate = "2026-07-13" as const;

export const comparisonProducts = [
  {
    key: "sendthen",
    name: "Sendthen",
    sources: [
      {
        label: "Sendthen source and self-hosting documentation",
        url: "https://github.com/emreisik95/sendthen",
      },
    ],
  },
  {
    key: "resend",
    name: "Resend",
    sources: [
      {
        label: "Resend email API documentation",
        url: "https://resend.com/docs/api-reference/emails/send-email",
      },
      {
        label: "Resend service plans",
        url: "https://resend.com/pricing",
      },
      {
        label: "Resend test-address documentation",
        url: "https://resend.com/docs/knowledge-base/what-email-addresses-to-use-for-testing",
      },
    ],
  },
  {
    key: "postmark",
    name: "Postmark",
    sources: [
      {
        label: "Postmark developer documentation",
        url: "https://postmarkapp.com/developer/",
      },
      {
        label: "Postmark server sandbox documentation",
        url: "https://postmarkapp.com/developer/user-guide/sandbox-mode/server-sandbox-mode",
      },
      {
        label: "Postmark service plans",
        url: "https://postmarkapp.com/pricing",
      },
    ],
  },
  {
    key: "sendGrid",
    name: "SendGrid",
    sources: [
      {
        label: "SendGrid Mail Send API documentation",
        url: "https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send",
      },
      {
        label: "SendGrid sandbox mode documentation",
        url: "https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sandbox-mode",
      },
      {
        label: "SendGrid service plans",
        url: "https://www.twilio.com/en-us/products/email-api/pricing",
      },
    ],
  },
  {
    key: "mailgun",
    name: "Mailgun",
    sources: [
      {
        label: "Mailgun sending documentation",
        url: "https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http",
      },
      {
        label: "Mailgun test mode documentation",
        url: "https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/test-mode",
      },
      {
        label: "Mailgun service plans",
        url: "https://www.mailgun.com/pricing/",
      },
    ],
  },
] as const satisfies readonly ComparisonProduct[];

const managedServiceValues = {
  resend: "Managed service",
  postmark: "Managed service",
  sendGrid: "Managed service",
  mailgun: "Managed service",
} as const;

export const comparisonRows = [
  {
    key: "selfHost",
    label: "Run the control plane yourself",
    values: {
      sendthen: "Yes — self-hosted",
      ...managedServiceValues,
    },
  },
  {
    key: "openSource",
    label: "Control-plane source",
    values: {
      sendthen: "MIT source",
      ...managedServiceValues,
    },
  },
  {
    key: "transportChoice",
    label: "Underlying delivery transport",
    values: {
      sendthen: "SES, SMTP, direct MX, or sandbox",
      resend: "Provider-managed delivery",
      postmark: "Provider-managed delivery",
      sendGrid: "Provider-managed delivery",
      mailgun: "Provider-managed delivery",
    },
  },
  {
    key: "localSandbox",
    label: "Non-delivery testing",
    values: {
      sendthen: "Local .eml capture",
      resend: "Managed test addresses",
      postmark: "Managed sandbox server",
      sendGrid: "Managed request validation",
      mailgun: "Managed test mode",
    },
  },
  {
    key: "portableState",
    label: "Application state",
    values: {
      sendthen: "Portable /data volume",
      resend: "Provider-managed state",
      postmark: "Provider-managed state",
      sendGrid: "Provider-managed state",
      mailgun: "Provider-managed state",
    },
  },
  {
    key: "softwareUsageFee",
    label: "Self-hosted software usage fee",
    values: {
      sendthen: "None when self-hosted",
      resend: "Managed service plan",
      postmark: "Managed service plan",
      sendGrid: "Managed service plan",
      mailgun: "Managed service plan",
    },
  },
] as const satisfies readonly ComparisonRow[];

export const comparisonCaveat =
  "Self-hosting removes Sendthen software usage fees. Infrastructure and delivery-provider charges still apply." as const;

export const comparisonMethodology =
  "Managed-service cells describe publicly documented offerings checked 2026-07-13; they do not claim that undocumented or private options cannot exist." as const;

export const forbiddenMarketingClaims = [
  "inbox confirmed",
  "better deliverability",
  "zero vendors",
  "unlimited everything",
  "drop-in replacement",
] as const;
