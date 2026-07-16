import type { Block, BlockType, TemplateDesign } from "./types";

export type BlockCatalogGroupId = "content" | "layout" | "advanced";

export interface BlockCatalogItem {
  readonly type: BlockType;
  readonly label: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

export interface BlockCatalogGroup {
  readonly id: BlockCatalogGroupId;
  readonly label: string;
  readonly items: readonly BlockCatalogItem[];
}

export const BLOCK_CATALOG: readonly BlockCatalogGroup[] = [
  {
    id: "content",
    label: "Content",
    items: [
      {
        type: "logo",
        label: "Logo",
        description: "Add a brand name or logo image.",
        keywords: ["brand", "header", "image"],
      },
      {
        type: "heading",
        label: "Heading",
        description: "Introduce a section with a clear title.",
        keywords: ["title", "headline", "h1", "h2"],
      },
      {
        type: "text",
        label: "Text",
        description: "Write paragraphs and personalized copy.",
        keywords: ["body", "paragraph", "copy", "rich text"],
      },
      {
        type: "button",
        label: "Button",
        description: "Add a linked call to action.",
        keywords: ["cta", "link", "action"],
      },
      {
        type: "image",
        label: "Image",
        description: "Show a responsive image or linked visual.",
        keywords: ["photo", "picture", "hero", "media"],
      },
      {
        type: "social",
        label: "Social links",
        description: "Link to social profiles and your website.",
        keywords: ["network", "github", "linkedin", "instagram", "x"],
      },
      {
        type: "footer",
        label: "Footer",
        description: "Add legal details and an unsubscribe link.",
        keywords: ["legal", "address", "unsubscribe", "compliance"],
      },
      {
        type: "code",
        label: "Code",
        description: "Highlight an OTP, coupon, or short code.",
        keywords: ["otp", "verification", "coupon", "monospace"],
      },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    items: [
      {
        type: "divider",
        label: "Divider",
        description: "Separate sections with a horizontal rule.",
        keywords: ["line", "separator", "rule"],
      },
      {
        type: "spacer",
        label: "Spacer",
        description: "Add adjustable vertical space.",
        keywords: ["gap", "padding", "whitespace"],
      },
      {
        type: "columns",
        label: "Columns",
        description: "Create a responsive two column layout.",
        keywords: ["two column", "split", "grid", "side by side"],
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    items: [
      {
        type: "html",
        label: "Custom HTML",
        description: "Insert trusted email HTML directly.",
        keywords: ["raw", "code", "markup", "developer"],
      },
    ],
  },
];

export function searchBlockCatalog(query: string): readonly BlockCatalogGroup[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return BLOCK_CATALOG;

  return BLOCK_CATALOG.flatMap((group) => {
    const items = group.items.filter((item) => {
      const searchable = [
        group.id,
        group.label,
        item.type,
        item.label,
        item.description,
        ...item.keywords,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return terms.every((term) => searchable.includes(term));
    });

    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function hint(value: string, limit = 48): string {
  const readable = value
    .replace(/<\/?[bi]>|<a href="[^"]*">|<\/a>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (readable.length <= limit) return readable;
  return `${readable.slice(0, limit - 1).trimEnd()}…`;
}

function labelWithHint(label: string, value: string): string {
  const readable = hint(value);
  return readable ? `${label} · ${readable}` : label;
}

export function getLayerLabel(block: Block): string {
  switch (block.type) {
    case "logo":
      return labelWithHint("Logo", block.text);
    case "heading":
      return labelWithHint("Heading", block.text);
    case "text":
      return labelWithHint("Text", block.text);
    case "button":
      return labelWithHint("Button", block.text);
    case "image":
      return labelWithHint("Image", block.alt);
    case "divider":
      return "Divider";
    case "spacer":
      return Number.isFinite(block.height)
        ? `Spacer · ${Math.max(0, Math.round(block.height))}px`
        : "Spacer";
    case "columns":
      return labelWithHint("Columns", `${block.leftText} / ${block.rightText}`);
    case "social": {
      const count = block.links.length;
      return count === 0
        ? "Social links"
        : `Social links · ${count} ${count === 1 ? "link" : "links"}`;
    }
    case "footer":
      return labelWithHint("Footer", block.text);
    case "html":
      return "Custom HTML";
    case "code":
      return labelWithHint("Code", block.text);
  }
}

export function reorderBlocks(
  blocks: Block[],
  activeId: string,
  insertionIndex: number,
): Block[];
export function reorderBlocks(
  blocks: readonly Block[],
  activeId: string,
  insertionIndex: number,
): readonly Block[];
export function reorderBlocks(
  blocks: readonly Block[],
  activeId: string,
  insertionIndex: number,
): readonly Block[] {
  const activeIndex = blocks.findIndex((block) => block.id === activeId);
  if (
    activeIndex < 0 ||
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > blocks.length ||
    insertionIndex === activeIndex ||
    insertionIndex === activeIndex + 1
  ) {
    return blocks;
  }

  const reordered = [...blocks];
  const [active] = reordered.splice(activeIndex, 1);
  const destination = insertionIndex > activeIndex ? insertionIndex - 1 : insertionIndex;
  reordered.splice(destination, 0, active);
  return reordered;
}

export type PreflightSeverity = "error" | "warning" | "info";

export type PreflightCode =
  | "subject-empty"
  | "content-empty"
  | "image-alt-missing"
  | "link-empty"
  | "link-invalid"
  | "unsubscribe-missing"
  | "content-width-unsafe";

export interface PreflightFinding {
  readonly id: string;
  readonly code: PreflightCode;
  readonly severity: PreflightSeverity;
  readonly title: string;
  readonly message: string;
  readonly action: string;
  readonly blockId?: string;
}

const VARIABLE_LINK = /^\{\{\s*[\w.]+\s*\}\}$/;

function isVariableLink(value: string): boolean {
  return VARIABLE_LINK.test(value);
}

function isValidLink(value: string): boolean {
  if (isVariableLink(value)) return true;

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return true;
    if (url.protocol === "mailto:" || url.protocol === "tel:") {
      return url.pathname.trim().length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

function isValidImageSource(value: string): boolean {
  if (isVariableLink(value)) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function linkFinding(
  blockId: string,
  value: string,
  label: string,
  key: string,
  optional = false,
): PreflightFinding | undefined {
  const link = value.trim();
  if (!link) {
    if (optional) return undefined;
    return {
      id: `link-empty:${blockId}:${key}`,
      code: "link-empty",
      severity: "error",
      title: `${label} link is empty`,
      message: `${label} will not take readers anywhere.`,
      action: "Add a complete destination URL.",
      blockId,
    };
  }

  if (isValidLink(link)) return undefined;
  return {
    id: `link-invalid:${blockId}:${key}`,
    code: "link-invalid",
    severity: "error",
    title: `${label} link is invalid`,
    message: `“${link}” is not a supported web, email, phone, or variable link.`,
    action: "Use a complete https:// URL or a {{variable}} link.",
    blockId,
  };
}

function imageSourceFinding(
  blockId: string,
  value: string,
): PreflightFinding | undefined {
  const source = value.trim();
  if (!source) {
    return {
      id: `link-empty:${blockId}:source`,
      code: "link-empty",
      severity: "error",
      title: "Image source is empty",
      message: "This image has no source URL and will not appear in the email.",
      action: "Add a complete http:// or https:// image URL, or use a {{variable}}.",
      blockId,
    };
  }

  if (isValidImageSource(source)) return undefined;
  return {
    id: `link-invalid:${blockId}:source`,
    code: "link-invalid",
    severity: "error",
    title: "Image source is invalid",
    message: `“${source}” is not a supported image source.`,
    action: "Use a complete http:// or https:// image URL, or a {{variable}}.",
    blockId,
  };
}

interface RichTextField {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

function richTextFields(block: Block): readonly RichTextField[] {
  switch (block.type) {
    case "heading":
      return [{ key: "text", label: "Heading", value: block.text }];
    case "text":
      return [{ key: "text", label: "Text", value: block.text }];
    case "columns":
      return [
        { key: "leftText", label: "Left column", value: block.leftText },
        { key: "rightText", label: "Right column", value: block.rightText },
      ];
    case "footer":
      return [{ key: "text", label: "Footer", value: block.text }];
    default:
      return [];
  }
}

function embeddedLinkFindings(block: Block): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  for (const field of richTextFields(block)) {
    let index = 0;
    for (const match of field.value.matchAll(/<a href="([^"]*)">/gi)) {
      const issue = linkFinding(
        block.id,
        match[1] ?? "",
        field.label,
        `${field.key}.${index}`,
      );
      if (issue) findings.push(issue);
      index += 1;
    }
  }
  return findings;
}

export function runPreflight(
  subject: string,
  design: TemplateDesign,
): PreflightFinding[] {
  const findings: PreflightFinding[] = [];

  if (!subject.trim()) {
    findings.push({
      id: "subject-empty",
      code: "subject-empty",
      severity: "error",
      title: "Subject is empty",
      message: "Recipients need a subject to understand why the email matters.",
      action: "Write a clear, specific subject line.",
    });
  }

  if (design.blocks.length === 0) {
    findings.push({
      id: "content-empty",
      code: "content-empty",
      severity: "error",
      title: "Email has no content",
      message: "The canvas is empty, so recipients would receive a blank email.",
      action: "Add at least one content block.",
    });
  }

  for (const block of design.blocks) {
    if (block.type === "logo" && block.imageUrl !== "") {
      const sourceIssue = imageSourceFinding(block.id, block.imageUrl);
      if (sourceIssue) findings.push(sourceIssue);
      if (!block.text.trim()) {
        findings.push({
          id: `image-alt-missing:${block.id}`,
          code: "image-alt-missing",
          severity: "warning",
          title: "Logo image needs alt text",
          message: "Readers using assistive technology cannot identify this logo.",
          action: "Add the brand name as the logo image’s alt text.",
          blockId: block.id,
        });
      }
    }

    if (block.type === "image") {
      const sourceIssue = imageSourceFinding(block.id, block.url);
      if (sourceIssue) findings.push(sourceIssue);
      if (block.url.trim() && !block.alt.trim()) {
        findings.push({
          id: `image-alt-missing:${block.id}`,
          code: "image-alt-missing",
          severity: "warning",
          title: "Image needs alt text",
          message: "Readers using assistive technology cannot understand this image.",
          action: "Describe the image’s purpose in a short alt label.",
          blockId: block.id,
        });
      }
      const issue = linkFinding(block.id, block.href, "Image", "href", true);
      if (issue) findings.push(issue);
    }

    if (block.type === "button") {
      const issue = linkFinding(block.id, block.url, "Button", "url");
      if (issue) findings.push(issue);
    }

    if (block.type === "social") {
      block.links.forEach((link, index) => {
        const issue = linkFinding(
          block.id,
          link.url,
          `${link.kind} social`,
          `links.${index}`,
        );
        if (issue) findings.push(issue);
      });
    }

    findings.push(...embeddedLinkFindings(block));
  }

  if (
    !design.blocks.some(
      (block) => block.type === "footer" && block.showUnsubscribe,
    )
  ) {
    findings.push({
      id: "unsubscribe-missing",
      code: "unsubscribe-missing",
      severity: "warning",
      title: "Unsubscribe link is missing",
      message: "Broadcast emails should give every recipient a clear way to opt out.",
      action: "Add a footer block with unsubscribe enabled.",
    });
  }

  const width = design.styles.contentWidth;
  if (!Number.isFinite(width) || width < 320 || width > 800) {
    findings.push({
      id: "content-width-unsafe",
      code: "content-width-unsafe",
      severity: "warning",
      title: "Content width is unsafe",
      message: "Email content should stay within the supported 320–800px range.",
      action: "Set content width between 320px and 800px.",
    });
  }

  return findings;
}
