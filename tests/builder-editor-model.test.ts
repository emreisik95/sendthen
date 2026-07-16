import { describe, expect, it } from "vitest";
import {
  BLOCK_CATALOG,
  getLayerLabel,
  reorderBlocks,
  runPreflight,
  searchBlockCatalog,
} from "@/lib/template-builder/editor-model";
import {
  DEFAULT_STYLES,
  type Block,
  type TemplateDesign,
} from "@/lib/template-builder/types";

function design(
  blocks: TemplateDesign["blocks"],
  contentWidth = DEFAULT_STYLES.contentWidth,
): TemplateDesign {
  return {
    version: 1,
    styles: { ...DEFAULT_STYLES, contentWidth },
    blocks,
  };
}

describe("template builder editor model", () => {
  describe("block catalog", () => {
    it("groups every block type and searches all useful metadata", () => {
      const catalogTypes = BLOCK_CATALOG.flatMap((group) =>
        group.items.map((item) => item.type),
      );

      expect(catalogTypes).toEqual([
        "logo",
        "heading",
        "text",
        "button",
        "image",
        "social",
        "footer",
        "code",
        "divider",
        "spacer",
        "columns",
        "html",
      ]);
      expect(
        searchBlockCatalog("  CTA ").flatMap((group) =>
          group.items.map((item) => item.type),
        ),
      ).toEqual(["button"]);
      expect(
        searchBlockCatalog("two column").flatMap((group) =>
          group.items.map((item) => item.type),
        ),
      ).toEqual(["columns"]);
      expect(
        searchBlockCatalog("layout").flatMap((group) =>
          group.items.map((item) => item.type),
        ),
      ).toEqual(["divider", "spacer", "columns"]);
      expect(searchBlockCatalog("not-a-real-block")).toEqual([]);
    });
  });

  describe("layer labels", () => {
    it("combines a friendly block name with a readable content hint", () => {
      const heading: Block = {
        id: "heading-1",
        type: "heading",
        text: "  Quarterly\n   update  ",
        level: 1,
        align: "left",
      };
      const image: Block = {
        id: "image-1",
        type: "image",
        url: "",
        alt: "   ",
        width: 100,
        align: "center",
        href: "",
      };
      const spacer: Block = { id: "spacer-1", type: "spacer", height: 32 };

      expect(getLayerLabel(heading)).toBe("Heading · Quarterly update");
      expect(getLayerLabel(image)).toBe("Image");
      expect(getLayerLabel(spacer)).toBe("Spacer · 32px");
    });

    it("strips supported rich tags without swallowing comparison text", () => {
      const text: Block = {
        id: "comparison-text",
        type: "text",
        text:
          'Use <b>x</b> < 10 and <i>y</i> > 2 — <a href="https://example.com">learn more</a>',
        align: "left",
        fontSize: 15,
        muted: false,
      };

      expect(getLayerLabel(text)).toBe(
        "Text · Use x < 10 and y > 2 — learn more",
      );
    });
  });

  describe("block reordering", () => {
    it("moves by insertion boundary without mutating the input", () => {
      const first: Block = {
        id: "first",
        type: "heading",
        text: "First",
        level: 1,
        align: "left",
      };
      const second: Block = {
        id: "second",
        type: "text",
        text: "Second",
        align: "left",
        fontSize: 15,
        muted: false,
      };
      const third: Block = { id: "third", type: "divider" };
      const blocks: readonly Block[] = Object.freeze([first, second, third]);

      const reordered = reorderBlocks(blocks, "first", blocks.length);

      expect(reordered.map((block) => block.id)).toEqual([
        "second",
        "third",
        "first",
      ]);
      expect(reordered).not.toBe(blocks);
      expect(reordered[2]).toBe(first);
      expect(blocks.map((block) => block.id)).toEqual([
        "first",
        "second",
        "third",
      ]);
    });

    it("treats the insertion boundary immediately after a block as a no-op", () => {
      const blocks: readonly Block[] = Object.freeze([
        { id: "first", type: "divider" },
        { id: "second", type: "divider" },
        { id: "third", type: "divider" },
      ]);

      expect(reorderBlocks(blocks, "second", 2)).toBe(blocks);
    });
  });

  describe("preflight", () => {
    it("returns actionable document findings for an unsafe empty design", () => {
      const findings = runPreflight("  ", design([], 960));

      expect(findings.map((finding) => finding.code)).toEqual([
        "subject-empty",
        "content-empty",
        "unsubscribe-missing",
        "content-width-unsafe",
      ]);
      expect(findings.find((finding) => finding.code === "subject-empty")?.severity).toBe(
        "error",
      );
      expect(findings.find((finding) => finding.code === "content-empty")?.severity).toBe(
        "error",
      );
      expect(
        findings.find((finding) => finding.code === "content-width-unsafe")?.message,
      ).toContain("320–800px");
      for (const finding of findings) {
        expect(finding.title.trim()).not.toBe("");
        expect(finding.message.trim()).not.toBe("");
        expect(finding.action.trim()).not.toBe("");
        expect(["error", "warning", "info"]).toContain(finding.severity);
      }
    });

    it("targets blocks with missing alt text and empty or invalid links", () => {
      const image: Block = {
        id: "hero-image",
        type: "image",
        url: "https://cdn.example.com/hero.png",
        alt: " ",
        width: 100,
        align: "center",
        href: "javascript:alert(1)",
      };
      const button: Block = {
        id: "primary-cta",
        type: "button",
        text: "Read more",
        url: "https://",
        align: "left",
        fullWidth: false,
      };
      const social: Block = {
        id: "social-links",
        type: "social",
        links: [{ kind: "github", url: "" }],
        align: "left",
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      const findings = runPreflight(
        "A useful subject",
        design([image, button, social, footer]),
      );

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "image-alt-missing",
            blockId: "hero-image",
          }),
          expect.objectContaining({
            code: "link-invalid",
            blockId: "hero-image",
          }),
          expect.objectContaining({
            code: "link-invalid",
            blockId: "primary-cta",
          }),
          expect.objectContaining({
            code: "link-empty",
            blockId: "social-links",
          }),
        ]),
      );
      expect(findings.every((finding) => finding.blockId)).toBe(true);
    });

    it("reports an empty image source without requiring a destination link", () => {
      const image: Block = {
        id: "empty-image",
        type: "image",
        url: "",
        alt: "",
        width: 100,
        align: "center",
        href: "",
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      expect(runPreflight("A useful subject", design([image, footer]))).toEqual([
        expect.objectContaining({
          id: "link-empty:empty-image:source",
          code: "link-empty",
          title: "Image source is empty",
          message: "This image has no source URL and will not appear in the email.",
          action: "Add a complete http:// or https:// image URL, or use a {{variable}}.",
          blockId: "empty-image",
        }),
      ]);
    });

    it("reports an invalid image source without requiring a destination link", () => {
      const image: Block = {
        id: "broken-image",
        type: "image",
        url: "not-a-valid-url",
        alt: "Product dashboard",
        width: 100,
        align: "center",
        href: "",
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      expect(runPreflight("A useful subject", design([image, footer]))).toEqual([
        expect.objectContaining({
          id: "link-invalid:broken-image:source",
          code: "link-invalid",
          title: "Image source is invalid",
          message: "“not-a-valid-url” is not a supported image source.",
          action: "Use a complete http:// or https:// image URL, or a {{variable}}.",
          blockId: "broken-image",
        }),
      ]);
    });

    it("rejects mail and phone protocols only when used as image sources", () => {
      const mailImage: Block = {
        id: "mail-image",
        type: "image",
        url: "mailto:support@example.com",
        alt: "Support",
        width: 100,
        align: "center",
        href: "mailto:support@example.com",
      };
      const phoneImage: Block = {
        id: "phone-image",
        type: "image",
        url: "tel:+15550123",
        alt: "Call support",
        width: 100,
        align: "center",
        href: "tel:+15550123",
      };
      const button: Block = {
        id: "email-button",
        type: "button",
        text: "Email support",
        url: "mailto:support@example.com",
        align: "left",
        fullWidth: false,
      };
      const social: Block = {
        id: "phone-link",
        type: "social",
        links: [{ kind: "website", url: "tel:+15550123" }],
        align: "left",
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      expect(
        runPreflight(
          "Contact support",
          design([mailImage, phoneImage, button, social, footer]),
        ),
      ).toEqual([
        expect.objectContaining({
          id: "link-invalid:mail-image:source",
          code: "link-invalid",
          title: "Image source is invalid",
          blockId: "mail-image",
        }),
        expect.objectContaining({
          id: "link-invalid:phone-image:source",
          code: "link-invalid",
          title: "Image source is invalid",
          blockId: "phone-image",
        }),
      ]);
    });

    it("accepts actual variable syntax with whitespace and rejects hyphenated names", () => {
      const image: Block = {
        id: "variable-image",
        type: "image",
        url: "{{ assets.hero_url }}",
        alt: "Product dashboard",
        width: 100,
        align: "center",
        href: "{{ links.dashboard }}",
      };
      const button: Block = {
        id: "variable-button",
        type: "button",
        text: "Open dashboard",
        url: "{{ account.dashboard_url }}",
        align: "left",
        fullWidth: false,
      };
      const social: Block = {
        id: "bad-variable",
        type: "social",
        links: [{ kind: "website", url: "{{account-url}}" }],
        align: "left",
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      expect(
        runPreflight(
          "Your dashboard",
          design([image, button, social, footer]),
        ),
      ).toEqual([
        expect.objectContaining({
          id: "link-invalid:bad-variable:links.0",
          code: "link-invalid",
          blockId: "bad-variable",
        }),
      ]);
    });

    it("rejects mail and phone destinations without a payload", () => {
      const button: Block = {
        id: "empty-mail",
        type: "button",
        text: "Email support",
        url: "mailto:",
        align: "left",
        fullWidth: false,
      };
      const social: Block = {
        id: "empty-phone",
        type: "social",
        links: [{ kind: "website", url: "tel:" }],
        align: "left",
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      expect(
        runPreflight("Contact support", design([button, social, footer])),
      ).toEqual([
        expect.objectContaining({
          id: "link-invalid:empty-mail:url",
          code: "link-invalid",
          blockId: "empty-mail",
        }),
        expect.objectContaining({
          id: "link-invalid:empty-phone:links.0",
          code: "link-invalid",
          blockId: "empty-phone",
        }),
      ]);
    });

    it("validates embedded links in every rich-text-bearing block", () => {
      const heading: Block = {
        id: "linked-heading",
        type: "heading",
        text: 'Read the <a href="">release notes</a>',
        level: 1,
        align: "left",
      };
      const text: Block = {
        id: "linked-text",
        type: "text",
        text: 'Visit <a href="javascript:alert(1)">this page</a>',
        align: "left",
        fontSize: 15,
        muted: false,
      };
      const columns: Block = {
        id: "linked-columns",
        type: "columns",
        leftText: "Help is available",
        rightText: 'Or <a href="tel:">call us</a>',
      };
      const footer: Block = {
        id: "linked-footer",
        type: "footer",
        text: 'Manage <a href="{{account-settings}}">preferences</a>',
        showUnsubscribe: true,
      };

      expect(
        runPreflight(
          "Release notes",
          design([heading, text, columns, footer]),
        ).map(({ code, blockId }) => ({ code, blockId })),
      ).toEqual([
        { code: "link-empty", blockId: "linked-heading" },
        { code: "link-invalid", blockId: "linked-text" },
        { code: "link-invalid", blockId: "linked-columns" },
        { code: "link-invalid", blockId: "linked-footer" },
      ]);
    });

    it("validates logo image sources and requires image alt text", () => {
      const invalidSource: Block = {
        id: "invalid-logo",
        type: "logo",
        text: "Support",
        imageUrl: "mailto:support@example.com",
        align: "left",
      };
      const missingAlt: Block = {
        id: "missing-alt-logo",
        type: "logo",
        text: " ",
        imageUrl: "https://cdn.example.com/logo.png",
        align: "left",
      };
      const textLogo: Block = {
        id: "text-logo",
        type: "logo",
        text: "Acme",
        imageUrl: "",
        align: "left",
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      expect(
        runPreflight(
          "Welcome",
          design([invalidSource, missingAlt, textLogo, footer]),
        ),
      ).toEqual([
        expect.objectContaining({
          id: "link-invalid:invalid-logo:source",
          code: "link-invalid",
          blockId: "invalid-logo",
        }),
        expect.objectContaining({
          id: "image-alt-missing:missing-alt-logo",
          code: "image-alt-missing",
          title: "Logo image needs alt text",
          blockId: "missing-alt-logo",
        }),
      ]);
    });

    it("matches renderer image mode for whitespace logo sources", () => {
      const whitespaceSource: Block = {
        id: "whitespace-logo",
        type: "logo",
        text: " ",
        imageUrl: "   ",
        align: "left",
      };
      const textMode: Block = {
        id: "text-mode-logo",
        type: "logo",
        text: "",
        imageUrl: "",
        align: "left",
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      expect(
        runPreflight(
          "Welcome",
          design([whitespaceSource, textMode, footer]),
        ),
      ).toEqual([
        expect.objectContaining({
          id: "link-empty:whitespace-logo:source",
          code: "link-empty",
          blockId: "whitespace-logo",
        }),
        expect.objectContaining({
          id: "image-alt-missing:whitespace-logo",
          code: "image-alt-missing",
          blockId: "whitespace-logo",
        }),
      ]);
    });

    it("returns no findings for a ready design and permits optional image links", () => {
      const image: Block = {
        id: "hero-image",
        type: "image",
        url: "{{hero_image_url}}",
        alt: "Product dashboard",
        width: 100,
        align: "center",
        href: "",
      };
      const button: Block = {
        id: "primary-cta",
        type: "button",
        text: "Open dashboard",
        url: "{{dashboard_url}}",
        align: "left",
        fullWidth: false,
      };
      const footer: Block = {
        id: "footer",
        type: "footer",
        text: "Acme Inc",
        showUnsubscribe: true,
      };

      expect(
        runPreflight("Your dashboard is ready", design([image, button, footer])),
      ).toEqual([]);
    });
  });
});
