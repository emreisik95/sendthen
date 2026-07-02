"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  defaultBlock,
  newBlockId,
  type Align,
  type Block,
  type BlockType,
  type ButtonBlock,
  type CodeBlock,
  type ColumnsBlock,
  type FooterBlock,
  type GlobalStyles,
  type HeadingBlock,
  type HtmlBlock,
  type ImageBlock,
  type LogoBlock,
  type SocialBlock,
  type SocialKind,
  type SpacerBlock,
  type TemplateDesign,
  type TextBlock,
} from "@/lib/template-builder/types";
import { btnPrimary, btnSecondary, inputCls } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Props & shared types                                                */
/* ------------------------------------------------------------------ */

export interface EditorPreset {
  key: string;
  name: string;
  description: string;
  subject: string;
  design: TemplateDesign;
}

export interface EditorProps {
  initial?: {
    id?: string;
    name: string;
    subject: string;
    design: TemplateDesign;
  };
  presets: EditorPreset[];
}

type Device = "desktop" | "mobile";

/** Patch function for a specific block type (id/type are immutable). */
type Patch<T extends Block> = (partial: Partial<Omit<T, "id" | "type">>) => void;

type TestSendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

const HISTORY_CAP = 50;
const MAX_SOCIAL_LINKS = 5;

const PALETTE: { type: BlockType; label: string; glyph: string }[] = [
  { type: "logo", label: "Logo", glyph: "◆" },
  { type: "heading", label: "Heading", glyph: "H" },
  { type: "text", label: "Text", glyph: "¶" },
  { type: "button", label: "Button", glyph: "▭" },
  { type: "image", label: "Image", glyph: "▣" },
  { type: "divider", label: "Divider", glyph: "—" },
  { type: "spacer", label: "Spacer", glyph: "↕" },
  { type: "columns", label: "Columns", glyph: "▥" },
  { type: "social", label: "Social", glyph: "@" },
  { type: "footer", label: "Footer", glyph: "§" },
  { type: "html", label: "HTML", glyph: "</>" },
  { type: "code", label: "Code", glyph: "#" },
];

const FONT_STACKS: { label: string; value: string }[] = [
  {
    label: "System sans",
    value:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  { label: "Georgia serif", value: "Georgia, 'Times New Roman', Times, serif" },
  {
    label: "Monospace",
    value: "'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  },
];

const VARIABLES = ["{{name}}", "{{code}}", "{{title}}", "{{unsubscribe_url}}"];

const SOCIAL_KINDS: SocialKind[] = ["x", "github", "linkedin", "instagram", "website"];

const SOCIAL_LABELS: Record<SocialKind, string> = {
  x: "X",
  github: "GitHub",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  website: "Website",
};

/** True when the event target is a form field the user is typing in. */
function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable
  );
}

/* ------------------------------------------------------------------ */
/* Small form primitives (inspector)                                   */
/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-fg-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        className={inputCls}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="mt-1 block text-[11px] text-warn">{hint}</span> : null}
    </Field>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 5,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <Field label={label}>
      <textarea
        className={`${inputCls} resize-y ${mono ? "font-mono text-xs" : ""}`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={inputCls}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          // valueAsNumber is NaN for an empty field; Number("") would be 0
          // and silently commit 0 (e.g. fontSize/contentWidth) on clear.
          const n = e.target.valueAsNumber;
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </Field>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-lime"
          value={Math.min(max, Math.max(min, value))}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (!Number.isNaN(n)) onChange(n);
          }}
        />
        <span className="w-14 shrink-0 text-right font-mono text-xs text-fg-muted">
          {value}
          {unit}
        </span>
      </div>
    </Field>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
      <input
        type="checkbox"
        className="h-4 w-4 accent-lime"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/** Generic segmented control with text labels. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "sm",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "xs";
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-md border border-line"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`${size === "sm" ? "px-3 py-1.5" : "px-2.5 py-1"} text-xs transition-colors ${
            value === opt.value
              ? "bg-lime text-on-lime"
              : "bg-surface text-fg-muted hover:bg-surface-2"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function AlignPicker({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  return (
    <Field label="Align">
      <Segmented<Align>
        ariaLabel="Alignment"
        value={value}
        onChange={onChange}
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ]}
      />
    </Field>
  );
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border border-line bg-surface p-0.5"
          value={HEX_RE.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className={inputCls}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Variable-highlighting text (preview)                                */
/* ------------------------------------------------------------------ */

function VarText({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/);
  return (
    <>
      {parts.map((part, i) =>
        /^\{\{[^}]+\}\}$/.test(part) ? (
          <span
            key={i}
            style={{
              background: "rgba(198, 255, 0, 0.35)",
              borderRadius: 3,
              padding: "0 2px",
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Block previews (approximate WYSIWYG, inline styles on light card)   */
/* ------------------------------------------------------------------ */

function BlockPreview({ block, styles }: { block: Block; styles: GlobalStyles }) {
  switch (block.type) {
    case "logo":
      return (
        <div style={{ textAlign: block.align }}>
          {block.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.imageUrl}
              alt={block.text || "logo"}
              style={{ height: 32, display: "inline-block" }}
            />
          ) : (
            <span
              style={{
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: "-0.02em",
                color: styles.textColor,
              }}
            >
              {block.text || "logo"}
            </span>
          )}
        </div>
      );
    case "heading":
      return (
        <div
          style={{
            textAlign: block.align,
            fontSize: block.level === 1 ? 26 : 20,
            fontWeight: 700,
            lineHeight: 1.25,
            color: styles.textColor,
          }}
        >
          <VarText text={block.text} />
        </div>
      );
    case "text":
      return (
        <div
          style={{
            textAlign: block.align,
            fontSize: block.fontSize,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            color: block.muted ? "#71717a" : styles.textColor,
          }}
        >
          <VarText text={block.text} />
        </div>
      );
    case "button":
      return (
        <div style={{ textAlign: block.align }}>
          <span
            style={{
              display: block.fullWidth ? "block" : "inline-block",
              background: styles.accentColor,
              color: styles.onAccentColor,
              borderRadius: 999,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            <VarText text={block.text || "Button"} />
          </span>
        </div>
      );
    case "image":
      return (
        <div style={{ textAlign: block.align }}>
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.url}
              alt={block.alt}
              style={{
                width: `${block.width}%`,
                display: "inline-block",
                borderRadius: 6,
              }}
            />
          ) : (
            <div
              style={{
                width: `${block.width}%`,
                display: "inline-block",
                border: "1.5px dashed #d4d4d8",
                borderRadius: 6,
                padding: "28px 0",
                color: "#a1a1aa",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              image
            </div>
          )}
        </div>
      );
    case "divider":
      return <div style={{ borderTop: "1px solid #e4e4e7" }} aria-hidden />;
    case "spacer":
      return <div style={{ height: block.height }} aria-hidden />;
    case "columns":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            fontSize: 14,
            lineHeight: 1.6,
            color: styles.textColor,
          }}
        >
          <div style={{ whiteSpace: "pre-wrap" }}>
            <VarText text={block.leftText} />
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>
            <VarText text={block.rightText} />
          </div>
        </div>
      );
    case "social":
      return (
        <div style={{ textAlign: block.align }}>
          {block.links.map((link, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 6px 0 0",
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid #e4e4e7",
                fontSize: 12,
                color: styles.accentColor,
              }}
            >
              {SOCIAL_LABELS[link.kind]}
            </span>
          ))}
        </div>
      );
    case "footer":
      return (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: "#a1a1aa",
            whiteSpace: "pre-wrap",
          }}
        >
          <VarText text={block.text} />
          {block.showUnsubscribe ? (
            <div style={{ marginTop: 4 }}>
              <span style={{ textDecoration: "underline" }}>Unsubscribe</span>{" "}
              <span style={{ opacity: 0.7 }}>
                → <VarText text="{{unsubscribe_url}}" />
              </span>
            </div>
          ) : null}
        </div>
      );
    case "html":
      return (
        <pre
          style={{
            background: "#f4f4f5",
            border: "1px solid #e4e4e7",
            borderRadius: 6,
            padding: 10,
            fontSize: 11,
            lineHeight: 1.5,
            fontFamily: "Menlo, Consolas, monospace",
            color: "#52525b",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
          }}
        >
          {block.html || "<!-- html -->"}
        </pre>
      );
    case "code":
      return (
        <div
          style={{
            textAlign: block.align,
            fontFamily: "Menlo, Consolas, monospace",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: styles.textColor,
          }}
        >
          <VarText text={block.text} />
        </div>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Per-type inspector editors                                          */
/* ------------------------------------------------------------------ */

function LogoEditor({ block, patch }: { block: LogoBlock; patch: Patch<LogoBlock> }) {
  return (
    <div className="space-y-3">
      <TextField label="Text" value={block.text} onChange={(v) => patch({ text: v })} />
      <TextField
        label="Image URL"
        value={block.imageUrl}
        placeholder="https:// (leave empty for text logo)"
        onChange={(v) => patch({ imageUrl: v })}
      />
      <AlignPicker value={block.align} onChange={(a) => patch({ align: a })} />
    </div>
  );
}

function HeadingEditor({
  block,
  patch,
}: {
  block: HeadingBlock;
  patch: Patch<HeadingBlock>;
}) {
  return (
    <div className="space-y-3">
      <TextField label="Text" value={block.text} onChange={(v) => patch({ text: v })} />
      <Field label="Level">
        <Segmented<"1" | "2">
          ariaLabel="Heading level"
          value={block.level === 1 ? "1" : "2"}
          onChange={(v) => patch({ level: v === "1" ? 1 : 2 })}
          options={[
            { value: "1", label: "H1" },
            { value: "2", label: "H2" },
          ]}
        />
      </Field>
      <AlignPicker value={block.align} onChange={(a) => patch({ align: a })} />
    </div>
  );
}

function TextEditor({ block, patch }: { block: TextBlock; patch: Patch<TextBlock> }) {
  return (
    <div className="space-y-3">
      <TextAreaField label="Text" value={block.text} onChange={(v) => patch({ text: v })} />
      <SliderField
        label="Font size"
        value={block.fontSize}
        min={12}
        max={24}
        unit="px"
        onChange={(v) => patch({ fontSize: v })}
      />
      <AlignPicker value={block.align} onChange={(a) => patch({ align: a })} />
      <CheckboxField
        label="Muted color"
        checked={block.muted}
        onChange={(v) => patch({ muted: v })}
      />
    </div>
  );
}

function ButtonEditor({
  block,
  patch,
}: {
  block: ButtonBlock;
  patch: Patch<ButtonBlock>;
}) {
  const badUrl = block.url.length > 0 && !block.url.startsWith("https://");
  return (
    <div className="space-y-3">
      <TextField label="Label" value={block.text} onChange={(v) => patch({ text: v })} />
      <TextField
        label="URL"
        value={block.url}
        placeholder="https://"
        hint={badUrl ? "Must start with https://" : undefined}
        onChange={(v) => patch({ url: v })}
      />
      <AlignPicker value={block.align} onChange={(a) => patch({ align: a })} />
      <CheckboxField
        label="Full width"
        checked={block.fullWidth}
        onChange={(v) => patch({ fullWidth: v })}
      />
    </div>
  );
}

function ImageEditor({ block, patch }: { block: ImageBlock; patch: Patch<ImageBlock> }) {
  return (
    <div className="space-y-3">
      <TextField label="Image URL" value={block.url} onChange={(v) => patch({ url: v })} />
      <TextField label="Alt text" value={block.alt} onChange={(v) => patch({ alt: v })} />
      <TextField
        label="Link (optional)"
        value={block.href}
        onChange={(v) => patch({ href: v })}
      />
      <SliderField
        label="Width"
        value={block.width}
        min={10}
        max={100}
        unit="%"
        onChange={(v) => patch({ width: Math.min(100, Math.max(10, v)) })}
      />
      <AlignPicker value={block.align} onChange={(a) => patch({ align: a })} />
    </div>
  );
}

function SpacerEditor({
  block,
  patch,
}: {
  block: SpacerBlock;
  patch: Patch<SpacerBlock>;
}) {
  return (
    <SliderField
      label="Height"
      value={block.height}
      min={8}
      max={96}
      step={4}
      unit="px"
      onChange={(v) => patch({ height: v })}
    />
  );
}

function ColumnsEditor({
  block,
  patch,
}: {
  block: ColumnsBlock;
  patch: Patch<ColumnsBlock>;
}) {
  return (
    <div className="space-y-3">
      <TextAreaField
        label="Left column"
        value={block.leftText}
        rows={4}
        onChange={(v) => patch({ leftText: v })}
      />
      <TextAreaField
        label="Right column"
        value={block.rightText}
        rows={4}
        onChange={(v) => patch({ rightText: v })}
      />
    </div>
  );
}

function SocialEditor({
  block,
  patch,
}: {
  block: SocialBlock;
  patch: Patch<SocialBlock>;
}) {
  const setLink = (index: number, link: { kind: SocialKind; url: string }) => {
    patch({ links: block.links.map((l, i) => (i === index ? link : l)) });
  };
  const atCap = block.links.length >= MAX_SOCIAL_LINKS;
  return (
    <div className="space-y-3">
      {block.links.map((link, i) => (
        <div key={i} className="space-y-2 rounded-md border border-line p-3">
          <div className="flex items-center gap-2">
            <select
              aria-label={`Link ${i + 1} network`}
              className={inputCls}
              value={link.kind}
              onChange={(e) =>
                setLink(i, { ...link, kind: e.target.value as SocialKind })
              }
            >
              {SOCIAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SOCIAL_LABELS[k]}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="Remove link"
              aria-label={`Remove link ${i + 1}`}
              className="shrink-0 rounded-md border border-line px-2 py-1.5 text-xs text-danger hover:bg-danger/10"
              onClick={() => patch({ links: block.links.filter((_, j) => j !== i) })}
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            aria-label={`Link ${i + 1} URL`}
            className={inputCls}
            value={link.url}
            placeholder="https://"
            onChange={(e) => setLink(i, { ...link, url: e.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        className={`${btnSecondary} w-full justify-center text-xs disabled:cursor-not-allowed disabled:opacity-40`}
        disabled={atCap}
        title={atCap ? `Maximum ${MAX_SOCIAL_LINKS} links` : "Add a social link"}
        onClick={() =>
          patch({ links: [...block.links, { kind: "website", url: "https://" }] })
        }
      >
        + Add link
      </button>
      {atCap ? (
        <p className="text-[11px] text-fg-faint">
          Maximum of {MAX_SOCIAL_LINKS} links per social block.
        </p>
      ) : null}
      <AlignPicker value={block.align} onChange={(a) => patch({ align: a })} />
    </div>
  );
}

function FooterEditor({
  block,
  patch,
}: {
  block: FooterBlock;
  patch: Patch<FooterBlock>;
}) {
  return (
    <div className="space-y-3">
      <TextAreaField
        label="Footer text"
        value={block.text}
        rows={3}
        onChange={(v) => patch({ text: v })}
      />
      <CheckboxField
        label="Show unsubscribe link"
        checked={block.showUnsubscribe}
        onChange={(v) => patch({ showUnsubscribe: v })}
      />
      <p className="text-xs text-fg-faint">
        Renders an {"{{unsubscribe_url}}"} link in the footer. Broadcast sends require an
        unsubscribe link — leave this on for marketing emails; transactional emails
        (receipts, OTP codes) may omit it.
      </p>
    </div>
  );
}

function HtmlEditor({ block, patch }: { block: HtmlBlock; patch: Patch<HtmlBlock> }) {
  return (
    <TextAreaField
      label="Raw HTML"
      value={block.html}
      rows={10}
      mono
      onChange={(v) => patch({ html: v })}
    />
  );
}

function CodeEditor({ block, patch }: { block: CodeBlock; patch: Patch<CodeBlock> }) {
  return (
    <div className="space-y-3">
      <TextField
        label="Code text"
        value={block.text}
        placeholder="{{code}}"
        onChange={(v) => patch({ text: v })}
      />
      <AlignPicker value={block.align} onChange={(a) => patch({ align: a })} />
    </div>
  );
}

function BlockInspector({
  block,
  patch,
}: {
  block: Block;
  patch: <T extends Block>(id: string, partial: Partial<Omit<T, "id" | "type">>) => void;
}) {
  switch (block.type) {
    case "logo":
      return <LogoEditor block={block} patch={(p) => patch<LogoBlock>(block.id, p)} />;
    case "heading":
      return (
        <HeadingEditor block={block} patch={(p) => patch<HeadingBlock>(block.id, p)} />
      );
    case "text":
      return <TextEditor block={block} patch={(p) => patch<TextBlock>(block.id, p)} />;
    case "button":
      return (
        <ButtonEditor block={block} patch={(p) => patch<ButtonBlock>(block.id, p)} />
      );
    case "image":
      return <ImageEditor block={block} patch={(p) => patch<ImageBlock>(block.id, p)} />;
    case "divider":
      return (
        <p className="text-xs text-fg-faint">
          A simple horizontal rule. Nothing to configure.
        </p>
      );
    case "spacer":
      return (
        <SpacerEditor block={block} patch={(p) => patch<SpacerBlock>(block.id, p)} />
      );
    case "columns":
      return (
        <ColumnsEditor block={block} patch={(p) => patch<ColumnsBlock>(block.id, p)} />
      );
    case "social":
      return (
        <SocialEditor block={block} patch={(p) => patch<SocialBlock>(block.id, p)} />
      );
    case "footer":
      return (
        <FooterEditor block={block} patch={(p) => patch<FooterBlock>(block.id, p)} />
      );
    case "html":
      return <HtmlEditor block={block} patch={(p) => patch<HtmlBlock>(block.id, p)} />;
    case "code":
      return <CodeEditor block={block} patch={(p) => patch<CodeBlock>(block.id, p)} />;
  }
}

/* ------------------------------------------------------------------ */
/* Global styles inspector                                             */
/* ------------------------------------------------------------------ */

function GlobalInspector({
  styles,
  onChange,
}: {
  styles: GlobalStyles;
  onChange: (partial: Partial<GlobalStyles>) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const knownFont = FONT_STACKS.some((f) => f.value === styles.fontFamily);
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-fg-faint">
        Global styles
      </h3>
      <ColorField
        label="Page background"
        value={styles.backgroundColor}
        onChange={(v) => onChange({ backgroundColor: v })}
      />
      <ColorField
        label="Card background"
        value={styles.contentBackground}
        onChange={(v) => onChange({ contentBackground: v })}
      />
      <ColorField
        label="Text color"
        value={styles.textColor}
        onChange={(v) => onChange({ textColor: v })}
      />
      <ColorField
        label="Accent color"
        value={styles.accentColor}
        onChange={(v) => onChange({ accentColor: v })}
      />
      <ColorField
        label="On-accent color"
        value={styles.onAccentColor}
        onChange={(v) => onChange({ onAccentColor: v })}
      />
      <NumberField
        label="Content width (px)"
        value={styles.contentWidth}
        min={320}
        max={800}
        step={10}
        onChange={(v) => onChange({ contentWidth: v })}
      />
      <Field label="Font family">
        <select
          className={inputCls}
          value={styles.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
        >
          {!knownFont ? <option value={styles.fontFamily}>Custom</option> : null}
          {FONT_STACKS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="border-t border-line pt-3">
        <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-fg-faint">
          Variables
        </h3>
        <p className="mb-2 text-xs text-fg-faint">
          Click to copy, then paste into any text field.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(v);
                setCopied(v);
                window.setTimeout(() => setCopied((c) => (c === v ? null : c)), 1200);
              }}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                copied === v
                  ? "border-lime bg-lime/15 text-lime"
                  : "border-line bg-surface-2 text-fg-muted hover:border-lime/50 hover:text-fg"
              }`}
            >
              {copied === v ? "copied!" : v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas insert point (hover "+" between blocks)                      */
/* ------------------------------------------------------------------ */

function InsertPoint({
  index,
  open,
  onToggle,
  onInsert,
}: {
  index: number;
  open: boolean;
  onToggle: (index: number | null) => void;
  onInsert: (type: BlockType, index: number) => void;
}) {
  return (
    <div
      className="group/insert relative -my-1 flex h-4 items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      {/* thin line, visible on hover or while the menu is open */}
      <div
        aria-hidden
        className={`absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 transition-opacity ${
          open ? "opacity-100" : "opacity-0 group-hover/insert:opacity-100"
        }`}
        style={{ background: "rgba(198, 255, 0, 0.6)" }}
      />
      <button
        type="button"
        title="Insert block here"
        aria-label={`Insert block at position ${index + 1}`}
        aria-expanded={open}
        onClick={() => onToggle(open ? null : index)}
        className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-lime text-sm font-semibold leading-none text-on-lime shadow-sm transition-opacity hover:scale-110 ${
          open ? "opacity-100" : "opacity-0 group-hover/insert:opacity-100"
        }`}
      >
        +
      </button>

      {open ? (
        <>
          {/* click-away backdrop */}
          <div
            className="fixed inset-0 z-20"
            aria-hidden
            onClick={() => onToggle(null)}
          />
          <div
            role="menu"
            aria-label="Insert block type"
            className="absolute top-6 z-30 grid w-64 grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-2 shadow-lg"
          >
            {PALETTE.map((entry) => (
              <button
                key={entry.type}
                type="button"
                role="menuitem"
                onClick={() => onInsert(entry.type, index)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className="inline-flex w-5 shrink-0 justify-center font-mono text-fg-muted"
                >
                  {entry.glyph}
                </span>
                {entry.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main editor                                                         */
/* ------------------------------------------------------------------ */

export function Editor({ initial, presets }: EditorProps) {
  const [name, setName] = useState(initial?.name ?? "Untitled template");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [design, setDesign] = useState<TemplateDesign>(
    initial?.design ?? {
      version: 1,
      styles: {
        backgroundColor: "#f4f4f5",
        contentBackground: "#ffffff",
        contentWidth: 600,
        fontFamily: FONT_STACKS[0].value,
        textColor: "#18181b",
        accentColor: "#18181b",
        onAccentColor: "#ffffff",
      },
      blocks: [],
    },
  );

  /* undo/redo stacks of design snapshots */
  const [past, setPast] = useState<TemplateDesign[]>([]);
  const [future, setFuture] = useState<TemplateDesign[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testSend, setTestSend] = useState<TestSendState>({ kind: "idle" });
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [insertMenuAt, setInsertMenuAt] = useState<number | null>(null);

  /** Set right before an intentional navigation to suppress beforeunload. */
  const bypassGuard = useRef(false);

  const blocks = design.blocks;
  const styles = design.styles;
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  /* -------- history-aware commit -------- */

  /** Commit a new design snapshot: pushes the current one onto the undo stack. */
  const commit = (next: TemplateDesign): void => {
    if (next === design) return;
    setPast((p) => [...p.slice(-(HISTORY_CAP - 1)), design]);
    setFuture([]);
    setDesign(next);
    setDirty(true);
  };

  const undo = (): void => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([design, ...future].slice(0, HISTORY_CAP));
    setDesign(prev);
    setDirty(true);
  };

  const redo = (): void => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past.slice(-(HISTORY_CAP - 1)), design]);
    setDesign(next);
    setDirty(true);
  };

  /* -------- immutable updaters (every one goes through commit) -------- */

  const patch = <T extends Block>(
    id: string,
    partial: Partial<Omit<T, "id" | "type">>,
  ): void => {
    commit({
      ...design,
      blocks: design.blocks.map((b) =>
        b.id === id ? ({ ...b, ...partial } as Block) : b,
      ),
    });
  };

  const patchStyles = (partial: Partial<GlobalStyles>): void => {
    commit({ ...design, styles: { ...design.styles, ...partial } });
  };

  const insertBlockAt = (type: BlockType, index: number): void => {
    const block = defaultBlock(type);
    const next = [...design.blocks];
    next.splice(Math.min(Math.max(index, 0), next.length), 0, block);
    commit({ ...design, blocks: next });
    setSelectedId(block.id);
    setInsertMenuAt(null);
  };

  const addBlock = (type: BlockType): void => {
    insertBlockAt(type, design.blocks.length);
  };

  const deleteBlock = (id: string): void => {
    commit({ ...design, blocks: design.blocks.filter((b) => b.id !== id) });
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const duplicateBlock = (id: string): void => {
    const i = design.blocks.findIndex((b) => b.id === id);
    if (i === -1) return;
    // Deep-clone so nested state (e.g. social `links`) is not shared.
    const copy = structuredClone(design.blocks[i]);
    copy.id = newBlockId();
    const next = [...design.blocks];
    next.splice(i + 1, 0, copy);
    commit({ ...design, blocks: next });
    setSelectedId(copy.id);
  };

  const moveBlock = (id: string, dir: -1 | 1): void => {
    const i = design.blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= design.blocks.length) return;
    const next = [...design.blocks];
    [next[i], next[j]] = [next[j], next[i]];
    commit({ ...design, blocks: next });
  };

  const reorderBlock = (from: number, to: number): void => {
    if (from < 0 || from >= design.blocks.length) return;
    // `to === from + 1` inserts right back where the block came from — a
    // no-op that would otherwise pollute the undo stack and mark dirty.
    if (from === to || to === from + 1) return;
    const next = [...design.blocks];
    const [moved] = next.splice(from, 1);
    next.splice(from < to ? to - 1 : to, 0, moved);
    commit({ ...design, blocks: next });
  };

  /* -------- presets -------- */

  const applyPreset = (key: string): void => {
    const preset = presets.find((p) => p.key === key);
    if (!preset) return;
    if (
      blocks.length > 0 &&
      !window.confirm(`Replace the current design with the “${preset.name}” preset?`)
    ) {
      return;
    }
    // Deep-clone so preset objects are never mutated by editing.
    commit(JSON.parse(JSON.stringify(preset.design)) as TemplateDesign);
    setSubject(preset.subject);
    setSelectedId(null);
    setDirty(true);
  };

  /* -------- save -------- */

  const handleSave = async (): Promise<void> => {
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      if (initial?.id) fd.set("id", initial.id);
      fd.set("name", name);
      fd.set("subject", subject);
      fd.set("design", JSON.stringify(design));
      const res = await fetch("/api/builder/save", { method: "POST", body: fd });
      if (res.ok) {
        bypassGuard.current = true;
        setDirty(false);
        window.location.href = "/templates";
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Save failed (HTTP ${res.status}).`);
    } catch {
      setError("Network error while saving. Please try again.");
    }
    setSaving(false);
  };

  /* -------- send test -------- */

  const handleTestSend = async (): Promise<void> => {
    setTestSend({ kind: "sending" });
    try {
      const fd = new FormData();
      fd.set("subject", subject);
      fd.set("design", JSON.stringify(design));
      const res = await fetch("/api/builder/test-send", { method: "POST", body: fd });
      const body = (await res.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (res.ok && body?.id) {
        setTestSend({ kind: "ok" });
        window.setTimeout(
          () => setTestSend((s) => (s.kind === "ok" ? { kind: "idle" } : s)),
          4000,
        );
        return;
      }
      setTestSend({
        kind: "error",
        message: body?.error ?? `Test send failed (HTTP ${res.status}).`,
      });
    } catch {
      setTestSend({ kind: "error", message: "Network error while sending test." });
    }
  };

  /* -------- cancel (dirty confirm) -------- */

  const handleCancelClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (
      dirty &&
      !window.confirm("You have unsaved changes. Discard them and leave the editor?")
    ) {
      e.preventDefault();
      return;
    }
    bypassGuard.current = true;
  };

  /* -------- keyboard shortcuts (undo/redo/delete/escape) -------- */

  const keyCtx = useRef({ undo, redo, deleteBlock, selectedId });
  keyCtx.current = { undo, redo, deleteBlock, selectedId };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        // Don't yank the inspector away while the user is typing in a field
        // (e.g. Escape to dismiss autocomplete/IME inside an input).
        if (isFormField(e.target)) return;
        setInsertMenuAt(null);
        setSelectedId(null);
        return;
      }
      const inField = isFormField(e.target);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        if (inField) return; // let the field's own undo work
        e.preventDefault();
        if (e.shiftKey) keyCtx.current.redo();
        else keyCtx.current.undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        if (inField) return;
        e.preventDefault();
        keyCtx.current.redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !inField && !mod) {
        const id = keyCtx.current.selectedId;
        if (id) {
          e.preventDefault();
          keyCtx.current.deleteBlock(id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* -------- unsaved-changes guard -------- */

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (!dirtyRef.current || bypassGuard.current) return;
      e.preventDefault();
      // Chrome requires returnValue to be set for the dialog to appear.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /* -------- layout -------- */

  const canvasWidth = device === "desktop" ? 600 : 375;
  const cardWidth = Math.min(styles.contentWidth, canvasWidth);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const compactInput = `${inputCls} h-8 py-1`;

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      {/* ---------------- Top bar ---------------- */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        {/* left: cancel */}
        <a
          href="/templates"
          onClick={handleCancelClick}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <span aria-hidden>←</span>
          Templates
        </a>

        <div aria-hidden className="h-6 w-px shrink-0 bg-line" />

        {/* center: name + subject */}
        <input
          type="text"
          aria-label="Template name"
          className={`${compactInput} max-w-48`}
          value={name}
          placeholder="Template name"
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
        />
        <input
          type="text"
          aria-label="Email subject"
          className={`${compactInput} max-w-md flex-1`}
          value={subject}
          placeholder="Email subject — supports {{variables}}"
          onChange={(e) => {
            setSubject(e.target.value);
            setDirty(true);
          }}
        />

        {/* right: preset, undo/redo, device, test, save */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <select
            aria-label="Apply preset"
            className={`${compactInput} w-40`}
            value=""
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Apply preset…
            </option>
            {presets.map((p) => (
              <option key={p.key} value={p.key} title={p.description}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="inline-flex overflow-hidden rounded-md border border-line">
            <button
              type="button"
              title="Undo (⌘Z)"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
              className="px-2.5 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↩
            </button>
            <button
              type="button"
              title="Redo (⌘⇧Z)"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
              className="border-l border-line px-2.5 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↪
            </button>
          </div>

          <Segmented<Device>
            ariaLabel="Preview device"
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />

          {error ? (
            <p role="alert" className="max-w-52 truncate text-xs text-danger" title={error}>
              {error}
            </p>
          ) : null}

          <button
            type="button"
            className={`${btnSecondary} h-8 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={testSend.kind === "sending"}
            onClick={() => void handleTestSend()}
          >
            {testSend.kind === "sending" ? "Sending…" : "Send test"}
          </button>
          <button
            type="button"
            className={`${btnPrimary} h-8 px-3.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60`}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {/* ---------------- Test-send toast ---------------- */}
      {testSend.kind === "ok" ? (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-lime/40 bg-surface px-4 py-3 text-sm text-fg shadow-lg"
        >
          <span aria-hidden className="text-lime">
            ✓
          </span>
          Test queued — check Emails
        </div>
      ) : null}
      {testSend.kind === "error" ? (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-danger/40 bg-surface px-4 py-3 text-sm text-fg shadow-lg"
        >
          <span aria-hidden className="text-danger">
            ✕
          </span>
          <span className="max-w-72">{testSend.message}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            className="text-fg-faint transition-colors hover:text-fg"
            onClick={() => setTestSend({ kind: "idle" })}
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* ---------------- Left palette ---------------- */}
        <aside className="w-44 shrink-0 overflow-y-auto border-r border-line bg-surface p-3">
          <p className="pb-2 text-[11px] font-medium uppercase tracking-wider text-fg-faint">
            Blocks
          </p>
          <div className="space-y-1">
            {PALETTE.map((entry) => (
              <button
                key={entry.type}
                type="button"
                title={`Add ${entry.label} block`}
                onClick={() => addBlock(entry.type)}
                className="flex w-full items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-left text-xs text-fg transition-colors hover:border-lime/40 hover:bg-surface-3"
              >
                <span
                  aria-hidden
                  className="inline-flex w-6 shrink-0 justify-center font-mono text-fg-muted"
                >
                  {entry.glyph}
                </span>
                {entry.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ---------------- Canvas ---------------- */}
        <main
          className="flex-1 overflow-auto"
          style={{ background: styles.backgroundColor }}
          onClick={() => {
            setSelectedId(null);
            setInsertMenuAt(null);
          }}
        >
          <div className="mx-auto py-10" style={{ width: canvasWidth, maxWidth: "100%" }}>
            <div
              className="mx-auto rounded-lg shadow-sm"
              style={{
                width: cardWidth,
                maxWidth: "100%",
                background: styles.contentBackground,
                fontFamily: styles.fontFamily,
                padding: "32px 40px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {blocks.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-black/10 py-16 text-center text-sm text-black/40">
                  Empty template — add blocks from the left palette
                  <br />
                  or apply a preset from the top bar.
                </div>
              ) : (
                blocks.map((block, index) => {
                  const isSelected = block.id === selectedId;
                  const showDrop =
                    dragIndex !== null && dropIndex === index && dragIndex !== index;
                  return (
                    <div key={block.id}>
                      <InsertPoint
                        index={index}
                        open={insertMenuAt === index}
                        onToggle={setInsertMenuAt}
                        onInsert={insertBlockAt}
                      />
                      <div
                        draggable
                        onDragStart={(e) => {
                          setDragIndex(index);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", block.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dropIndex !== index) setDropIndex(index);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null) reorderBlock(dragIndex, index);
                          setDragIndex(null);
                          setDropIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setDropIndex(null);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(block.id);
                          setInsertMenuAt(null);
                        }}
                        className="group relative cursor-pointer rounded-sm px-1 py-1.5"
                        style={{
                          outline: isSelected
                            ? "1px solid #C6FF00"
                            : "1px solid transparent",
                          outlineOffset: 2,
                          borderTop: showDrop
                            ? "2px solid #C6FF00"
                            : "2px solid transparent",
                          opacity: dragIndex === index ? 0.4 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.outline =
                              "1px solid rgba(198,255,0,0.35)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.outline = "1px solid transparent";
                        }}
                      >
                        {isSelected ? (
                          <div
                            className="absolute -top-3.5 right-1 z-10 flex overflow-hidden rounded-md border border-line bg-surface shadow-md"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              title="Move up"
                              aria-label="Move block up"
                              disabled={index === 0}
                              onClick={() => moveBlock(block.id, -1)}
                              className="px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              title="Move down"
                              aria-label="Move block down"
                              disabled={index === blocks.length - 1}
                              onClick={() => moveBlock(block.id, 1)}
                              className="border-l border-line px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              title="Duplicate block"
                              aria-label="Duplicate block"
                              onClick={() => duplicateBlock(block.id)}
                              className="border-l border-line px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
                            >
                              ⧉
                            </button>
                            <button
                              type="button"
                              title="Delete block (Del)"
                              aria-label="Delete block"
                              onClick={() => deleteBlock(block.id)}
                              className="border-l border-line px-2 py-1 text-[11px] text-danger hover:bg-danger/10"
                            >
                              ✕
                            </button>
                          </div>
                        ) : null}
                        <BlockPreview block={block} styles={styles} />
                      </div>
                      {/* insert point after the last block */}
                      {index === blocks.length - 1 ? (
                        <InsertPoint
                          index={blocks.length}
                          open={insertMenuAt === blocks.length}
                          onToggle={setInsertMenuAt}
                          onInsert={insertBlockAt}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
              {/* drop zone after the last block */}
              {dragIndex !== null && blocks.length > 0 ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dropIndex !== blocks.length) setDropIndex(blocks.length);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) reorderBlock(dragIndex, blocks.length);
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  className="h-6"
                  style={{
                    borderTop:
                      dropIndex === blocks.length
                        ? "2px solid #C6FF00"
                        : "2px solid transparent",
                  }}
                />
              ) : null}
            </div>
          </div>
        </main>

        {/* ---------------- Right inspector ---------------- */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-line bg-surface p-3">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-fg-faint">
                  {selected.type} block
                </h3>
                <button
                  type="button"
                  className="text-xs text-fg-faint transition-colors hover:text-fg"
                  onClick={() => setSelectedId(null)}
                >
                  ← Global styles
                </button>
              </div>
              <BlockInspector block={selected} patch={patch} />
            </div>
          ) : (
            <GlobalInspector styles={styles} onChange={patchStyles} />
          )}
        </aside>
      </div>
    </div>
  );
}

export default Editor;
