/**
 * Starter template designs for the template builder.
 * Each preset is a fully-populated TemplateDesign built from defaultBlock()
 * so it always stays in sync with the block contract in ./types.
 */

import {
  DEFAULT_STYLES,
  defaultBlock,
  type Block,
  type BlockType,
  type TemplateDesign,
} from "./types";

/** Typed spread-and-override on top of defaultBlock(). */
function block<T extends BlockType>(
  type: T,
  overrides: Partial<Extract<Block, { type: T }>> = {}
): Extract<Block, { type: T }> {
  return { ...(defaultBlock(type) as Extract<Block, { type: T }>), ...overrides };
}

export interface Preset {
  key: string;
  name: string;
  description: string;
  subject: string;
  design: TemplateDesign;
}

export const PRESETS: Preset[] = [
  {
    key: "welcome",
    name: "Welcome",
    description: "Greet new users and point them at the first thing to do.",
    subject: "Welcome to Acme, {{name}}",
    design: {
      version: 1,
      styles: { ...DEFAULT_STYLES },
      blocks: [
        block("logo"),
        block("heading", { text: "Welcome, {{name}}!", level: 1 }),
        block("text", {
          text: "Thanks for signing up. Your account is ready. Create your first project, invite a teammate, and you'll see results in a couple of minutes. If you get stuck, just reply to this email — a real person reads every message.",
        }),
        block("button", {
          text: "Get started",
          url: "https://app.example.com/onboarding",
        }),
        block("divider"),
        block("footer"),
      ],
    },
  },
  {
    key: "otp",
    name: "Verification code",
    description: "One-time passcode for sign-in or email verification.",
    subject: "{{code}} is your verification code",
    design: {
      version: 1,
      styles: { ...DEFAULT_STYLES },
      blocks: [
        block("logo", { align: "center" }),
        block("heading", {
          text: "Your verification code",
          level: 2,
          align: "center",
        }),
        block("text", {
          text: "Enter this code to finish signing in. If you didn't request it, you can safely ignore this email.",
          align: "center",
        }),
        block("code", { text: "{{code}}" }),
        block("text", {
          text: "This code expires in 10 minutes.",
          align: "center",
          fontSize: 13,
          muted: true,
        }),
        block("footer"),
      ],
    },
  },
  {
    key: "receipt",
    name: "Receipt",
    description: "Payment confirmation with plan and amount details.",
    subject: "Your Acme receipt — {{invoice_number}}",
    design: {
      version: 1,
      styles: { ...DEFAULT_STYLES },
      blocks: [
        block("logo"),
        block("heading", { text: "Receipt", level: 1 }),
        block("text", {
          text: "Hi {{name}}, thanks for your purchase. Your payment went through and your subscription is active. Here's a summary for your records.",
        }),
        block("columns", {
          leftText: "Plan\nPro monthly",
          rightText: "Amount\n$29.00",
        }),
        block("divider"),
        block("text", {
          text: "This charge will appear on your statement as ACME INC. Need a copy for accounting or want to change your billing details? Everything lives in your billing settings.",
          fontSize: 13,
          muted: true,
        }),
        block("button", {
          text: "View invoice",
          url: "https://app.example.com/billing/invoices",
        }),
        block("footer"),
      ],
    },
  },
  {
    key: "newsletter",
    name: "Newsletter",
    description: "Broadcast layout with a hero image, story, and socials.",
    subject: "{{title}}",
    design: {
      version: 1,
      styles: { ...DEFAULT_STYLES },
      blocks: [
        block("logo"),
        block("image", { alt: "Cover image" }),
        block("heading", { text: "{{title}}", level: 1 }),
        block("text", {
          text: "This month we shipped the two most-requested features on the roadmap, cut page load times in half, and sat down with a customer who runs their whole studio on Acme. The full story — with numbers and screenshots — is on the blog.",
        }),
        block("button", {
          text: "Read more",
          url: "https://example.com/blog",
        }),
        block("divider"),
        block("social", {
          links: [
            { kind: "website", url: "https://example.com" },
            { kind: "x", url: "https://x.com/acme" },
          ],
        }),
        block("footer", {
          text: "Acme Inc · 123 Street, City\nYou're getting this because you subscribed to our newsletter.",
          showUnsubscribe: true,
        }),
      ],
    },
  },
];
