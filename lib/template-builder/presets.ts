/**
 * Starter template designs for the template builder.
 * Each preset is a fully-populated TemplateDesign built from defaultBlock()
 * so it always stays in sync with the block contract in ./types.
 *
 * Presets are intentionally colorful and visually distinct — every theme
 * varies the page background, card background, text color, and accent so
 * the preset picker reads as a set of real designs, not four gray boxes.
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
  /** [page background, card background, accent] — used for picker swatches */
  swatch: [string, string, string];
  design: TemplateDesign;
}

const SERIF_STACK = "Georgia, 'Times New Roman', Times, serif";

export const PRESETS: Preset[] = [
  // 1 — Welcome (indigo)
  {
    key: "welcome",
    name: "Welcome",
    description: "Greet new users and point them at the first thing to do.",
    subject: "Welcome to Acme, {{name}}",
    swatch: ["#eef2ff", "#ffffff", "#4f46e5"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#eef2ff",
        contentBackground: "#ffffff",
        textColor: "#1e1b4b",
        accentColor: "#4f46e5",
        onAccentColor: "#ffffff",
      },
      blocks: [
        block("logo"),
        block("heading", { text: "Welcome, {{name}}!", level: 1 }),
        block("text", {
          text: "Thanks for signing up — your account is ready to go. Create your first project, invite a teammate, and you'll see results within a couple of minutes. If you get stuck at any point, just reply to this email; a real person reads every message.",
        }),
        block("button", {
          text: "Set up your first project",
          url: "https://app.example.com/onboarding",
        }),
        block("divider"),
        block("footer", {
          text: "Acme Inc · 500 Howard St, San Francisco, CA 94105",
        }),
      ],
    },
  },

  // 2 — Verification code (dark)
  {
    key: "otp-dark",
    name: "Verification code",
    description: "Dark one-time passcode email for sign-in or verification.",
    subject: "{{code}} is your Acme sign-in code",
    swatch: ["#0a0a0a", "#18181b", "#C6FF00"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#0a0a0a",
        contentBackground: "#18181b",
        textColor: "#fafafa",
        accentColor: "#C6FF00",
        onAccentColor: "#0a0a0a",
      },
      blocks: [
        block("logo", { align: "center" }),
        block("heading", {
          text: "Your sign-in code",
          level: 2,
          align: "center",
        }),
        block("text", {
          text: "Enter this code to finish signing in. It only works once.",
          align: "center",
        }),
        block("code", { text: "{{code}}" }),
        block("text", {
          text: "This code expires in 10 minutes. If you didn't request it, you can safely ignore this email — no one gets in without the code.",
          align: "center",
          fontSize: 13,
          muted: true,
        }),
        block("footer", {
          text: "Acme Inc · 500 Howard St, San Francisco, CA 94105",
        }),
      ],
    },
  },

  // 3 — Receipt (finance green)
  {
    key: "receipt",
    name: "Receipt",
    description: "Payment confirmation with plan, amount, and billing details.",
    subject: "Your Acme receipt — {{invoice_number}}",
    swatch: ["#f0fdf4", "#ffffff", "#16a34a"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#f0fdf4",
        contentBackground: "#ffffff",
        textColor: "#14532d",
        accentColor: "#16a34a",
        onAccentColor: "#ffffff",
      },
      blocks: [
        block("logo"),
        block("heading", { text: "Receipt", level: 1 }),
        block("text", {
          text: "Hi {{name}}, thanks for your payment. It went through and your subscription is active. Here's a summary for your records.",
        }),
        block("columns", {
          leftText: "Plan\nPro monthly",
          rightText: "Amount\n$29.00",
        }),
        block("columns", {
          leftText: "Billing period\n{{period_start}} – {{period_end}}",
          rightText: "Payment method\nVisa ending {{card_last4}}",
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
        block("footer", {
          text: "Acme Inc · 500 Howard St, San Francisco, CA 94105",
        }),
      ],
    },
  },

  // 4 — Newsletter (editorial warm)
  {
    key: "newsletter",
    name: "Newsletter",
    description: "Warm editorial broadcast with a hero image and story teasers.",
    subject: "{{title}} — the Acme monthly",
    swatch: ["#faf7f2", "#ffffff", "#ea580c"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#faf7f2",
        contentBackground: "#ffffff",
        textColor: "#292524",
        accentColor: "#ea580c",
        onAccentColor: "#ffffff",
      },
      blocks: [
        block("logo"),
        block("image", { alt: "Cover image for this issue" }),
        block("heading", { text: "{{title}}", level: 1 }),
        block("text", {
          text: "This month we shipped the two most-requested features on the roadmap, cut page load times in half, and sat down with a customer who runs their entire studio on Acme.",
        }),
        block("text", {
          text: "There's also a small change to how workspaces handle invites — it takes ten seconds to review and will save your team a lot of back-and-forth. The full story, with numbers and screenshots, is on the blog.",
        }),
        block("divider"),
        block("columns", {
          leftText: "Also this month\nA faster editor, dark mode for reports, and CSV export.",
          rightText: "From the community\nHow Studio Norte cut client review time from days to hours.",
        }),
        block("button", {
          text: "Read the full issue",
          url: "https://example.com/blog/monthly",
        }),
        block("social", {
          links: [
            { kind: "website", url: "https://example.com" },
            { kind: "x", url: "https://x.com/acme" },
            { kind: "linkedin", url: "https://linkedin.com/company/acme" },
          ],
        }),
        block("footer", {
          text: "Acme Inc · 500 Howard St, San Francisco, CA 94105\nYou're getting this because you subscribed to the Acme monthly.",
          showUnsubscribe: true,
        }),
      ],
    },
  },

  // 5 — Product launch (black + lime)
  {
    key: "launch",
    name: "Product launch",
    description: "Bold dark announcement for shipping something new.",
    subject: "{{product}} is live",
    swatch: ["#08090A", "#111113", "#C6FF00"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#08090A",
        contentBackground: "#111113",
        textColor: "#f4f5f6",
        accentColor: "#C6FF00",
        onAccentColor: "#0a0a0a",
      },
      blocks: [
        block("logo"),
        block("heading", { text: "It's live.", level: 1 }),
        block("text", {
          text: "{{product}} just shipped. We rebuilt it from the ground up: twice as fast, half the clicks, and it finally works the way you asked for. No migration, no settings to touch — open the app and it's there.",
        }),
        block("button", {
          text: "See what's new",
          url: "https://app.example.com/whats-new",
        }),
        block("divider"),
        block("footer", {
          text: "Acme Inc · 500 Howard St, San Francisco, CA 94105",
        }),
      ],
    },
  },

  // 6 — Event invite (amber)
  {
    key: "event",
    name: "Event invite",
    description: "Invitation with date, location, and an RSVP button.",
    subject: "You're invited: {{event_name}}",
    swatch: ["#fffbeb", "#ffffff", "#d97706"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#fffbeb",
        contentBackground: "#ffffff",
        textColor: "#451a03",
        accentColor: "#d97706",
        onAccentColor: "#ffffff",
      },
      blocks: [
        block("heading", { text: "You're invited", level: 1 }),
        block("text", {
          text: "Hi {{name}}, we're hosting {{event_name}} and we'd love to see you there. Expect a short product demo, a Q&A with the team, and time to talk with other builders over drinks. Seats are limited, so grab yours early.",
        }),
        block("columns", {
          leftText: "Date & time\n{{event_date}}, 6:00–9:00 PM",
          rightText: "Location\nThe Foundry, 620 Folsom St, San Francisco",
        }),
        block("button", { text: "RSVP", url: "https://example.com/events/rsvp" }),
        block("spacer", { height: 16 }),
        block("footer", {
          text: "Acme Inc · 500 Howard St, San Francisco, CA 94105",
        }),
      ],
    },
  },

  // 7 — Password reset (trust blue)
  {
    key: "reset",
    name: "Password reset",
    description: "Short, reassuring password reset with a single clear action.",
    subject: "Reset your Acme password",
    swatch: ["#eff6ff", "#ffffff", "#2563eb"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#eff6ff",
        contentBackground: "#ffffff",
        textColor: "#1e3a5f",
        accentColor: "#2563eb",
        onAccentColor: "#ffffff",
      },
      blocks: [
        block("logo"),
        block("heading", { text: "Reset your password", level: 2 }),
        block("text", {
          text: "Hi {{name}}, someone asked to reset the password for this account. Click the button below to choose a new one.",
        }),
        block("button", {
          text: "Choose a new password",
          url: "https://app.example.com/reset/{{token}}",
        }),
        block("text", {
          text: "This link expires in 30 minutes. If you didn't ask for a reset, you can ignore this email — your password stays the same.",
          fontSize: 13,
          muted: true,
        }),
        block("footer", {
          text: "Acme Inc · 500 Howard St, San Francisco, CA 94105",
        }),
      ],
    },
  },

  // 8 — Feedback request (rose)
  {
    key: "feedback",
    name: "Feedback request",
    description: "Friendly ask for a quick review or survey response.",
    subject: "How did we do, {{name}}?",
    swatch: ["#fff1f2", "#ffffff", "#e11d48"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#fff1f2",
        contentBackground: "#ffffff",
        textColor: "#4c0519",
        accentColor: "#e11d48",
        onAccentColor: "#ffffff",
      },
      blocks: [
        block("heading", { text: "How did we do?", level: 2 }),
        block("text", {
          text: "Hi {{name}}, you've been using Acme for a few weeks now, and we'd love to hear how it's going. What's working? What's clunky? Your answers go straight to the people who build the product — not into a spreadsheet nobody opens.",
        }),
        block("button", {
          text: "Leave feedback (30 seconds)",
          url: "https://example.com/feedback",
        }),
        block("text", {
          text: "Thanks for taking the time — it genuinely shapes what we build next.",
          fontSize: 13,
          muted: true,
        }),
        block("footer", {
          text: "Acme Inc · 500 Howard St, San Francisco, CA 94105",
          showUnsubscribe: true,
        }),
      ],
    },
  },

  // 9 — Minimal letter (typography only)
  {
    key: "minimal",
    name: "Minimal letter",
    description: "Plain serif note that reads like a personal email.",
    subject: "A note from {{sender_name}}",
    swatch: ["#ffffff", "#ffffff", "#111111"],
    design: {
      version: 1,
      styles: {
        ...DEFAULT_STYLES,
        backgroundColor: "#ffffff",
        contentBackground: "#ffffff",
        fontFamily: SERIF_STACK,
        textColor: "#111111",
        accentColor: "#111111",
        onAccentColor: "#ffffff",
      },
      blocks: [
        block("heading", { text: "A quick note", level: 1 }),
        block("text", {
          text: "Hi {{name}}, I wanted to write to you directly rather than send another polished announcement. We've spent the last month listening more than shipping, and it changed our plans for the better.",
          fontSize: 16,
        }),
        block("text", {
          text: "The short version: we're slowing down on new features and speeding up on the rough edges you've told us about. If there's one thing you'd fix first, hit reply and tell me — I read every response myself.",
          fontSize: 16,
        }),
        block("footer", {
          text: "{{sender_name}}, Acme Inc · 500 Howard St, San Francisco, CA 94105",
        }),
      ],
    },
  },
];
