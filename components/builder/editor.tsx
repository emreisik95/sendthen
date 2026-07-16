"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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
import { Select } from "@/components/select";
import { PresetGrid } from "@/components/builder/preset-gallery";
import {
  BLOCK_CATALOG,
  getLayerLabel,
  reorderBlocks,
  runPreflight,
  searchBlockCatalog,
  type PreflightFinding,
} from "@/lib/template-builder/editor-model";
import { compileDesign } from "@/lib/template-builder/compile";

/* ------------------------------------------------------------------ */
/* Props & shared types                                                */
/* ------------------------------------------------------------------ */

export interface EditorPreset {
  key: string;
  name: string;
  description: string;
  subject: string;
  design: TemplateDesign;
  /** Three representative colors shown as dots on the preset card. */
  swatch?: [string, string, string];
}

export interface EditorProps {
  initial?: {
    id?: string;
    name: string;
    subject: string;
    design: TemplateDesign;
  };
  presets: EditorPreset[];
  /** Options for the "Send test" dialog: from-address + default recipient. */
  sendConfig: {
    /** Verified sending domains the user can send from. */
    domains: { id: string; name: string }[];
    /** Signed-in user's address — the default test recipient. */
    userEmail: string;
    /** Default sender display name (team name — beats "sendthen test"). */
    defaultFromName: string;
  };
}

type Device = "desktop" | "mobile";
type PreviewTab = "rendered" | "source";
type WorkspaceTab = "build" | "layers" | "brand" | "review";

interface EditorHistorySnapshot {
  name: string;
  subject: string;
  design: TemplateDesign;
}

/** Patch function for a specific block type (id/type are immutable). */
type Patch<T extends Block> = (partial: Partial<Omit<T, "id" | "type">>) => void;

type TestSendState =
  | { kind: "idle" }
  | { kind: "form" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

/** Editable fields in the "Send test" dialog. */
interface TestForm {
  fromName: string;
  fromLocal: string;
  domainId: string;
  to: string;
  vars: Record<string, string>;
}

/** Default sample values for known variables shown in the test dialog. */
const VAR_SAMPLES: Record<string, string> = {
  name: "Alex",
  code: "123456",
  title: "A test from the builder",
};

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Collect every {{variable}} referenced by the subject or any block's string
 * fields, in first-seen order. `unsubscribe_url` is excluded — the test send
 * fills it with a preview link automatically, so there's nothing to ask for.
 */
function collectVars(subject: string, design: TemplateDesign): string[] {
  const seen: string[] = [];
  const add = (name: string) => {
    if (name !== "unsubscribe_url" && !seen.includes(name)) seen.push(name);
  };
  const scan = (s: unknown) => {
    if (typeof s !== "string") return;
    for (const m of s.matchAll(VAR_RE)) add(m[1]);
  };
  scan(subject);
  for (const block of design.blocks) {
    for (const val of Object.values(block)) scan(val);
  }
  return seen;
}

function editorSnapshot(
  name: string,
  subject: string,
  design: TemplateDesign,
): string {
  return JSON.stringify({ name, subject, design });
}

/**
 * One shared drag state for both palette→canvas inserts ("new") and
 * existing-block reorders ("move"). `overIndex` is the insertion index the
 * pointer currently maps to (null while not over a valid spot).
 */
type DragState =
  | {
      type: "new";
      payload: BlockType;
      label: string;
      overIndex: number | null;
    }
  | {
      type: "move";
      payload: string;
      label: string;
      overIndex: number | null;
    };

interface PaletteDragData {
  kind: "palette";
  blockType: BlockType;
  label: string;
}

interface BlockDragData {
  kind: "block";
  blockId: string;
  index: number;
  label: string;
}

interface CanvasDropData {
  kind: "canvas";
}

interface PaletteSourceDropData {
  kind: "palette-source";
}

interface DragLayoutItem {
  blockId: string;
  index: number;
  midpoint: number;
}

interface DragLayoutCache {
  initialScrollTop: number;
  items: DragLayoutItem[];
}

type EditorDragData =
  | PaletteDragData
  | BlockDragData
  | CanvasDropData
  | PaletteSourceDropData;

const PALETTE_DRAG_PREFIX = "palette:";
const BLOCK_DRAG_PREFIX = "block:";
const CANVAS_DROP_ID = "canvas:blocks";

const paletteDragId = (type: BlockType): string => `${PALETTE_DRAG_PREFIX}${type}`;
const blockDragId = (id: string): string => `${BLOCK_DRAG_PREFIX}${id}`;

function dragData(value: unknown): EditorDragData | null {
  if (!value || typeof value !== "object" || !("kind" in value)) return null;
  const data = value as Partial<EditorDragData>;
  if (data.kind === "canvas") return data as CanvasDropData;
  if (data.kind === "palette-source") return data as PaletteSourceDropData;
  if (
    data.kind === "palette" &&
    typeof (data as Partial<PaletteDragData>).blockType === "string" &&
    typeof (data as Partial<PaletteDragData>).label === "string"
  ) {
    return data as PaletteDragData;
  }
  if (
    data.kind === "block" &&
    typeof (data as Partial<BlockDragData>).blockId === "string" &&
    typeof (data as Partial<BlockDragData>).index === "number" &&
    typeof (data as Partial<BlockDragData>).label === "string"
  ) {
    return data as BlockDragData;
  }
  return null;
}

const editorCollisionDetection: CollisionDetection = (args) => {
  const canReceiveDrop = (id: string | number): boolean =>
    id === CANVAS_DROP_ID ||
    (typeof id === "string" && id.startsWith(BLOCK_DRAG_PREFIX));
  const preferBlockTargets = (
    collisions: ReturnType<CollisionDetection>,
  ): ReturnType<CollisionDetection> => {
    const eligibleTargets = collisions.filter((collision) =>
      canReceiveDrop(collision.id),
    );
    const blockTargets = eligibleTargets.filter(
      (collision) => collision.id !== CANVAS_DROP_ID,
    );
    return blockTargets.length > 0 ? blockTargets : eligibleTargets;
  };

  const pointerCollisions = preferBlockTargets(pointerWithin(args));
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  // Pointer drags should only land inside the canvas. Keyboard drags do not
  // have pointer coordinates, so fall back to the nearest sortable target.
  if (args.pointerCoordinates) return [];
  return preferBlockTargets(closestCenter(args));
};

const HISTORY_CAP = 50;
const MAX_SOCIAL_LINKS = 5;
const MIN_ZOOM = 50;
const MAX_ZOOM = 150;
const DEFAULT_ZOOM = 100;

const WORKSPACE_TABS: readonly {
  id: WorkspaceTab;
  label: string;
  glyph: string;
  description: string;
}[] = [
  {
    id: "build",
    label: "Build",
    glyph: "⊞",
    description: "Add content and ready-made sections.",
  },
  {
    id: "layers",
    label: "Layers",
    glyph: "☷",
    description: "Navigate and reorder the document.",
  },
  {
    id: "brand",
    label: "Brand",
    glyph: "◐",
    description: "Apply a complete visual system.",
  },
  {
    id: "review",
    label: "Review",
    glyph: "✓",
    description: "Resolve delivery and content issues.",
  },
];

interface PaletteEntry {
  readonly type: BlockType;
  readonly label: string;
  readonly glyph: string;
  readonly description?: string;
}

const PALETTE: PaletteEntry[] = [
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

interface BrandTheme {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly swatches: readonly [string, string, string];
  readonly styles: GlobalStyles;
}

const BRAND_THEMES: readonly BrandTheme[] = [
  {
    id: "sendthen",
    name: "Sendthen Signal",
    summary: "System sans · 600px · high contrast",
    swatches: ["#0b0d0c", "#141714", "#c6ff00"],
    styles: {
      backgroundColor: "#0b0d0c",
      contentBackground: "#141714",
      contentWidth: 600,
      fontFamily: FONT_STACKS[0].value,
      textColor: "#f4f6f1",
      accentColor: "#c6ff00",
      onAccentColor: "#0a0b09",
    },
  },
  {
    id: "studio",
    name: "Studio Neutral",
    summary: "System sans · 600px · crisp editorial",
    swatches: ["#eef1f4", "#ffffff", "#17191c"],
    styles: {
      backgroundColor: "#eef1f4",
      contentBackground: "#ffffff",
      contentWidth: 600,
      fontFamily: FONT_STACKS[0].value,
      textColor: "#17191c",
      accentColor: "#17191c",
      onAccentColor: "#ffffff",
    },
  },
  {
    id: "midnight",
    name: "Midnight Product",
    summary: "System sans · 620px · electric blue",
    swatches: ["#080d1a", "#111a2e", "#6d8cff"],
    styles: {
      backgroundColor: "#080d1a",
      contentBackground: "#111a2e",
      contentWidth: 620,
      fontFamily: FONT_STACKS[0].value,
      textColor: "#f4f7ff",
      accentColor: "#6d8cff",
      onAccentColor: "#081025",
    },
  },
  {
    id: "editorial",
    name: "Warm Editorial",
    summary: "Georgia serif · 580px · soft terracotta",
    swatches: ["#f4eee6", "#fffaf3", "#a4472d"],
    styles: {
      backgroundColor: "#f4eee6",
      contentBackground: "#fffaf3",
      contentWidth: 580,
      fontFamily: FONT_STACKS[1].value,
      textColor: "#30251f",
      accentColor: "#a4472d",
      onAccentColor: "#fffaf3",
    },
  },
  {
    id: "mint",
    name: "Fresh Commerce",
    summary: "System sans · 600px · clean mint",
    swatches: ["#e8f3ef", "#ffffff", "#087f5b"],
    styles: {
      backgroundColor: "#e8f3ef",
      contentBackground: "#ffffff",
      contentWidth: 600,
      fontFamily: FONT_STACKS[0].value,
      textColor: "#17352b",
      accentColor: "#087f5b",
      onAccentColor: "#ffffff",
    },
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

function activatorClientY(event: Event): number | null {
  const pointerEvent = event as Event & {
    clientY?: unknown;
    touches?: ArrayLike<{ clientY?: unknown }>;
  };
  if (typeof pointerEvent.clientY === "number") return pointerEvent.clientY;
  const firstTouch = pointerEvent.touches?.[0];
  return typeof firstTouch?.clientY === "number" ? firstTouch.clientY : null;
}

/* ------------------------------------------------------------------ */
/* Small form primitives (inspector)                                   */
/* ------------------------------------------------------------------ */

function fieldName(label: string): string {
  return `builder-${label
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-fg-muted">
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
  type = "text",
  spellCheck = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: "text" | "url";
  spellCheck?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        name={fieldName(label)}
        autoComplete="off"
        inputMode={type === "url" ? "url" : undefined}
        spellCheck={type === "url" ? false : spellCheck}
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
        name={fieldName(label)}
        autoComplete="off"
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
        name={fieldName(label)}
        autoComplete="off"
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
          name={fieldName(label)}
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
        name={fieldName(label)}
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
          name={`${fieldName(label)}-picker`}
          aria-label={`${label} color picker`}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border border-line bg-surface p-0.5"
          value={HEX_RE.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          name={`${fieldName(label)}-hex`}
          autoComplete="off"
          aria-label={`${label} hex value`}
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
              width={160}
              height={32}
              loading="lazy"
              decoding="async"
              style={{ width: "auto", maxWidth: "100%", height: 32, display: "inline-block" }}
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
              width={600}
              height={320}
              loading="lazy"
              decoding="async"
              style={{
                width: `${block.width}%`,
                height: "auto",
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
        type="url"
        placeholder="https://example.com/logo.svg…"
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
        type="url"
        placeholder="https://example.com/path…"
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
      <TextField
        label="Image URL"
        value={block.url}
        type="url"
        placeholder="https://example.com/image.jpg…"
        onChange={(v) => patch({ url: v })}
      />
      <TextField label="Alt text" value={block.alt} onChange={(v) => patch({ alt: v })} />
      <TextField
        label="Link (optional)"
        value={block.href}
        type="url"
        placeholder="https://example.com/path…"
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
            <Select
              // Uncontrolled — remount if the kind changes externally
              // (undo/redo) so the visible label stays in sync.
              key={link.kind}
              ariaLabel={`Link ${i + 1} network`}
              className="min-w-0 flex-1"
              defaultValue={link.kind}
              options={SOCIAL_KINDS.map((k) => ({
                value: k,
                label: SOCIAL_LABELS[k],
              }))}
              onValueChange={(v) => setLink(i, { ...link, kind: v as SocialKind })}
            />
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
            type="url"
            name={`social-link-${i + 1}-url`}
            autoComplete="off"
            inputMode="url"
            spellCheck={false}
            aria-label={`Link ${i + 1} URL`}
            className={inputCls}
            value={link.url}
            placeholder="https://example.com/profile…"
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
        <Select
          // Select is uncontrolled — remount when the value changes
          // externally (e.g. undo/redo or preset apply) to stay in sync.
          key={styles.fontFamily}
          defaultValue={styles.fontFamily}
          options={[
            ...(!knownFont ? [{ value: styles.fontFamily, label: "Custom" }] : []),
            ...FONT_STACKS.map((f) => ({ value: f.value, label: f.label })),
          ]}
          onValueChange={(v) => onChange({ fontFamily: v })}
        />
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
/* Drop indicator (insertion line while dragging)                      */
/* ------------------------------------------------------------------ */

/**
 * Zero-height wrapper so showing/hiding the indicator never shifts block
 * midpoints (which would make the target index oscillate under the pointer).
 */
function DropIndicator() {
  return (
    <div aria-hidden className="pointer-events-none relative h-0">
      <div
        className="absolute inset-x-0 top-[-1.5px] z-10 h-[3px] rounded-full"
        style={{ background: "#C6FF00" }}
      >
        <span
          className="absolute -left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
          style={{ background: "#C6FF00" }}
        />
      </div>
    </div>
  );
}

function PaletteBlockButton({
  entry,
  onAdd,
}: {
  entry: (typeof PALETTE)[number];
  onAdd: (type: BlockType) => void;
}) {
  const id = paletteDragId(entry.type);
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef: setDraggableNodeRef,
  } = useDraggable({
    id,
    data: {
      kind: "palette",
      blockType: entry.type,
      label: entry.label,
    } satisfies PaletteDragData,
  });
  // Register the source as a droppable under the same id so
  // sortableKeyboardCoordinates can calculate the first move into the canvas.
  // The collision strategy deliberately excludes palette ids as destinations.
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id,
    data: { kind: "palette-source" } satisfies PaletteSourceDropData,
  });
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setDraggableNodeRef(node);
      setDroppableNodeRef(node);
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  );

  return (
    <button
      ref={setNodeRef}
      type="button"
      inert={isDragging ? true : undefined}
      {...attributes}
      {...listeners}
      aria-describedby={undefined}
      aria-label={`${entry.label} block. Press Enter to add. Press Space to pick up, then use arrow keys to position, Space to drop, or Escape to cancel.`}
      title={`Add ${entry.label} block — click to append or drag onto the canvas`}
      onKeyDownCapture={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onAdd(entry.type);
      }}
      onClick={() => onAdd(entry.type)}
      className={`builder-block-card group flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-2.5 py-2.5 text-left text-fg transition-colors hover:border-lime/40 hover:bg-surface-3 active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      // TouchSensor can cancel during its delay when the user intends to pan.
      style={{ touchAction: "manipulation" }}
    >
      <span
        aria-hidden
        className="builder-block-glyph inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs text-fg-muted"
      >
        {entry.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-tight text-fg">
          {entry.label}
        </span>
        {entry.description ? (
          <span className="mt-0.5 block text-xs leading-snug text-fg-muted">
            {entry.description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className="opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
      >
        ⠿
      </span>
    </button>
  );
}

function CanvasDropZone({
  scrollRef,
  backgroundColor,
  active,
  onClear,
  children,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  backgroundColor: string;
  active: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: CANVAS_DROP_ID,
    data: { kind: "canvas" } satisfies CanvasDropData,
  });
  const setScrollRef = useCallback(
    (node: HTMLElement | null) => {
      scrollRef.current = node;
    },
    [scrollRef],
  );

  return (
    <main
      ref={setScrollRef}
      id="template-canvas"
      tabIndex={-1}
      aria-label="Template canvas"
      className={`builder-canvas min-w-0 flex-1 overflow-auto transition-shadow ${
        isOver && active ? "ring-2 ring-inset ring-lime/40" : ""
      }`}
      style={
        { "--builder-email-background": backgroundColor } as React.CSSProperties
      }
      onClick={onClear}
    >
      <div ref={setNodeRef} className="builder-canvas-drop-surface min-h-full">
        {children}
      </div>
    </main>
  );
}

function SortableBlock({
  block,
  index,
  total,
  styles,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: Block;
  index: number;
  total: number;
  styles: GlobalStyles;
  selected: boolean;
  onSelect: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const label = PALETTE.find((entry) => entry.type === block.type)?.label ?? block.type;
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
  } = useSortable({
    id: blockDragId(block.id),
    data: {
      kind: "block",
      blockId: block.id,
      index,
      label,
    } satisfies BlockDragData,
  });

  return (
    <div
      ref={setNodeRef}
      id={`builder-block-${block.id}`}
      inert={isDragging ? true : undefined}
      data-block-wrapper
      data-block-index={index}
      data-block-id={block.id}
      className={`group relative rounded-sm px-1 py-1.5 ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{
        outline: selected ? "1px solid #C6FF00" : "1px solid transparent",
        outlineOffset: 2,
        userSelect: isDragging ? "none" : undefined,
      }}
      onMouseEnter={(event) => {
        if (!selected) {
          event.currentTarget.style.outline = "1px solid rgba(198,255,0,0.35)";
        }
      }}
      onMouseLeave={(event) => {
        if (!selected) event.currentTarget.style.outline = "1px solid transparent";
      }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${label} block`}
        title="Drag to reorder"
        onClick={(event) => event.stopPropagation()}
        className={`absolute -left-8 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 cursor-grab select-none items-center justify-center rounded border border-line bg-surface font-mono text-[10px] leading-[0.55rem] tracking-[-0.15em] text-fg-muted shadow-sm transition-opacity hover:text-fg focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing ${
          selected ? "opacity-100" : "opacity-0"
        }`}
        style={{ touchAction: "none" }}
      >
        ⋮⋮
      </button>

      {selected ? (
        <div
          className="absolute -top-3.5 right-1 z-10 flex overflow-hidden rounded-md border border-line bg-surface shadow-md"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            title="Move up"
            aria-label="Move block up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            title="Move down"
            aria-label="Move block down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="border-l border-line px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            title="Duplicate block"
            aria-label="Duplicate block"
            onClick={onDuplicate}
            className="border-l border-line px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            ⧉
          </button>
          <button
            type="button"
            title="Delete block (Del)"
            aria-label="Delete block"
            onClick={onDelete}
            className="border-l border-line px-2 py-1 text-[11px] text-danger hover:bg-danger/10"
          >
            ✕
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={`Select ${label} block`}
        aria-pressed={selected}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        className="absolute inset-0 z-[1] block h-full w-full cursor-pointer rounded-sm border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
      />
      <div className="pointer-events-none">
        <BlockPreview block={block} styles={styles} />
      </div>
    </div>
  );
}

function DragGhost({
  drag,
  blocks,
  styles,
}: {
  drag: DragState | null;
  blocks: readonly Block[];
  styles: GlobalStyles;
}) {
  if (!drag) return null;

  if (drag.type === "new") {
    const entry = PALETTE.find((item) => item.type === drag.payload);
    if (!entry) return null;
    return (
      <div
        aria-hidden
        className="flex cursor-grabbing items-center gap-2 rounded-md border border-lime/60 bg-surface-2 px-3 py-2 text-xs text-fg shadow-xl"
      >
        <span className="inline-flex w-6 justify-center font-mono text-fg-muted">
          {entry.glyph}
        </span>
        {entry.label}
      </div>
    );
  }

  const block = blocks.find((item) => item.id === drag.payload);
  if (!block) return null;
  return (
    <div
      aria-hidden
      className="cursor-grabbing rounded-lg border border-lime/60 p-4 shadow-2xl"
      style={{
        width: Math.min(styles.contentWidth, 520),
        maxWidth: "calc(100vw - 32px)",
        background: styles.contentBackground,
        fontFamily: styles.fontFamily,
      }}
    >
      <BlockPreview block={block} styles={styles} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main editor                                                         */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Send-test dialog                                                     */
/* ------------------------------------------------------------------ */

function TestSendDialog({
  form,
  setForm,
  domains,
  onCancel,
  onSend,
}: {
  form: TestForm;
  setForm: React.Dispatch<React.SetStateAction<TestForm>>;
  domains: { id: string; name: string }[];
  onCancel: () => void;
  onSend: () => void;
}) {
  const hasDomains = domains.length > 0;
  const varNames = Object.keys(form.vars);
  const toValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.to.trim());
  const canSend = toValid && (!hasDomains || form.domainId !== "");
  const fromPreview = hasDomains
    ? `${form.fromName || "sendthen"} <${form.fromLocal || "hello"}@${
        domains.find((d) => d.id === form.domainId)?.name ?? domains[0].name
      }>`
    : `${form.fromName || "sendthen"} <test@sandbox.local>`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Send a test email"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      onClick={onCancel}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-fg">Send a test email</h2>
        <p className="mt-1 text-xs text-fg-faint">
          Sending from a verified domain keeps the test out of spam.
        </p>

        <div className="mt-4 space-y-4">
          {/* --- From --- */}
          <Field label="From name">
            <input
              type="text"
              name="test-from-name"
              autoComplete="off"
              className={inputCls}
              value={form.fromName}
              placeholder="Acme…"
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
            />
          </Field>

          <Field label="From address">
            {hasDomains ? (
              <div className="flex items-stretch gap-1.5">
                <input
                  type="text"
                  name="test-from-local-part"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="From address local part"
                  className={`${inputCls} min-w-0 flex-1`}
                  value={form.fromLocal}
                  placeholder="hello…"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fromLocal: e.target.value }))
                  }
                />
                <span className="flex shrink-0 items-center text-sm text-fg-muted">
                  @
                </span>
                <select
                  name="test-sending-domain"
                  aria-label="Sending domain"
                  className={`${inputCls} min-w-0 flex-1`}
                  value={form.domainId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, domainId: e.target.value }))
                  }
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                No verified domains yet — this test goes out from a sandbox
                address and may land in spam. Verify a domain to send for real.
              </p>
            )}
          </Field>

          {/* --- To --- */}
          <Field label="Send to">
            <input
              type="email"
              name="test-recipient"
              autoComplete="email"
              spellCheck={false}
              className={inputCls}
              value={form.to}
              placeholder="you@example.com…"
              onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
            />
            {form.to.trim() !== "" && !toValid ? (
              <span className="mt-1 block text-[11px] text-danger">
                Enter a valid email address.
              </span>
            ) : null}
          </Field>

          {/* --- Variables --- */}
          {varNames.length > 0 ? (
            <div>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-fg-faint">
                Variables
              </span>
              <p className="mb-2 text-xs text-fg-faint">
                These fill the {"{{placeholders}}"} in your subject and content
                for this test.
              </p>
              <div className="space-y-2">
                {varNames.map((name) => (
                  <label key={name} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 truncate font-mono text-[11px] text-fg-muted">
                      {`{{${name}}}`}
                    </span>
                    <input
                      type="text"
                      name={`test-variable-${name}`}
                      autoComplete="off"
                      className={`${inputCls} min-w-0 flex-1`}
                      value={form.vars[name]}
                      placeholder={VAR_SAMPLES[name] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          vars: { ...f.vars, [name]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-fg-faint">
              This template has no variables to fill in.
            </p>
          )}

          <p className="truncate rounded-md bg-surface-2 px-3 py-2 font-mono text-[11px] text-fg-muted">
            {fromPreview}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={`${btnSecondary} px-4 py-1.5 text-xs`}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${btnPrimary} px-4 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={!canSend}
            onClick={onSend}
          >
            Send test
          </button>
        </div>
      </div>
    </div>
  );
}

export function Editor({ initial, presets, sendConfig }: EditorProps) {
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
  const currentSnapshot = editorSnapshot(name, subject, design);
  const savedSnapshotRef = useRef(currentSnapshot);
  const dirty = currentSnapshot !== savedSnapshotRef.current;

  /* undo/redo stacks of complete persisted snapshots */
  const [past, setPast] = useState<EditorHistorySnapshot[]>([]);
  const [future, setFuture] = useState<EditorHistorySnapshot[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<Device>("desktop");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("rendered");
  const [copyFeedback, setCopyFeedback] = useState<
    "idle" | "copied" | "error"
  >("idle");
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("build");
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [blockSearch, setBlockSearch] = useState("");
  const [smartPrompt, setSmartPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testSend, setTestSend] = useState<TestSendState>({ kind: "idle" });
  const [testForm, setTestForm] = useState<TestForm>({
    fromName: sendConfig.defaultFromName,
    fromLocal: "hello",
    domainId: sendConfig.domains[0]?.id ?? "",
    to: sendConfig.userEmail,
    vars: {},
  });
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragPointerOffsetYRef = useRef<number | null>(null);
  const dragLayoutCacheRef = useRef<DragLayoutCache | null>(null);
  const [insertMenuAt, setInsertMenuAt] = useState<number | null>(null);
  /** The scrollable canvas viewport, for edge auto-scroll while dragging. */
  const canvasScrollRef = useRef<HTMLElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const previewDialogRef = useRef<HTMLDivElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const previewOpenRef = useRef(previewOpen);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const copyRequestRef = useRef(0);
  const previewFrameKeyCleanupRef = useRef<(() => void) | null>(null);
  /** Bumped on every preset pick to remount (reset) the preset Select. */
  const [galleryOpen, setGalleryOpen] = useState(false);

  previewOpenRef.current = previewOpen;

  const closePreview = useCallback((): void => {
    previewOpenRef.current = false;
    copyRequestRef.current += 1;
    previewFrameKeyCleanupRef.current?.();
    previewFrameKeyCleanupRef.current = null;
    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }
    setCopyFeedback("idle");
    setPreviewOpen(false);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // close the template gallery on outside click
  useEffect(() => {
    if (!galleryOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-preset-gallery]")) setGalleryOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [galleryOpen]);

  // Keep keyboard focus inside the modal, lock the page behind it, and return
  // focus to the command-bar trigger after every dismissal path.
  useEffect(() => {
    if (!previewOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      previewCloseRef.current?.focus();
    });

    const onPreviewKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePreview();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = previewDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], iframe, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onPreviewKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onPreviewKeyDown, true);
      copyRequestRef.current += 1;
      previewFrameKeyCleanupRef.current?.();
      previewFrameKeyCleanupRef.current = null;
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
        copyFeedbackTimeoutRef.current = null;
      }
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      previewTriggerRef.current?.focus();
    };
  }, [closePreview, previewOpen]);

  useEffect(() => {
    if (previewOpen && previewTab === "rendered") return;
    previewFrameKeyCleanupRef.current?.();
    previewFrameKeyCleanupRef.current = null;
  }, [previewOpen, previewTab]);

  // Responsive workspace state follows viewport transitions as well as the
  // initial load, keeping drawers and the canvas preview in sync on rotation.
  useEffect(() => {
    const workspaceBreakpoint = window.matchMedia("(max-width: 900px)");
    const propertiesBreakpoint = window.matchMedia("(max-width: 1180px)");
    const deviceBreakpoint = window.matchMedia("(max-width: 720px)");
    const zoomBreakpoint = window.matchMedia("(max-width: 480px)");

    const syncWorkspacePanel = (): void => {
      const next = !workspaceBreakpoint.matches;
      setWorkspacePanelOpen((current) => (current === next ? current : next));
    };
    const syncPropertiesPanel = (): void => {
      const next = !propertiesBreakpoint.matches;
      setPropertiesOpen((current) => (current === next ? current : next));
    };
    const syncDevice = (): void => {
      const next: Device = deviceBreakpoint.matches ? "mobile" : "desktop";
      setDevice((current) => (current === next ? current : next));
    };
    const syncCompactZoom = (): void => {
      setZoom((current) => {
        const target = zoomBreakpoint.matches ? 70 : DEFAULT_ZOOM;
        const next = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, target),
        );
        return current === next ? current : next;
      });
    };

    workspaceBreakpoint.addEventListener("change", syncWorkspacePanel);
    propertiesBreakpoint.addEventListener("change", syncPropertiesPanel);
    deviceBreakpoint.addEventListener("change", syncDevice);
    zoomBreakpoint.addEventListener("change", syncCompactZoom);
    syncWorkspacePanel();
    syncPropertiesPanel();
    syncDevice();
    syncCompactZoom();

    return () => {
      workspaceBreakpoint.removeEventListener("change", syncWorkspacePanel);
      propertiesBreakpoint.removeEventListener("change", syncPropertiesPanel);
      deviceBreakpoint.removeEventListener("change", syncDevice);
      zoomBreakpoint.removeEventListener("change", syncCompactZoom);
    };
  }, []);

  /** Set right before an intentional navigation to suppress beforeunload. */
  const bypassGuard = useRef(false);

  const blocks = design.blocks;
  const styles = design.styles;
  const compiledHtml = compileDesign(design);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const catalog = blockSearch ? searchBlockCatalog(blockSearch) : BLOCK_CATALOG;
  const findings = runPreflight(subject, design);
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.filter(
    (finding) => finding.severity === "warning",
  ).length;
  const preflightScore = Math.max(0, 100 - errorCount * 24 - warningCount * 8);

  /* -------- history-aware commit -------- */

  const restoreSnapshot = (snapshot: EditorHistorySnapshot): void => {
    setName(snapshot.name);
    setSubject(snapshot.subject);
    setDesign(snapshot.design);
  };

  /** Commit a complete persisted snapshot as one undoable change. */
  const commitState = (next: EditorHistorySnapshot): void => {
    if (editorSnapshot(next.name, next.subject, next.design) === currentSnapshot) {
      return;
    }
    const current: EditorHistorySnapshot = { name, subject, design };
    setPast((snapshots) => [
      ...snapshots.slice(-(HISTORY_CAP - 1)),
      current,
    ]);
    setFuture([]);
    restoreSnapshot(next);
  };

  /** Design-only updates still travel through the complete state history. */
  const commit = (next: TemplateDesign): void => {
    commitState({ name, subject, design: next });
  };

  const undo = (): void => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([{ name, subject, design }, ...future].slice(0, HISTORY_CAP));
    restoreSnapshot(prev);
  };

  const redo = (): void => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([
      ...past.slice(-(HISTORY_CAP - 1)),
      { name, subject, design },
    ]);
    restoreSnapshot(next);
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
    const nextStyles = { ...design.styles, ...partial };
    if (JSON.stringify(nextStyles) === JSON.stringify(design.styles)) return;
    commit({ ...design, styles: nextStyles });
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

  const revealBlock = (id: string): void => {
    window.requestAnimationFrame(() => {
      document.getElementById(`builder-block-${id}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
        inline: "nearest",
      });
    });
  };

  const selectAndRevealBlock = (id: string): void => {
    setSelectedId(id);
    setPropertiesOpen(true);
    revealBlock(id);
  };

  const moveLayer = (id: string, direction: -1 | 1): void => {
    moveBlock(id, direction);
    revealBlock(id);
  };

  const composeSmartSection = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const prompt = smartPrompt.trim() || "Launch a new product";
    const normalized = prompt.toLocaleLowerCase();
    const isVerification = /(verify|verification|code|otp|sign.?in)/.test(normalized);
    const isEvent = /(event|webinar|conference|invite|rsvp|meetup)/.test(normalized);

    const heading = defaultBlock("heading") as HeadingBlock;
    const copy = defaultBlock("text") as TextBlock;
    heading.level = 1;

    const section: Block[] = [heading, copy];
    if (isVerification) {
      heading.text = "Your verification code";
      copy.text =
        "Use the secure code below to finish signing in. It expires in 10 minutes.";
      const code = defaultBlock("code") as CodeBlock;
      code.text = "{{code}}";
      section.push(code);
    } else {
      const action = defaultBlock("button") as ButtonBlock;
      action.url = "{{cta_url}}";
      if (isEvent) {
        heading.text = "You’re invited";
        copy.text =
          prompt === "Invite people to an event"
            ? "Join us for a focused session with practical ideas, live examples, and time for questions."
            : prompt;
        action.text = "Save my seat";
      } else {
        heading.text = "Meet what’s next";
        copy.text =
          prompt === "Launch a new product"
            ? "A faster, clearer way to get meaningful work done is here. See what changed and why it matters."
            : prompt;
        action.text = "Explore the launch";
      }
      section.push(action);
    }

    commit({ ...design, blocks: [...design.blocks, ...section] });
    setSelectedId(heading.id);
    setPropertiesOpen(true);
    setSmartPrompt("");
    revealBlock(heading.id);
  };

  const handleFindingClick = (finding: PreflightFinding): void => {
    if (finding.blockId) {
      setSelectedId(finding.blockId);
      setPropertiesOpen(true);
      revealBlock(finding.blockId);
      return;
    }
    if (finding.code === "subject-empty") {
      subjectInputRef.current?.focus();
      return;
    }
    if (finding.code === "content-empty") {
      setWorkspaceTab("build");
      setWorkspacePanelOpen(true);
      return;
    }
    if (finding.code === "unsubscribe-missing") {
      setWorkspaceTab("build");
      setWorkspacePanelOpen(true);
      setBlockSearch("footer");
      return;
    }
    setSelectedId(null);
    setPropertiesOpen(true);
  };

  const handleWorkspaceTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    tabId: WorkspaceTab,
  ): void => {
    const currentIndex = WORKSPACE_TABS.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;

    let nextIndex: number;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowLeft":
        nextIndex =
          (currentIndex - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
        break;
      case "ArrowDown":
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % WORKSPACE_TABS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = WORKSPACE_TABS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = WORKSPACE_TABS[nextIndex];
    setWorkspaceTab(nextTab.id);
    setWorkspacePanelOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById(`builder-tab-${nextTab.id}`)?.focus();
    });
  };

  /* -------- drag & drop (palette insert + block reorder) -------- */

  const setDragOverIndex = (next: number | null): void => {
    setDrag((d) => (d && d.overIndex !== next ? { ...d, overIndex: next } : d));
  };

  /** True when the insertion line should render at insertion index `i`. */
  const showDropAt = (i: number): boolean => {
    if (!drag || drag.overIndex !== i) return false;
    if (drag.type !== "move") return true;
    const from = blocks.findIndex((block) => block.id === drag.payload);
    // Moving a block right back where it came from is a no-op — hide the line.
    return i !== from && i !== from + 1;
  };

  const cacheDragLayout = (): void => {
    const canvas = canvasScrollRef.current;
    if (!canvas) {
      dragLayoutCacheRef.current = null;
      return;
    }

    const items: DragLayoutItem[] = [];
    const wrappers = canvas.querySelectorAll<HTMLElement>("[data-block-wrapper]");
    for (const wrapper of wrappers) {
      const index = Number(wrapper.dataset.blockIndex);
      const blockId = wrapper.dataset.blockId;
      if (!Number.isInteger(index) || !blockId) continue;
      const rect = wrapper.getBoundingClientRect();
      items.push({
        blockId,
        index,
        midpoint: rect.top + rect.height / 2,
      });
    }

    dragLayoutCacheRef.current = {
      initialScrollTop: canvas.scrollTop,
      items,
    };
  };

  const resetDrag = (): void => {
    dragLayoutCacheRef.current = null;
    dragPointerOffsetYRef.current = null;
    setDrag(null);
  };

  const dragVerticalPosition = (
    event: Pick<DragMoveEvent, "active">,
  ): number | null => {
    const activeRect =
      event.active.rect.current.translated ?? event.active.rect.current.initial;
    if (!activeRect) return null;
    const pointerOffset = dragPointerOffsetYRef.current;
    return pointerOffset === null
      ? activeRect.top + activeRect.height / 2
      : activeRect.top + pointerOffset;
  };

  const insertionIndexFor = (
    event: Pick<DragMoveEvent, "active" | "over">,
    activeData: PaletteDragData | BlockDragData,
  ): number | null => {
    if (!event.over) return null;
    const overData = dragData(event.over.data.current);

    if (overData?.kind === "block") {
      const overIndex = blocks.findIndex((block) => block.id === overData.blockId);
      if (overIndex < 0) return null;

      if (activeData.kind === "block") {
        const activeIndex = blocks.findIndex(
          (block) => block.id === activeData.blockId,
        );
        if (activeIndex < 0 || activeIndex === overIndex) return activeIndex;
        if (dragPointerOffsetYRef.current !== null) {
          const pointerY = dragVerticalPosition(event);
          if (pointerY !== null) {
            const overCenter = event.over.rect.top + event.over.rect.height / 2;
            return pointerY >= overCenter ? overIndex + 1 : overIndex;
          }
        }
        // reorderBlocks accepts an insertion point in the original list. To
        // make keyboard movement deterministic, downward moves insert after
        // the target and upward moves insert before it.
        return activeIndex < overIndex ? overIndex + 1 : overIndex;
      }

      const pointerY = dragVerticalPosition(event);
      if (pointerY === null) return overIndex;
      const overCenter = event.over.rect.top + event.over.rect.height / 2;
      return pointerY >= overCenter ? overIndex + 1 : overIndex;
    }

    if (overData?.kind !== "canvas") return null;
    if (blocks.length === 0) return 0;

    const pointerY = dragVerticalPosition(event);
    if (pointerY === null) return blocks.length;
    const layout = dragLayoutCacheRef.current;
    if (!layout) return null;
    const scrollDelta =
      (canvasScrollRef.current?.scrollTop ?? layout.initialScrollTop) -
      layout.initialScrollTop;

    for (const item of layout.items) {
      if (activeData.kind === "block" && item.blockId === activeData.blockId) {
        continue;
      }
      if (pointerY < item.midpoint - scrollDelta) return item.index;
    }
    return blocks.length;
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const data = dragData(active.data.current);
      if (data?.kind === "palette") {
        return `Picked up ${data.label}. Move to the template canvas, then press Space to add it.`;
      }
      if (data?.kind === "block") {
        return `Picked up ${data.label} at position ${data.index + 1}.`;
      }
      return "Picked up draggable item.";
    },
    onDragMove({ active, over }) {
      const data = dragData(active.data.current);
      if (data?.kind !== "palette" && data?.kind !== "block") return undefined;
      const insertionIndex = insertionIndexFor({ active, over }, data);
      if (insertionIndex === null) return "No longer over the template canvas.";
      return `${data.kind === "palette" ? "Insert" : "Move"} at position ${insertionIndex + 1}.`;
    },
    onDragOver({ active, over }) {
      const data = dragData(active.data.current);
      if (data?.kind !== "palette" && data?.kind !== "block") return undefined;
      const insertionIndex = insertionIndexFor({ active, over }, data);
      if (insertionIndex === null) return "No longer over the template canvas.";
      return `${data.kind === "palette" ? "Insert" : "Move"} at position ${insertionIndex + 1}.`;
    },
    onDragEnd({ active, over }) {
      const data = dragData(active.data.current);
      if (data?.kind !== "palette" && data?.kind !== "block") {
        return "Drag ended with no change.";
      }
      const insertionIndex = insertionIndexFor({ active, over }, data);
      if (insertionIndex === null) {
        return "Drag ended outside the template canvas. No changes made.";
      }
      if (data.kind === "palette") {
        return `Added ${data.label} at position ${insertionIndex + 1}.`;
      }
      const activeIndex = blocks.findIndex((block) => block.id === data.blockId);
      if (activeIndex < 0) return "Drag ended with no change.";
      if (
        insertionIndex === activeIndex ||
        insertionIndex === activeIndex + 1
      ) {
        return `No change. ${data.label} remains at position ${activeIndex + 1}.`;
      }
      const finalIndex =
        insertionIndex > activeIndex ? insertionIndex - 1 : insertionIndex;
      return `Moved ${data.label} to position ${finalIndex + 1}.`;
    },
    onDragCancel({ active }) {
      const data = dragData(active.data.current);
      const label =
        data?.kind === "palette" || data?.kind === "block" ? data.label : "item";
      return `Cancelled dragging ${label}. No changes made.`;
    },
  };

  const handleDragStart = (event: DragStartEvent): void => {
    const data = dragData(event.active.data.current);
    const initialRect = event.active.rect.current.initial;
    const clientY = activatorClientY(event.activatorEvent);
    dragPointerOffsetYRef.current =
      initialRect && clientY !== null ? clientY - initialRect.top : null;
    cacheDragLayout();
    setInsertMenuAt(null);
    if (data?.kind === "palette") {
      setDrag({
        type: "new",
        payload: data.blockType,
        label: data.label,
        overIndex: null,
      });
      return;
    }
    if (data?.kind === "block") {
      setSelectedId(data.blockId);
      setDrag({
        type: "move",
        payload: data.blockId,
        label: data.label,
        overIndex: null,
      });
    }
  };

  const handleDragPosition = (event: DragMoveEvent): void => {
    const data = dragData(event.active.data.current);
    if (data?.kind !== "palette" && data?.kind !== "block") return;
    setDragOverIndex(insertionIndexFor(event, data));
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const data = dragData(event.active.data.current);
    if (data?.kind !== "palette" && data?.kind !== "block") {
      resetDrag();
      return;
    }

    const insertionIndex = insertionIndexFor(event, data) ?? drag?.overIndex ?? null;
    if (event.over && insertionIndex !== null) {
      if (data.kind === "palette") {
        insertBlockAt(data.blockType, insertionIndex);
      } else {
        const reordered = reorderBlocks(
          design.blocks,
          data.blockId,
          insertionIndex,
        );
        if (reordered !== design.blocks) commit({ ...design, blocks: reordered });
      }
    }
    resetDrag();
  };

  /* -------- presets -------- */

  const applyPreset = (key: string): void => {
    const preset = presets.find((p) => p.key === key);
    if (!preset) return;
    // Confirm when anything would be lost: existing blocks or unsaved edits.
    if (
      (blocks.length > 0 || dirty) &&
      !window.confirm(`Replace the current design with the “${preset.name}” preset?`)
    ) {
      return;
    }
    // Deep-clone so preset objects are never mutated by editing.
    commitState({
      name,
      subject: preset.subject,
      design: JSON.parse(JSON.stringify(preset.design)) as TemplateDesign,
    });
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
        bypassGuard.current = true;
        savedSnapshotRef.current = currentSnapshot;
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

  /* -------- compiled preview & export -------- */

  const openPreview = (): void => {
    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }
    previewOpenRef.current = true;
    setGalleryOpen(false);
    setPreviewDevice(device);
    setPreviewTab("rendered");
    setCopyFeedback("idle");
    setPreviewOpen(true);
  };

  const handlePreviewTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    current: PreviewTab,
  ): void => {
    let next: PreviewTab | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      next = current === "rendered" ? "source" : "rendered";
    } else if (event.key === "Home") {
      next = "rendered";
    } else if (event.key === "End") {
      next = "source";
    }
    if (!next) return;

    event.preventDefault();
    setPreviewTab(next);
    window.requestAnimationFrame(() => {
      document.getElementById(`builder-preview-tab-${next}`)?.focus();
    });
  };

  const bindPreviewFrameKeyboard = (frame: HTMLIFrameElement): void => {
    previewFrameKeyCleanupRef.current?.();
    previewFrameKeyCleanupRef.current = null;

    let frameDocument: Document | null = null;
    try {
      frameDocument = frame.contentDocument;
    } catch {
      // The compiled srcDoc is same-origin. If navigation ever replaces it,
      // leave the inaccessible document isolated rather than weakening sandboxing.
      return;
    }
    if (!frameDocument) return;

    const onFrameKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePreview();
        return;
      }
      if (event.key !== "Tab") return;

      const frameFocusables = Array.from(
        frameDocument.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const active = frameDocument.activeElement;
      const first = frameFocusables[0];
      const last = frameFocusables[frameFocusables.length - 1];
      const leavesBackward =
        event.shiftKey && (frameFocusables.length === 0 || active === first);
      const leavesForward =
        !event.shiftKey && (frameFocusables.length === 0 || active === last);
      if (!leavesBackward && !leavesForward) return;

      const dialog = previewDialogRef.current;
      if (!dialog) return;
      const parentFocusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element !== frame && !element.hasAttribute("hidden"));
      const destination = event.shiftKey
        ? parentFocusables[parentFocusables.length - 1]
        : parentFocusables[0];
      if (!destination) return;

      event.preventDefault();
      destination.focus();
    };

    // Keep links from replacing the srcDoc; export/test-send are the intentional
    // ways to exercise the final email outside this isolated visual preview.
    const onFrameClick = (event: MouseEvent): void => {
      const target = event.target as Element | null;
      if (typeof target?.closest === "function" && target.closest("a[href]")) {
        event.preventDefault();
      }
    };

    frameDocument.addEventListener("keydown", onFrameKeyDown);
    frameDocument.addEventListener("click", onFrameClick);
    previewFrameKeyCleanupRef.current = () => {
      frameDocument?.removeEventListener("keydown", onFrameKeyDown);
      frameDocument?.removeEventListener("click", onFrameClick);
    };
  };

  const copyCompiledHtml = async (): Promise<void> => {
    const requestId = ++copyRequestRef.current;
    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }
    setCopyFeedback("idle");

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
      }
      await navigator.clipboard.writeText(compiledHtml);
      if (requestId !== copyRequestRef.current) return;
      setCopyFeedback("copied");
    } catch {
      if (requestId !== copyRequestRef.current) return;
      setPreviewTab("source");
      setCopyFeedback("error");
    }

    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      if (requestId === copyRequestRef.current) setCopyFeedback("idle");
      copyFeedbackTimeoutRef.current = null;
    }, 3200);
  };

  const downloadCompiledHtml = (): void => {
    const safeStem = name
      .trim()
      .replace(/\.html?$/i, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    const fileName = `${safeStem || "sendthen-template"}.html`;
    const url = URL.createObjectURL(
      new Blob([compiledHtml], { type: "text/html;charset=utf-8" }),
    );
    const link = document.createElement("a");

    try {
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.append(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  };

  /* -------- send test -------- */

  // Open the dialog, seeding variable values with sensible sample defaults for
  // exactly the variables this template uses.
  const openTestForm = (): void => {
    const names = collectVars(subject, design);
    setTestForm((f) => ({
      ...f,
      // keep the user's from/to/name if they set them earlier this session,
      // but re-derive the default domain if it's gone stale.
      domainId:
        sendConfig.domains.some((d) => d.id === f.domainId) && f.domainId
          ? f.domainId
          : (sendConfig.domains[0]?.id ?? ""),
      vars: Object.fromEntries(
        names.map((n) => [n, f.vars[n] ?? VAR_SAMPLES[n] ?? ""]),
      ),
    }));
    setTestSend({ kind: "form" });
  };

  const submitTestSend = async (): Promise<void> => {
    setTestSend({ kind: "sending" });
    try {
      const fd = new FormData();
      fd.set("subject", subject);
      fd.set("design", JSON.stringify(design));
      fd.set("to", testForm.to.trim());
      fd.set("from_name", testForm.fromName.trim());
      fd.set("from_local", testForm.fromLocal.trim());
      fd.set("domain_id", testForm.domainId);
      fd.set("vars", JSON.stringify(testForm.vars));
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
        if (previewOpenRef.current) return;
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

  const emailViewportWidth = device === "desktop" ? 720 : 375;
  const pageGutter = device === "desktop" ? 96 : 32;
  const cardWidth = Math.min(styles.contentWidth, emailViewportWidth - pageGutter);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const activeWorkspace =
    WORKSPACE_TABS.find((tab) => tab.id === workspaceTab) ?? WORKSPACE_TABS[0];
  const saveStatus = saving
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : initial?.id
        ? "Draft saved"
        : "New draft";
  const selectedLabel = selected ? getLayerLabel(selected) : "Global email styles";

  const zoomOut = (): void => {
    setZoom((current) =>
      Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current - 10)),
    );
  };
  const zoomIn = (): void => {
    setZoom((current) =>
      Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + 10)),
    );
  };
  const fitCanvas = (): void => {
    const available = Math.max(240, (canvasScrollRef.current?.clientWidth ?? 800) - 96);
    const fitted = Math.floor((available / emailViewportWidth) * 100 / 5) * 5;
    setZoom(() => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitted)));
  };

  return (
    <div
      className={`builder-studio flex h-dvh flex-col bg-bg text-fg ${
        drag ? "is-dragging" : ""
      }`}
    >
      <a href="#template-canvas" className="builder-skip-link">
        Skip to canvas
      </a>
      <h1 className="sr-only">Template builder</h1>
      {/* ---------------- Command bar ---------------- */}
      <header className="builder-command-bar">
        <div className="builder-command-identity">
          <a
            href="/templates"
            onClick={handleCancelClick}
            aria-label="Back to templates"
            className="builder-back-button"
          >
            <span aria-hidden className="text-lg leading-none">
              ←
            </span>
            <span className="builder-command-label-optional">Templates</span>
          </a>

          <div className="builder-document-fields">
            <input
              type="text"
              name="template-name"
              autoComplete="off"
              aria-label="Template name"
              className="builder-name-input"
              value={name}
              placeholder="Untitled template…"
              onChange={(event) =>
                commitState({ name: event.target.value, subject, design })
              }
            />
            <div className="builder-subject-row">
              <span aria-hidden>Subject</span>
              <input
                ref={subjectInputRef}
                type="text"
                name="template-subject"
                autoComplete="off"
                aria-label="Email subject"
                value={subject}
                placeholder="Add a subject line… {{variables}} supported"
                onChange={(event) =>
                  commitState({ name, subject: event.target.value, design })
                }
              />
            </div>
          </div>
        </div>

        <div className="builder-command-actions">
          <div
            role="status"
            title={saveStatus}
            className={`builder-save-status ${
              saving
                ? "is-saving"
                : dirty
                  ? "is-dirty"
                  : initial?.id
                    ? "is-saved"
                    : "is-new"
            }`}
          >
            <span aria-hidden className="builder-save-status-dot" />
            <span>{saveStatus}</span>
          </div>

          <div className="builder-undo-group" role="group" aria-label="Edit history">
            <button
              type="button"
              title="Undo (⌘Z)"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
            >
              ↶
            </button>
            <button
              type="button"
              title="Redo (⌘⇧Z)"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
            >
              ↷
            </button>
          </div>

          <div className="relative" data-preset-gallery>
            <button
              type="button"
              onClick={() => setGalleryOpen((open) => !open)}
              aria-expanded={galleryOpen}
              aria-label="Open templates"
              className={`${btnSecondary} builder-command-button whitespace-nowrap px-3`}
            >
              <span aria-hidden>▦</span>
              <span className="builder-command-label-optional">Templates</span>
            </button>
            {galleryOpen ? (
              <div className="builder-template-popover">
                <div className="mb-2 px-1 text-xs font-medium tracking-wide text-fg-muted">
                  Start from a template
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  <PresetGrid
                    presets={presets}
                    onApply={(key) => {
                      setGalleryOpen(false);
                      applyPreset(key);
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <button
            ref={previewTriggerRef}
            type="button"
            aria-label="Preview"
            title="Open compiled preview and export"
            onClick={openPreview}
            className={`${btnSecondary} builder-command-button whitespace-nowrap px-3`}
          >
            <span aria-hidden>◫</span>
            <span className="builder-command-label-optional">Preview</span>
          </button>
          <button
            type="button"
            aria-label={testSend.kind === "sending" ? "Sending test" : "Send test"}
            className={`${btnSecondary} builder-command-button whitespace-nowrap px-3 disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={testSend.kind === "sending"}
            onClick={openTestForm}
          >
            <span aria-hidden>↗</span>
            <span className="builder-command-label-optional">
              {testSend.kind === "sending" ? "Sending…" : "Send test"}
            </span>
          </button>
          <button
            type="button"
            className={`${btnPrimary} builder-command-button builder-save-button whitespace-nowrap px-4 disabled:cursor-not-allowed disabled:opacity-60`}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            <span aria-hidden>{saving ? "…" : "✓"}</span>
            <span>Save</span>
          </button>
        </div>
      </header>

      {/* ---------------- Compiled preview & export ---------------- */}
      {previewOpen ? (
        <div
          className="builder-preview-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <div
            ref={previewDialogRef}
            className="builder-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="builder-preview-heading"
            aria-describedby="builder-preview-description"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="builder-preview-header">
              <div className="builder-preview-title">
                <span className="builder-preview-eyebrow">Live compiled output</span>
                <h2 id="builder-preview-heading">Preview &amp; export</h2>
                <p id="builder-preview-description">
                  {blocks.length} {blocks.length === 1 ? "block" : "blocks"} ·{" "}
                  {compiledHtml.length} HTML characters · updates with your design
                </p>
              </div>
              <button
                ref={previewCloseRef}
                type="button"
                className="builder-preview-close"
                aria-label="Close preview"
                onClick={closePreview}
              >
                <span aria-hidden>×</span>
                <span>Close</span>
              </button>
            </header>

            <div className="builder-preview-toolbar">
              <div
                role="group"
                aria-label="Preview frame"
                className="builder-preview-device"
              >
                <button
                  type="button"
                  className={previewDevice === "desktop" ? "is-active" : ""}
                  aria-pressed={previewDevice === "desktop"}
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <span aria-hidden>▱</span>
                  Desktop
                </button>
                <button
                  type="button"
                  className={previewDevice === "mobile" ? "is-active" : ""}
                  aria-pressed={previewDevice === "mobile"}
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <span aria-hidden>▯</span>
                  Mobile
                </button>
              </div>

              <div
                role="tablist"
                aria-label="Preview format"
                className="builder-preview-tabs"
              >
                <button
                  id="builder-preview-tab-rendered"
                  type="button"
                  role="tab"
                  aria-selected={previewTab === "rendered"}
                  aria-controls="builder-preview-panel-rendered"
                  tabIndex={previewTab === "rendered" ? 0 : -1}
                  className={previewTab === "rendered" ? "is-active" : ""}
                  onClick={() => setPreviewTab("rendered")}
                  onKeyDown={(event) =>
                    handlePreviewTabKeyDown(event, "rendered")
                  }
                >
                  Rendered
                </button>
                <button
                  id="builder-preview-tab-source"
                  type="button"
                  role="tab"
                  aria-selected={previewTab === "source"}
                  aria-controls="builder-preview-panel-source"
                  tabIndex={previewTab === "source" ? 0 : -1}
                  className={previewTab === "source" ? "is-active" : ""}
                  onClick={() => setPreviewTab("source")}
                  onKeyDown={(event) => handlePreviewTabKeyDown(event, "source")}
                >
                  HTML source
                </button>
              </div>

              <div className="builder-preview-export">
                <span
                  className={`builder-preview-feedback is-${copyFeedback}`}
                  role={copyFeedback === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {copyFeedback === "copied"
                    ? "Copied to clipboard"
                    : copyFeedback === "error"
                      ? "Copy failed — source opened"
                      : ""}
                </span>
                <button
                  type="button"
                  className="builder-preview-action"
                  onClick={() => void copyCompiledHtml()}
                >
                  <span aria-hidden>{copyFeedback === "copied" ? "✓" : "⧉"}</span>
                  Copy HTML
                </button>
                <button
                  type="button"
                  className="builder-preview-action is-primary"
                  onClick={downloadCompiledHtml}
                >
                  <span aria-hidden>↓</span>
                  Download .html
                </button>
              </div>
            </div>

            <div className="builder-preview-workspace">
              {previewTab === "rendered" ? (
                <div
                  id="builder-preview-panel-rendered"
                  role="tabpanel"
                  aria-labelledby="builder-preview-tab-rendered"
                  className="builder-preview-rendered"
                >
                  <div
                    className={`builder-preview-frame is-${previewDevice}`}
                    aria-label={`${previewDevice === "desktop" ? "Desktop" : "Mobile"} compiled email frame`}
                  >
                    <div className="builder-preview-frame-bar" aria-hidden>
                      <span className="builder-preview-frame-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>
                        {previewDevice === "desktop" ? "Desktop" : "Mobile"} email
                        client
                      </span>
                      <span>Sandboxed</span>
                    </div>
                    <iframe
                      title={`Compiled email preview for ${name.trim() || "Untitled template"}`}
                      sandbox="allow-same-origin"
                      srcDoc={compiledHtml}
                      referrerPolicy="no-referrer"
                      onLoad={(event) =>
                        bindPreviewFrameKeyboard(event.currentTarget)
                      }
                    />
                  </div>
                </div>
              ) : (
                <div
                  id="builder-preview-panel-source"
                  role="tabpanel"
                  aria-labelledby="builder-preview-tab-source"
                  className="builder-preview-source"
                >
                  <pre tabIndex={0} aria-label="Compiled HTML source">
                    <code>{compiledHtml}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------- Send-test dialog ---------------- */}
      {testSend.kind === "form" ? (
        <TestSendDialog
          form={testForm}
          setForm={setTestForm}
          domains={sendConfig.domains}
          onCancel={() => setTestSend({ kind: "idle" })}
          onSend={() => void submitTestSend()}
        />
      ) : null}

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

      {error ? (
        <div role="alert" className="builder-save-error" title={error}>
          <span aria-hidden>!</span>
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" aria-label="Dismiss save error" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        collisionDetection={editorCollisionDetection}
        autoScroll={{
          threshold: { x: 0.15, y: 0.2 },
          acceleration: 10,
          interval: 5,
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragPosition}
        onDragOver={handleDragPosition}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDrag}
      >
        <div className="builder-studio-workspace">
          {/* ---------------- Workspace rail ---------------- */}
          <nav
            aria-label="Builder workspace"
            className="builder-mode-rail"
          >
            <div
              className="builder-mode-tabs"
              role="tablist"
              aria-label="Builder modes"
              aria-orientation="vertical"
            >
              {WORKSPACE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`builder-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === tab.id}
                  aria-controls="builder-workspace-panel"
                  title={tab.label}
                  tabIndex={workspaceTab === tab.id ? 0 : -1}
                  onKeyDown={(event) => handleWorkspaceTabKeyDown(event, tab.id)}
                  onClick={() => {
                    setWorkspaceTab(tab.id);
                    setWorkspacePanelOpen(true);
                  }}
                  className={`builder-mode-tab ${
                    workspaceTab === tab.id ? "is-active" : ""
                  }`}
                >
                  <span aria-hidden className="builder-mode-glyph">
                    {tab.glyph}
                  </span>
                  <span>{tab.label}</span>
                  {tab.id === "review" && findings.length > 0 ? (
                    <span className="builder-mode-badge">{findings.length}</span>
                  ) : null}
                </button>
              ))}
            </div>
            {!workspacePanelOpen ? (
              <button
                type="button"
                aria-label="Show block library"
                aria-controls="builder-context-panel"
                aria-expanded={workspacePanelOpen}
                title="Show block library"
                onClick={() => setWorkspacePanelOpen(true)}
                className="builder-show-library"
              >
                <span aria-hidden>→</span>
                <span className="sr-only">Show block library</span>
              </button>
            ) : null}
          </nav>

          {/* ---------------- Context workspace ---------------- */}
          {workspacePanelOpen ? (
            <aside
              id="builder-context-panel"
              className="builder-context-panel"
              aria-label={`${activeWorkspace.label} tools`}
            >
              <div className="builder-panel-heading">
                <div className="min-w-0">
                  <h2>{activeWorkspace.label}</h2>
                  <p>{activeWorkspace.description}</p>
                </div>
                <button
                  type="button"
                  aria-label="Hide block library"
                  aria-controls="builder-context-panel"
                  aria-expanded={workspacePanelOpen}
                  title="Hide panel"
                  onClick={() => setWorkspacePanelOpen(false)}
                >
                  ←
                </button>
              </div>

              <div
                id="builder-workspace-panel"
                role="tabpanel"
                aria-labelledby={`builder-tab-${workspaceTab}`}
                className="builder-panel-scroll"
              >
                {workspaceTab === "build" ? (
                  <div className="space-y-5">
                    <div className="builder-search-wrap">
                      <span aria-hidden>⌕</span>
                      <input
                        type="search"
                        name="block-search"
                        autoComplete="off"
                        aria-label="Search blocks"
                        value={blockSearch}
                        placeholder="Search blocks…"
                        onChange={(event) => setBlockSearch(event.target.value)}
                      />
                      {blockSearch ? (
                        <button
                          type="button"
                          aria-label="Clear block search"
                          onClick={() => setBlockSearch("")}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>

                    <form className="builder-smart-section" onSubmit={composeSmartSection}>
                      <div className="builder-smart-heading">
                        <span aria-hidden>✦</span>
                        <div>
                          <h3>Smart section</h3>
                          <p>Local composer · editable blocks</p>
                        </div>
                      </div>
                      <label htmlFor="builder-smart-prompt">
                        Describe the section
                      </label>
                      <textarea
                        id="builder-smart-prompt"
                        name="smart-section-prompt"
                        autoComplete="off"
                        value={smartPrompt}
                        rows={3}
                        placeholder="e.g. Announce our summer product launch…"
                        onChange={(event) => setSmartPrompt(event.target.value)}
                      />
                      <div
                        className="builder-prompt-chips"
                        role="group"
                        aria-label="Prompt ideas"
                      >
                        {[
                          ["Launch", "Launch a new product"],
                          ["Event", "Invite people to an event"],
                          ["Verification", "Share a verification code"],
                        ].map(([label, prompt]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setSmartPrompt(prompt)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button type="submit" className="builder-compose-button">
                        <span aria-hidden>＋</span>
                        Create section
                      </button>
                      <p className="builder-smart-note">
                        Nothing leaves this page. The result uses the same editable blocks
                        as the library.
                      </p>
                    </form>

                    <div className="builder-catalog">
                      {catalog.length === 0 ? (
                        <div className="builder-panel-empty">
                          <span aria-hidden>⌕</span>
                          <strong>No blocks found</strong>
                          <p>Try “image”, “layout”, or “code”.</p>
                        </div>
                      ) : (
                        catalog.map((group) => (
                          <section key={group.id} aria-labelledby={`catalog-${group.id}`}>
                            <div className="builder-section-title">
                              <h3 id={`catalog-${group.id}`}>{group.label}</h3>
                              <span>{group.items.length}</span>
                            </div>
                            <div className="space-y-2">
                              {group.items.map((item) => {
                                const glyph =
                                  PALETTE.find((entry) => entry.type === item.type)?.glyph ??
                                  "+";
                                return (
                                  <PaletteBlockButton
                                    key={item.type}
                                    entry={{ ...item, glyph }}
                                    onAdd={addBlock}
                                  />
                                );
                              })}
                            </div>
                          </section>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                {workspaceTab === "layers" ? (
                  <div>
                    <div className="builder-section-title mb-3">
                      <h3>Document order</h3>
                      <span>{blocks.length}</span>
                    </div>
                    {blocks.length === 0 ? (
                      <div className="builder-panel-empty">
                        <span aria-hidden>☷</span>
                        <strong>No layers yet</strong>
                        <p>Add a block in Build to begin.</p>
                      </div>
                    ) : (
                      <ol className="builder-layer-list">
                        {blocks.map((block, index) => {
                          const glyph =
                            PALETTE.find((entry) => entry.type === block.type)?.glyph ??
                            "•";
                          return (
                            <li
                              key={block.id}
                              className={block.id === selectedId ? "is-selected" : ""}
                            >
                              <button
                                type="button"
                                aria-pressed={block.id === selectedId}
                                onClick={() => selectAndRevealBlock(block.id)}
                                className="builder-layer-select"
                              >
                                <span className="builder-layer-order">{index + 1}</span>
                                <span aria-hidden className="builder-layer-glyph">
                                  {glyph}
                                </span>
                                <span className="builder-layer-label">
                                  {getLayerLabel(block)}
                                </span>
                              </button>
                              <div className="builder-layer-actions">
                                <button
                                  type="button"
                                  aria-label={`Move ${getLayerLabel(block)} up`}
                                  disabled={index === 0}
                                  onClick={() => moveLayer(block.id, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move ${getLayerLabel(block)} down`}
                                  disabled={index === blocks.length - 1}
                                  onClick={() => moveLayer(block.id, 1)}
                                >
                                  ↓
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                ) : null}

                {workspaceTab === "brand" ? (
                  <div>
                    <p className="builder-panel-intro">
                      Apply color, type, and width together. Every theme is one undoable
                      change.
                    </p>
                    <div className="builder-brand-list">
                      {BRAND_THEMES.map((theme) => {
                        const active = (
                          Object.keys(theme.styles) as (keyof GlobalStyles)[]
                        ).every((key) => styles[key] === theme.styles[key]);
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            aria-pressed={active}
                            aria-label={`Apply ${theme.name} theme`}
                            onClick={() => patchStyles(theme.styles)}
                            className={active ? "is-active" : ""}
                          >
                            <span className="builder-brand-preview" aria-hidden>
                              <span style={{ background: theme.swatches[0] }} />
                              <span style={{ background: theme.swatches[1] }} />
                              <span style={{ background: theme.swatches[2] }} />
                            </span>
                            <span className="builder-brand-copy">
                              <strong>{theme.name}</strong>
                              <span>{theme.summary}</span>
                            </span>
                            <span className="builder-brand-state">
                              {active ? "Current" : "Apply"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {workspaceTab === "review" ? (
                  <div>
                    <div className="builder-preflight-card">
                      <div
                        className="builder-score-ring"
                        style={{ "--builder-score": `${preflightScore}%` } as React.CSSProperties}
                      >
                        <strong>{preflightScore}</strong>
                        <span>/100</span>
                      </div>
                      <div>
                        <p className="builder-preflight-label">Preflight score</p>
                        <p>
                          {errorCount} {errorCount === 1 ? "error" : "errors"} ·{" "}
                          {warningCount} {warningCount === 1 ? "warning" : "warnings"}
                        </p>
                      </div>
                    </div>

                    {findings.length === 0 ? (
                      <div className="builder-review-healthy">
                        <span aria-hidden>✓</span>
                        <strong>Ready to send</strong>
                        <p>No deliverability or content issues found.</p>
                      </div>
                    ) : (
                      <div className="builder-finding-list">
                        {findings.map((finding) => (
                          <button
                            key={finding.id}
                            type="button"
                            onClick={() => handleFindingClick(finding)}
                            className={`is-${finding.severity}`}
                          >
                            <span className="builder-finding-severity" aria-hidden>
                              {finding.severity === "error"
                                ? "!"
                                : finding.severity === "warning"
                                  ? "△"
                                  : "i"}
                            </span>
                            <span className="builder-finding-copy">
                              <strong>{finding.title}</strong>
                              <span>{finding.message}</span>
                              <em>{finding.action} →</em>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}

          {/* ---------------- Canvas ---------------- */}
          <CanvasDropZone
            scrollRef={canvasScrollRef}
            backgroundColor={styles.backgroundColor}
            active={drag !== null}
            onClear={() => {
              setSelectedId(null);
              setInsertMenuAt(null);
            }}
          >
            <div className="builder-canvas-toolbar" onClick={(event) => event.stopPropagation()}>
              <div className="builder-canvas-breadcrumb" aria-label="Current canvas location">
                <span>Email</span>
                <span aria-hidden>/</span>
                <span>Body</span>
                {selected ? (
                  <>
                    <span aria-hidden>/</span>
                    <strong>{getLayerLabel(selected)}</strong>
                  </>
                ) : null}
              </div>

              <div className="builder-canvas-controls">
                <div role="group" aria-label="Preview device" className="builder-device-control">
                  <button
                    type="button"
                    aria-pressed={device === "desktop"}
                    onClick={() => setDevice("desktop")}
                  >
                    <span aria-hidden>▱</span>
                    Desktop
                  </button>
                  <button
                    type="button"
                    aria-pressed={device === "mobile"}
                    onClick={() => setDevice("mobile")}
                  >
                    <span aria-hidden>▯</span>
                    Mobile
                  </button>
                </div>

                <div role="group" aria-label="Canvas zoom" className="builder-zoom-control">
                  <button type="button" aria-label="Zoom out" onClick={zoomOut}>
                    −
                  </button>
                  <span aria-live="polite">{zoom}%</span>
                  <button type="button" aria-label="Zoom in" onClick={zoomIn}>
                    +
                  </button>
                  <button type="button" onClick={fitCanvas}>
                    Fit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setZoom(() =>
                        Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, DEFAULT_ZOOM)),
                      )
                    }
                  >
                    100%
                  </button>
                </div>
              </div>
            </div>

            <div className="builder-canvas-content">
              <div
                className="builder-email-viewport"
                aria-label={`${device === "desktop" ? "Desktop" : "Mobile"} email canvas at ${zoom}%`}
                style={
                  {
                    width: emailViewportWidth,
                    minHeight: device === "desktop" ? 720 : 680,
                    background: styles.backgroundColor,
                    "--builder-zoom": zoom / 100,
                  } as React.CSSProperties
                }
              >
                <div
                  className="builder-email-card"
                  style={{
                    width: cardWidth,
                    maxWidth: "100%",
                    background: styles.contentBackground,
                    color: styles.textColor,
                    fontFamily: styles.fontFamily,
                    padding: device === "mobile" ? "26px 20px" : "36px 40px",
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {blocks.length === 0 && drag !== null ? (
                    <div
                      className={`builder-empty-drop ${
                        drag.overIndex === 0 ? "is-over" : ""
                      }`}
                    >
                      Drop a block here
                    </div>
                  ) : blocks.length === 0 ? (
                    <>
                      <div
                        className="builder-empty-canvas"
                        style={{ borderColor: `${styles.textColor}30` }}
                      >
                        <span aria-hidden>＋</span>
                        <strong style={{ color: styles.textColor }}>Start creating</strong>
                        <p style={{ color: styles.textColor }}>
                          Drag a block from Build or start from a template.
                        </p>
                      </div>
                      <div className="mt-6">
                        <p
                          className="mb-3 text-center text-xs font-medium tracking-wide"
                          style={{ color: styles.textColor, opacity: 0.62 }}
                        >
                          Ready-made starting points
                        </p>
                        <PresetGrid
                          presets={presets}
                          onApply={applyPreset}
                          columns={device === "mobile" ? 2 : 3}
                        />
                      </div>
                    </>
                  ) : (
                    <SortableContext
                      items={blocks.map((block) => blockDragId(block.id))}
                      strategy={verticalListSortingStrategy}
                    >
                      {blocks.map((block, index) => (
                        <div key={block.id}>
                          <InsertPoint
                            index={index}
                            open={insertMenuAt === index}
                            onToggle={setInsertMenuAt}
                            onInsert={insertBlockAt}
                          />
                          {showDropAt(index) ? <DropIndicator /> : null}
                          <SortableBlock
                            block={block}
                            index={index}
                            total={blocks.length}
                            styles={styles}
                            selected={block.id === selectedId}
                            onSelect={() => {
                              setSelectedId(block.id);
                              setInsertMenuAt(null);
                            }}
                            onMove={(direction) => moveBlock(block.id, direction)}
                            onDuplicate={() => duplicateBlock(block.id)}
                            onDelete={() => deleteBlock(block.id)}
                          />
                          {index === blocks.length - 1 && showDropAt(blocks.length) ? (
                            <DropIndicator />
                          ) : null}
                          {index === blocks.length - 1 ? (
                            <InsertPoint
                              index={blocks.length}
                              open={insertMenuAt === blocks.length}
                              onToggle={setInsertMenuAt}
                              onInsert={insertBlockAt}
                            />
                          ) : null}
                        </div>
                      ))}
                    </SortableContext>
                  )}
                </div>
              </div>
            </div>
          </CanvasDropZone>

          {/* ---------------- Right properties ---------------- */}
          {!propertiesOpen ? (
            <button
              type="button"
              aria-label="Show properties"
              aria-controls="builder-properties-panel"
              aria-expanded={propertiesOpen}
              onClick={() => setPropertiesOpen(true)}
              className="builder-show-properties"
            >
              <span aria-hidden>←</span>
              <span>Show properties</span>
            </button>
          ) : null}

          {propertiesOpen ? (
            <aside
              id="builder-properties-panel"
              className="builder-properties-panel"
              aria-label="Properties"
            >
              <div className="builder-properties-heading">
                <div className="min-w-0">
                  <p>Properties</p>
                  <h2 title={selectedLabel}>{selectedLabel}</h2>
                </div>
                <button
                  type="button"
                  aria-label="Hide properties"
                  aria-controls="builder-properties-panel"
                  aria-expanded={propertiesOpen}
                  title="Hide properties"
                  onClick={() => setPropertiesOpen(false)}
                >
                  →
                </button>
              </div>

              <div className="builder-properties-scroll">
                {selected ? (
                  <div className="space-y-5">
                    <div className="builder-selected-summary">
                      <span className="builder-selected-icon" aria-hidden>
                        {PALETTE.find((entry) => entry.type === selected.type)?.glyph ??
                          "•"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong>{selected.type} block</strong>
                        <span>Selected on canvas</span>
                      </span>
                      <div className="builder-selected-actions">
                        <button
                          type="button"
                          aria-label="Duplicate selected block"
                          title="Duplicate"
                          onClick={() => duplicateBlock(selected.id)}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          aria-label="Delete selected block"
                          title="Delete"
                          onClick={() => deleteBlock(selected.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="builder-global-link"
                      onClick={() => setSelectedId(null)}
                    >
                      <span aria-hidden>←</span>
                      Edit global email styles
                    </button>
                    <BlockInspector block={selected} patch={patch} />
                  </div>
                ) : (
                  <GlobalInspector styles={styles} onChange={patchStyles} />
                )}
              </div>
            </aside>
          ) : null}
        </div>

        <DragOverlay zIndex={70} dropAnimation={null}>
          <DragGhost drag={drag} blocks={blocks} styles={styles} />
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default Editor;
