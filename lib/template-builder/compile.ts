/**
 * Email-safe HTML compiler for TemplateDesign documents.
 *
 * Output rules (deliberately old-school — this is what renders everywhere):
 * - table-based layout only, role="presentation", cellpadding/cellspacing/border 0
 * - every style inline; the only <style> block is a tiny mobile media query
 * - no flexbox, no grid, no external resources beyond user-provided images
 */

import type {
  Align,
  Block,
  ButtonBlock,
  CodeBlock,
  ColumnsBlock,
  FooterBlock,
  GlobalStyles,
  HeadingBlock,
  ImageBlock,
  LogoBlock,
  SocialBlock,
  SocialKind,
  TemplateDesign,
  TextBlock,
} from "./types";

/* ------------------------------------------------------------------ */
/* escaping helpers                                                    */
/* ------------------------------------------------------------------ */

/** Escape text content: & < > (quotes left alone — not needed in text nodes). */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape a value going into a double-quoted HTML attribute. */
function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Whitelist-based rich text: escape everything, then re-allow exactly
 * <b>, <i> and <a href="..."> (the escaped forms are pattern-matched back
 * into real tags). {{variables}} contain no escaped characters, so they
 * pass through untouched. Newlines become <br/>.
 */
function richText(raw: string, linkColor: string): string {
  let s = esc(raw);
  s = s.replace(/&lt;(\/?)b&gt;/gi, "<$1b>");
  s = s.replace(/&lt;(\/?)i&gt;/gi, "<$1i>");
  // esc() leaves quotes alone, so the escaped form is `&lt;a href="URL"&gt;`.
  // URL content has been through esc() (no raw < > &) and the match excludes
  // quotes, so it is safe to drop back into a double-quoted attribute as-is.
  // Function replacer: `$` sequences in linkColor (e.g. "$&") would be
  // treated as replacement patterns in a string replacement and could
  // reinsert raw matched text (with live quotes) into the attribute.
  s = s.replace(
    /&lt;a href="([^"]*)"&gt;/gi,
    (_m, href: string) =>
      `<a href="${href}" style="color:${escAttr(linkColor)};text-decoration:underline;">`,
  );
  s = s.replace(/&lt;\/a&gt;/gi, "</a>");
  return s.replace(/\r?\n/g, "<br/>");
}

/** Strip the simple inline tags for the plain-text part. */
function plainText(raw: string): string {
  return raw
    .replace(/<a href="((?:(?!").)*)">((?:(?!<\/a>).)*)<\/a>/gi, "$2 ($1)")
    .replace(/<\/?[bi]>/gi, "");
}

function clampNum(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Designs arrive via JSON.parse, so `align` is not guaranteed to be the
 * Align union at runtime. Whitelist it before interpolating into
 * attributes / style values.
 */
function alignVal(a: Align): Align {
  return a === "center" || a === "right" ? a : "left";
}

/* ------------------------------------------------------------------ */
/* block renderers — each returns a full <tr> for the content table    */
/* ------------------------------------------------------------------ */

const ROW_PAD = "padding:6px 0;";

function row(inner: string, tdStyle = ROW_PAD, align?: Align): string {
  const alignAttr = align ? ` align="${alignVal(align)}"` : "";
  return `<tr><td${alignAttr} style="${tdStyle}">${inner}</td></tr>`;
}

function renderLogo(b: LogoBlock, g: GlobalStyles): string {
  const inner = b.imageUrl
    ? `<img src="${escAttr(b.imageUrl)}" alt="${escAttr(b.text)}" height="32" style="height:32px;border:0;display:inline-block;"/>`
    : `<span style="font-weight:700;font-size:20px;color:${escAttr(g.textColor)};">${esc(b.text)}</span>`;
  return row(inner, ROW_PAD, b.align);
}

function renderHeading(b: HeadingBlock, g: GlobalStyles): string {
  const tag = b.level === 1 ? "h1" : "h2";
  const size = b.level === 1 ? 26 : 20;
  const weight = b.level === 1 ? 700 : 600;
  const inner =
    `<${tag} style="margin:0 0 12px;font-size:${size}px;font-weight:${weight};line-height:1.3;` +
    `color:${escAttr(g.textColor)};text-align:${alignVal(b.align)};">${richText(b.text, g.accentColor)}</${tag}>`;
  return row(inner);
}

function renderText(b: TextBlock, g: GlobalStyles): string {
  const size = clampNum(b.fontSize, 10, 32, 15);
  const color = b.muted ? "#6b7280" : g.textColor;
  const inner =
    `<p style="margin:0;font-size:${size}px;line-height:1.6;color:${escAttr(color)};` +
    `text-align:${alignVal(b.align)};">${richText(b.text, g.accentColor)}</p>`;
  return row(inner);
}

function renderButton(b: ButtonBlock, g: GlobalStyles): string {
  const display = b.fullWidth
    ? "display:block;text-align:center;"
    : "display:inline-block;";
  const inner =
    `<a href="${escAttr(b.url)}" style="${display}background-color:${escAttr(g.accentColor)};` +
    `color:${escAttr(g.onAccentColor)};padding:12px 24px;border-radius:6px;` +
    `font-weight:500;font-size:15px;line-height:1;text-decoration:none;">${esc(b.text)}</a>`;
  return row(inner, ROW_PAD, b.align);
}

function renderImage(b: ImageBlock, g: GlobalStyles): string {
  if (!b.url) return "";
  const pct = clampNum(b.width, 10, 100, 100);
  const px = Math.round((g.contentWidth * pct) / 100);
  const img =
    `<img src="${escAttr(b.url)}" alt="${escAttr(b.alt)}" width="${px}" ` +
    `style="width:${px}px;max-width:100%;height:auto;border:0;border-radius:6px;display:inline-block;"/>`;
  const inner = b.href
    ? `<a href="${escAttr(b.href)}" style="text-decoration:none;">${img}</a>`
    : img;
  return row(inner, ROW_PAD, b.align);
}

function renderDivider(): string {
  const line =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
    `<tr><td style="border-top:1px solid #e4e4e7;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  return row(line, "padding:24px 0;");
}

function renderSpacer(height: number): string {
  const h = clampNum(height, 0, 400, 24);
  return `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

function renderColumns(b: ColumnsBlock, g: GlobalStyles): string {
  const cell = (text: string, side: "left" | "right"): string => {
    const gutter = side === "left" ? "padding-right:8px;" : "padding-left:8px;";
    return (
      `<td class="stack" width="50%" style="width:50%;vertical-align:top;${gutter}` +
      `font-size:15px;line-height:1.6;color:${escAttr(g.textColor)};">` +
      `${richText(text, g.accentColor)}</td>`
    );
  };
  const inner =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
    `<tr>${cell(b.leftText, "left")}${cell(b.rightText, "right")}</tr></table>`;
  return row(inner);
}

const SOCIAL_LABELS: Record<SocialKind, string> = {
  x: "X",
  github: "GitHub",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  website: "Website",
};

function renderSocial(b: SocialBlock): string {
  const links = b.links.filter((l) => l.url);
  if (links.length === 0) return "";
  const inner = links
    .map(
      (l) =>
        `<a href="${escAttr(l.url)}" style="color:#6b7280;text-decoration:underline;">` +
        `${SOCIAL_LABELS[l.kind]}</a>`,
    )
    .join(`<span style="color:#6b7280;">&nbsp;&middot;&nbsp;</span>`);
  return row(
    `<span style="font-size:13px;color:#6b7280;">${inner}</span>`,
    ROW_PAD,
    b.align,
  );
}

function renderFooter(b: FooterBlock, g: GlobalStyles): string {
  const base = "margin:0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:left;";
  let inner = `<p style="${base}">${richText(b.text, g.accentColor)}</p>`;
  if (b.showUnsubscribe) {
    inner +=
      `<p style="${base}margin-top:4px;">` +
      `<a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></p>`;
  }
  return row(inner);
}

function renderCode(b: CodeBlock, g: GlobalStyles): string {
  const inner =
    `<span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace;` +
    `font-size:28px;letter-spacing:6px;font-weight:700;padding:16px;background-color:#f4f4f5;` +
    `border-radius:8px;color:${escAttr(g.textColor)};">${esc(b.text)}</span>`;
  return row(inner, ROW_PAD, b.align);
}

function renderBlock(block: Block, g: GlobalStyles): string {
  switch (block.type) {
    case "logo":
      return renderLogo(block, g);
    case "heading":
      return renderHeading(block, g);
    case "text":
      return renderText(block, g);
    case "button":
      return renderButton(block, g);
    case "image":
      return renderImage(block, g);
    case "divider":
      return renderDivider();
    case "spacer":
      return renderSpacer(block.height);
    case "columns":
      return renderColumns(block, g);
    case "social":
      return renderSocial(block);
    case "footer":
      return renderFooter(block, g);
    case "html":
      return row(block.html); // passthrough — trusted user content
    case "code":
      return renderCode(block, g);
  }
}

/* ------------------------------------------------------------------ */
/* document assembly                                                   */
/* ------------------------------------------------------------------ */

export function compileDesign(design: TemplateDesign): string {
  const width = clampNum(design.styles.contentWidth, 320, 800, 600);
  // Normalize contentWidth before block renderers use it (renderImage
  // derives pixel widths from it — raw values could be NaN or exceed
  // the clamped container width).
  const g: GlobalStyles = { ...design.styles, contentWidth: width };
  const rows = design.blocks.map((b) => renderBlock(b, g)).filter(Boolean).join("\n");

  return [
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="utf-8"/>`,
    `<meta name="viewport" content="width=device-width, initial-scale=1"/>`,
    `<meta name="x-apple-disable-message-reformatting"/>`,
    // Declare dark-mode awareness so clients (Apple Mail, iCloud) honour the
    // inline colors instead of blindly inverting them — that inversion is what
    // turned the light card muddy grey in dark mode.
    `<meta name="color-scheme" content="light dark"/>`,
    `<meta name="supported-color-schemes" content="light dark"/>`,
    `<title></title>`,
    `<style>:root{color-scheme:light dark;supported-color-schemes:light dark}@media (max-width:640px){ .container{width:100%!important} .stack{display:block!important;width:100%!important} }</style>`,
    `</head>`,
    `<body style="margin:0;padding:0;background-color:${escAttr(g.backgroundColor)};">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${escAttr(g.backgroundColor)};">`,
    `<tr><td align="center" style="padding:24px 12px;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${width}" class="container" style="width:${width}px;max-width:100%;background-color:${escAttr(g.contentBackground)};border-radius:8px;">`,
    `<tr><td style="padding:40px 32px;font-family:${escAttr(g.fontFamily)};">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`,
    rows,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</body>`,
    `</html>`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* plain-text part                                                     */
/* ------------------------------------------------------------------ */

export function designToText(design: TemplateDesign): string {
  const parts: string[] = [];
  for (const block of design.blocks) {
    switch (block.type) {
      case "heading":
        parts.push(plainText(block.text));
        break;
      case "text":
        parts.push(plainText(block.text));
        break;
      case "button":
        parts.push(`${plainText(block.text)}: ${block.url}`);
        break;
      case "columns":
        parts.push(`${plainText(block.leftText)}\n${plainText(block.rightText)}`);
        break;
      case "divider":
        parts.push("----------");
        break;
      case "footer": {
        let t = plainText(block.text);
        if (block.showUnsubscribe) t += "\nUnsubscribe: {{unsubscribe_url}}";
        parts.push(t);
        break;
      }
      case "code":
        parts.push(block.text);
        break;
      default:
        break; // logo, image, spacer, social, html: no plain-text equivalent
    }
  }
  return parts.filter((p) => p.trim().length > 0).join("\n\n");
}
