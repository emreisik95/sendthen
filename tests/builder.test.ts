import { describe, expect, it } from "vitest";
import { compileDesign, designToText } from "@/lib/template-builder/compile";
import { PRESETS } from "@/lib/template-builder/presets";
import {
  DEFAULT_STYLES,
  defaultBlock,
  type TemplateDesign,
} from "@/lib/template-builder/types";

const design = (blocks: TemplateDesign["blocks"]): TemplateDesign => ({
  version: 1,
  styles: { ...DEFAULT_STYLES },
  blocks,
});

describe("template builder compiler", () => {
  it("produces a full email-safe document", () => {
    const html = compileDesign(design([defaultBlock("heading")]));
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("display: flex");
  });

  it("escapes hostile text but keeps {{variables}} and whitelisted tags", () => {
    const text = defaultBlock("text");
    if (text.type !== "text") throw new Error();
    text.text = 'Hi {{name}} <script>alert(1)</script> <b>bold</b>';
    const html = compileDesign(design([text]));
    expect(html).toContain("{{name}}");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<b>bold</b>");
  });

  it("contains an unsubscribe link when footer asks for one", () => {
    const footer = defaultBlock("footer");
    if (footer.type !== "footer") throw new Error();
    footer.showUnsubscribe = true;
    const html = compileDesign(design([footer]));
    expect(html).toContain("{{unsubscribe_url}}");
  });

  it("blocks attribute injection through button urls", () => {
    const btn = defaultBlock("button");
    if (btn.type !== "button") throw new Error();
    btn.url = '" onmouseover="alert(1)';
    const html = compileDesign(design([btn]));
    expect(html).not.toContain('onmouseover="alert(1)');
  });

  it("every preset compiles and renders its variables", () => {
    for (const preset of PRESETS) {
      const html = compileDesign(preset.design);
      expect(html).toContain("<!DOCTYPE html>");
      const text = designToText(preset.design);
      expect(text.length).toBeGreaterThan(10);
    }
    const newsletter = PRESETS.find((p) => p.key === "newsletter")!;
    expect(compileDesign(newsletter.design)).toContain("{{unsubscribe_url}}");
  });
});
