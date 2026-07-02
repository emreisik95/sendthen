"use client";

import { useState, type ReactNode } from "react";
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

/* ------------------------------------------------------------------ */
/* Small form primitives (inspector)                                   */
/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-faint">
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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

function AlignPicker({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  const options: Align[] = ["left", "center", "right"];
  return (
    <Field label="Align">
      <div className="inline-flex overflow-hidden rounded-md border border-line">
        {options.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={value === a}
            onClick={() => onChange(a)}
            className={`px-3 py-1.5 text-xs capitalize transition-colors ${
              value === a
                ? "bg-lime text-on-lime"
                : "bg-surface text-fg-muted hover:bg-surface-2"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
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
        <div className="inline-flex overflow-hidden rounded-md border border-line">
          {([1, 2] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              aria-pressed={block.level === lvl}
              onClick={() => patch({ level: lvl })}
              className={`px-3 py-1.5 text-xs transition-colors ${
                block.level === lvl
                  ? "bg-lime text-on-lime"
                  : "bg-surface text-fg-muted hover:bg-surface-2"
              }`}
            >
              H{lvl}
            </button>
          ))}
        </div>
      </Field>
      <AlignPicker value={block.align} onChange={(a) => patch({ align: a })} />
    </div>
  );
}

function TextEditor({ block, patch }: { block: TextBlock; patch: Patch<TextBlock> }) {
  return (
    <div className="space-y-3">
      <TextAreaField label="Text" value={block.text} onChange={(v) => patch({ text: v })} />
      <NumberField
        label="Font size (px)"
        value={block.fontSize}
        min={10}
        max={40}
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
  return (
    <div className="space-y-3">
      <TextField label="Label" value={block.text} onChange={(v) => patch({ text: v })} />
      <TextField label="URL" value={block.url} onChange={(v) => patch({ url: v })} />
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
      <NumberField
        label="Width (% of content)"
        value={block.width}
        min={10}
        max={100}
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
    <NumberField
      label="Height (px)"
      value={block.height}
      min={4}
      max={200}
      step={4}
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
  return (
    <div className="space-y-3">
      {block.links.map((link, i) => (
        <div key={i} className="space-y-2 rounded-md border border-line p-2">
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
        className={`${btnSecondary} w-full justify-center text-xs`}
        onClick={() =>
          patch({ links: [...block.links, { kind: "website", url: "https://" }] })
        }
      >
        + Add link
      </button>
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
        Broadcast sends require an unsubscribe link.
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
      <h3 className="text-sm font-semibold text-fg">Global styles</h3>
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
          {!knownFont ? (
            <option value={styles.fontFamily}>Custom</option>
          ) : null}
          {FONT_STACKS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="border-t border-line pt-3">
        <h3 className="mb-1 text-sm font-semibold text-fg">Variables</h3>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const blocks = design.blocks;
  const styles = design.styles;
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  /* -------- immutable updaters -------- */

  const patch = <T extends Block>(
    id: string,
    partial: Partial<Omit<T, "id" | "type">>,
  ): void => {
    setDesign((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, ...partial } as Block) : b)),
    }));
  };

  const patchStyles = (partial: Partial<GlobalStyles>): void => {
    setDesign((d) => ({ ...d, styles: { ...d.styles, ...partial } }));
  };

  const addBlock = (type: BlockType): void => {
    const block = defaultBlock(type);
    setDesign((d) => ({ ...d, blocks: [...d.blocks, block] }));
    setSelectedId(block.id);
  };

  const deleteBlock = (id: string): void => {
    setDesign((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const duplicateBlock = (id: string): void => {
    const source = blocks.find((b) => b.id === id);
    if (!source) return;
    // Deep-clone so nested state (e.g. social `links`) is not shared, and
    // generate the id outside the updater so it stays pure (StrictMode-safe).
    const copy = structuredClone(source);
    copy.id = newBlockId();
    setDesign((d) => {
      const i = d.blocks.findIndex((b) => b.id === id);
      if (i === -1) return d;
      const next = [...d.blocks];
      next.splice(i + 1, 0, copy);
      return { ...d, blocks: next };
    });
    setSelectedId(copy.id);
  };

  const moveBlock = (id: string, dir: -1 | 1): void => {
    setDesign((d) => {
      const i = d.blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= d.blocks.length) return d;
      const next = [...d.blocks];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, blocks: next };
    });
  };

  const reorderBlock = (from: number, to: number): void => {
    setDesign((d) => {
      if (from === to || from < 0 || from >= d.blocks.length) return d;
      const next = [...d.blocks];
      const [moved] = next.splice(from, 1);
      next.splice(from < to ? to - 1 : to, 0, moved);
      return { ...d, blocks: next };
    });
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
    setDesign(JSON.parse(JSON.stringify(preset.design)) as TemplateDesign);
    setSubject(preset.subject);
    setSelectedId(null);
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

  /* -------- layout -------- */

  const canvasWidth = device === "desktop" ? 600 : 375;
  const cardWidth = Math.min(styles.contentWidth, canvasWidth);

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      {/* ---------------- Top bar ---------------- */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <input
          type="text"
          aria-label="Template name"
          className={`${inputCls} max-w-52`}
          value={name}
          placeholder="Template name"
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          aria-label="Email subject"
          className={`${inputCls} max-w-md flex-1`}
          value={subject}
          placeholder="Email subject — supports {{variables}}"
          onChange={(e) => setSubject(e.target.value)}
        />
        <select
          aria-label="Apply preset"
          className={`${inputCls} w-44 shrink-0`}
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

        <div className="ml-auto flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-line">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                  device === d
                    ? "bg-surface-3 text-fg"
                    : "bg-surface text-fg-muted hover:bg-surface-2"
                }`}
              >
                {d === "desktop" ? "🖥 Desktop" : "📱 Mobile"}
              </button>
            ))}
          </div>
          {error ? (
            <p role="alert" className="max-w-64 truncate text-xs text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className={btnPrimary}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------------- Left palette ---------------- */}
        <aside className="w-44 shrink-0 overflow-y-auto border-r border-line bg-surface p-2">
          <p className="px-1 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-fg-faint">
            Blocks
          </p>
          <div className="space-y-1">
            {PALETTE.map((entry) => (
              <button
                key={entry.type}
                type="button"
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
          onClick={() => setSelectedId(null)}
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
                    <div
                      key={block.id}
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
                            className="px-1.5 py-0.5 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="Move down"
                            aria-label="Move block down"
                            disabled={index === blocks.length - 1}
                            onClick={() => moveBlock(block.id, 1)}
                            className="px-1.5 py-0.5 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            title="Duplicate"
                            aria-label="Duplicate block"
                            onClick={() => duplicateBlock(block.id)}
                            className="px-1.5 py-0.5 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
                          >
                            ⧉
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            aria-label="Delete block"
                            onClick={() => deleteBlock(block.id)}
                            className="px-1.5 py-0.5 text-[11px] text-danger hover:bg-danger/10"
                          >
                            ✕
                          </button>
                        </div>
                      ) : null}
                      <BlockPreview block={block} styles={styles} />
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
                <h3 className="text-sm font-semibold capitalize text-fg">
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
