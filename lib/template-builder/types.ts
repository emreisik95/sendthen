/**
 * Template builder design document — the single contract shared by the
 * editor UI, the presets, and the email-safe HTML compiler.
 * Stored as JSON in templates.design so templates stay re-editable.
 */

export interface GlobalStyles {
  /** page background behind the email card */
  backgroundColor: string;
  /** the email card itself */
  contentBackground: string;
  /** px, typically 600 */
  contentWidth: number;
  fontFamily: string;
  textColor: string;
  /** buttons / links default */
  accentColor: string;
  /** text color on accent fills */
  onAccentColor: string;
}

export type Align = "left" | "center" | "right";

export interface LogoBlock {
  id: string;
  type: "logo";
  text: string;
  imageUrl: string;
  align: Align;
}

export interface HeadingBlock {
  id: string;
  type: "heading";
  text: string;
  level: 1 | 2;
  align: Align;
}

export interface TextBlock {
  id: string;
  type: "text";
  /** plain text; supports {{variables}} and simple <b>/<i>/<a> inline tags */
  text: string;
  align: Align;
  fontSize: number;
  muted: boolean;
}

export interface ButtonBlock {
  id: string;
  type: "button";
  text: string;
  url: string;
  align: Align;
  fullWidth: boolean;
}

export interface ImageBlock {
  id: string;
  type: "image";
  url: string;
  alt: string;
  /** percent of content width, 10–100 */
  width: number;
  align: Align;
  href: string;
}

export interface DividerBlock {
  id: string;
  type: "divider";
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  /** px */
  height: number;
}

export interface ColumnsBlock {
  id: string;
  type: "columns";
  leftText: string;
  rightText: string;
}

export type SocialKind = "x" | "github" | "linkedin" | "instagram" | "website";

export interface SocialBlock {
  id: string;
  type: "social";
  links: { kind: SocialKind; url: string }[];
  align: Align;
}

export interface FooterBlock {
  id: string;
  type: "footer";
  text: string;
  /** renders an {{unsubscribe_url}} link — required for broadcasts */
  showUnsubscribe: boolean;
}

export interface HtmlBlock {
  id: string;
  type: "html";
  html: string;
}

export interface CodeBlock {
  id: string;
  type: "code";
  /** monospace block, e.g. OTP codes */
  text: string;
  align: Align;
}

export type Block =
  | LogoBlock
  | HeadingBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | SocialBlock
  | FooterBlock
  | HtmlBlock
  | CodeBlock;

export type BlockType = Block["type"];

export interface TemplateDesign {
  version: 1;
  styles: GlobalStyles;
  blocks: Block[];
}

export const DEFAULT_STYLES: GlobalStyles = {
  backgroundColor: "#f4f4f5",
  contentBackground: "#ffffff",
  contentWidth: 600,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  textColor: "#18181b",
  accentColor: "#18181b",
  onAccentColor: "#ffffff",
};

let counter = 0;
export function newBlockId(): string {
  counter += 1;
  return `blk_${Date.now().toString(36)}_${counter}`;
}

/** Factory with sensible defaults for every block type. */
export function defaultBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "logo":
      return { id, type, text: "acme", imageUrl: "", align: "left" };
    case "heading":
      return { id, type, text: "Heading", level: 1, align: "left" };
    case "text":
      return {
        id,
        type,
        text: "Write something helpful here. You can use {{variables}}.",
        align: "left",
        fontSize: 15,
        muted: false,
      };
    case "button":
      return {
        id,
        type,
        text: "Get started",
        url: "https://",
        align: "left",
        fullWidth: false,
      };
    case "image":
      return { id, type, url: "", alt: "", width: 100, align: "center", href: "" };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, height: 24 };
    case "columns":
      return { id, type, leftText: "Left column", rightText: "Right column" };
    case "social":
      return {
        id,
        type,
        links: [{ kind: "website", url: "https://" }],
        align: "left",
      };
    case "footer":
      return {
        id,
        type,
        text: "Acme Inc · 123 Street, City",
        // On by default — every non-transactional email should offer a way out.
        // Turn it off explicitly for transactional templates (receipts, OTPs).
        showUnsubscribe: true,
      };
    case "html":
      return { id, type, html: "<!-- raw html -->" };
    case "code":
      return { id, type, text: "123456", align: "center" };
  }
}
