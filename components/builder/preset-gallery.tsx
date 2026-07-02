"use client";

import type { Block, TemplateDesign } from "@/lib/template-builder/types";
import type { EditorPreset } from "./editor";

/**
 * Stylized miniature of a template design — real colors, abstracted
 * content — so a preset card reads at a glance.
 */
function MiniBlock({ block, design }: { block: Block; design: TemplateDesign }) {
  const { styles } = design;
  const alignSelf = (a: "left" | "center" | "right" = "left") =>
    a === "center" ? "center" : a === "right" ? "flex-end" : "flex-start";

  switch (block.type) {
    case "logo":
      return (
        <div
          className="h-[7px] w-10 rounded-[2px] font-bold"
          style={{
            background: styles.textColor,
            alignSelf: alignSelf(block.align),
            opacity: 0.9,
          }}
        />
      );
    case "heading":
      return (
        <div
          className="rounded-[2px]"
          style={{
            height: block.level === 1 ? 9 : 7,
            width: block.level === 1 ? "72%" : "56%",
            background: styles.textColor,
            alignSelf: alignSelf(block.align),
          }}
        />
      );
    case "text":
      return (
        <div
          className="flex w-full flex-col gap-[3px]"
          style={{ alignItems: alignSelf(block.align) }}
        >
          <div
            className="h-[4px] w-[92%] rounded-[2px]"
            style={{ background: styles.textColor, opacity: 0.35 }}
          />
          <div
            className="h-[4px] w-[78%] rounded-[2px]"
            style={{ background: styles.textColor, opacity: 0.35 }}
          />
        </div>
      );
    case "button":
      return (
        <div
          className="h-[12px] rounded-[3px]"
          style={{
            width: block.fullWidth ? "100%" : 52,
            background: styles.accentColor,
            alignSelf: alignSelf(block.align),
          }}
        />
      );
    case "image":
      return (
        <div
          className="h-[26px] w-full rounded-[3px]"
          style={{ background: styles.textColor, opacity: 0.12 }}
        />
      );
    case "divider":
      return (
        <div
          className="h-px w-full"
          style={{ background: styles.textColor, opacity: 0.15 }}
        />
      );
    case "spacer":
      return <div style={{ height: Math.min(block.height / 4, 10) }} />;
    case "columns":
      return (
        <div className="flex w-full gap-[6px]">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-1 flex-col gap-[3px]">
              <div
                className="h-[4px] w-[80%] rounded-[2px]"
                style={{ background: styles.textColor, opacity: 0.55 }}
              />
              <div
                className="h-[4px] w-[60%] rounded-[2px]"
                style={{ background: styles.textColor, opacity: 0.3 }}
              />
            </div>
          ))}
        </div>
      );
    case "social":
      return (
        <div
          className="flex gap-[4px]"
          style={{ alignSelf: alignSelf(block.align) }}
        >
          {block.links.slice(0, 4).map((_, i) => (
            <div
              key={i}
              className="h-[5px] w-[5px] rounded-full"
              style={{ background: styles.textColor, opacity: 0.4 }}
            />
          ))}
        </div>
      );
    case "footer":
      return (
        <div
          className="h-[4px] w-[55%] rounded-[2px]"
          style={{ background: styles.textColor, opacity: 0.25 }}
        />
      );
    case "code":
      return (
        <div
          className="flex h-[16px] w-[70px] items-center justify-center rounded-[3px]"
          style={{
            background: styles.textColor === "#fafafa" ? "#27272a" : "#f4f4f5",
            alignSelf: alignSelf(block.align),
          }}
        >
          <div
            className="h-[6px] w-[46px] rounded-[2px]"
            style={{ background: styles.accentColor, opacity: 0.9 }}
          />
        </div>
      );
    case "html":
      return (
        <div
          className="h-[10px] w-full rounded-[2px]"
          style={{ background: styles.textColor, opacity: 0.08 }}
        />
      );
  }
}

export function PresetPreview({ design }: { design: TemplateDesign }) {
  return (
    <div
      className="flex h-[132px] w-full items-center justify-center overflow-hidden"
      style={{ background: design.styles.backgroundColor }}
      aria-hidden
    >
      <div
        className="flex w-[72%] flex-col gap-[6px] rounded-[6px] px-[14px] py-[12px] shadow-sm"
        style={{ background: design.styles.contentBackground }}
      >
        {design.blocks.slice(0, 6).map((b) => (
          <MiniBlock key={b.id} block={b} design={design} />
        ))}
      </div>
    </div>
  );
}

export function PresetCard({
  preset,
  onApply,
}: {
  preset: EditorPreset;
  onApply: (key: string) => void;
}) {
  // the info band inherits the theme's own colors so cards stay coherent
  // on both the light canvas and the dark popover
  const { styles } = preset.design;
  return (
    <button
      type="button"
      onClick={() => onApply(preset.key)}
      className="group overflow-hidden rounded-lg text-left shadow-sm ring-1 ring-black/10 transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-lime"
    >
      <PresetPreview design={preset.design} />
      <div
        className="px-3 py-2.5"
        style={{
          background: styles.backgroundColor,
          borderTop: `1px solid ${styles.textColor}1a`,
        }}
      >
        <div className="text-sm font-medium" style={{ color: styles.textColor }}>
          {preset.name}
        </div>
        <div
          className="mt-0.5 line-clamp-2 text-xs leading-snug"
          style={{ color: styles.textColor, opacity: 0.55 }}
        >
          {preset.description}
        </div>
      </div>
    </button>
  );
}

export function PresetGrid({
  presets,
  onApply,
  columns = 3,
}: {
  presets: EditorPreset[];
  onApply: (key: string) => void;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-3 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
    >
      {presets.map((p) => (
        <PresetCard key={p.key} preset={p} onApply={onApply} />
      ))}
    </div>
  );
}
