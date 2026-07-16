import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../components/builder/editor.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("builder editor UI source", () => {
  it("exposes workspace tab controls and block search", () => {
    expect(source).toContain("Build");
    expect(source).toContain("Layers");
    expect(source).toContain("Brand");
    expect(source).toContain("Review");
    expect(source).toContain('role="tablist"');
    expect(source).toMatch(/role=["']tab["']/);
    expect(source).toMatch(
      /onClick=\{\(\)\s*=>\s*\{(?=[\s\S]{0,180}setWorkspaceTab\(tab\.id\))(?=[\s\S]{0,180}setWorkspacePanelOpen\(true\))[\s\S]{0,180}\}\}/,
    );
    expect(source).toContain('aria-label="Search blocks"');
  });

  it("derives save state from the complete persisted baseline", () => {
    expect(source).toContain("New draft");
    expect(source).toMatch(
      /function\s+editorSnapshot\s*\(\s*name:\s*string,\s*subject:\s*string,\s*design:\s*TemplateDesign/,
    );
    expect(source).toMatch(
      /const\s+currentSnapshot\s*=\s*editorSnapshot\s*\(\s*name\s*,\s*subject\s*,\s*design\s*\)/,
    );
    expect(source).toMatch(/savedSnapshotRef\s*=\s*useRef\(currentSnapshot\)/);
    expect(source).toMatch(
      /const\s+dirty\s*=\s*currentSnapshot\s*!==\s*savedSnapshotRef\.current/,
    );
    expect(source).not.toMatch(/\bsetDirty\b/);
    expect(source).toMatch(
      /initial\?\.id\s*\?\s*["']Draft saved["']\s*:\s*["']New draft["']/,
    );
  });

  it("implements keyboard tabs and truthful disclosure state", () => {
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("ArrowUp");
    expect(source).toContain("ArrowDown");
    expect(source).toContain('case "Home"');
    expect(source).toContain('case "End"');
    expect(source).toContain('aria-orientation="vertical"');
    expect(source).toMatch(
      /tabIndex=\{workspaceTab\s*===\s*tab\.id\s*\?\s*0\s*:\s*-1\}/,
    );
    expect(source).toMatch(/onKeyDown=\{\(event\)\s*=>\s*handleWorkspaceTabKeyDown/);
    expect(source).not.toContain(
      "onPointerDown={() => setWorkspacePanelOpen(true)}",
    );
    expect(source.match(/aria-expanded=\{workspacePanelOpen\}/g)).toHaveLength(2);
    expect(source.match(/aria-expanded=\{propertiesOpen\}/g)).toHaveLength(2);
  });

  it("keeps template identity fields editable at compact breakpoints", () => {
    const compact820 = css.slice(
      css.indexOf("@media (max-width: 820px)"),
      css.indexOf("@media (max-width: 720px)"),
    );
    const compact720 = css.slice(
      css.indexOf("@media (max-width: 720px)"),
      css.indexOf("@media (max-width: 480px)"),
    );
    const compact480 = css.slice(css.indexOf("@media (max-width: 480px)"));

    expect(compact720).toMatch(
      /\.builder-subject-row\s*\{[^}]*display:\s*flex/,
    );
    expect(compact720).not.toMatch(
      /\.builder-subject-row\s*\{[^}]*display:\s*none/,
    );
    expect(compact480).toMatch(
      /\.builder-document-fields\s*\{[^}]*display:\s*flex/,
    );
    expect(compact480).not.toMatch(
      /\.builder-document-fields\s*\{[^}]*display:\s*none/,
    );
    expect(compact820).toMatch(
      /\.builder-save-status\s*\{[^}]*display:\s*(?:inline-)?flex/,
    );
    expect(compact820).not.toMatch(
      /\.builder-save-status\s*\{[^}]*display:\s*none/,
    );
    expect(source).toContain("title={saveStatus}");
    expect(source).toContain('className="builder-save-status-dot"');
  });

  it("stores and restores complete persisted history snapshots", () => {
    expect(source).toMatch(
      /interface\s+EditorHistorySnapshot\s*\{(?=[^}]*name:\s*string)(?=[^}]*subject:\s*string)(?=[^}]*design:\s*TemplateDesign)[^}]*\}/,
    );
    expect(
      source.match(/useState<EditorHistorySnapshot\[\]>\(\[\]\)/g),
    ).toHaveLength(2);

    const history = source.slice(
      source.indexOf("history-aware commit"),
      source.indexOf("immutable updaters"),
    );
    expect(history).toMatch(
      /const\s+commitState\s*=\s*\(next:\s*EditorHistorySnapshot\)/,
    );
    expect(history).toMatch(
      /editorSnapshot\(next\.name,\s*next\.subject,\s*next\.design\)\s*===\s*currentSnapshot/,
    );
    expect(history).toContain("setName(snapshot.name)");
    expect(history).toContain("setSubject(snapshot.subject)");
    expect(history).toContain("setDesign(snapshot.design)");
    expect(history).toMatch(
      /const\s+commit\s*=\s*\(next:\s*TemplateDesign\)[\s\S]{0,180}commitState\(\{\s*name,\s*subject,\s*design:\s*next\s*\}\)/,
    );

    expect(source).toMatch(
      /aria-label="Template name"[\s\S]{0,420}onChange=\{\(event\)\s*=>\s*commitState\(\{(?=[^}]*name:\s*event\.target\.value)(?=[^}]*subject)(?=[^}]*design)[^}]*\}\)\s*\}/,
    );
    expect(source).toMatch(
      /aria-label="Email subject"[\s\S]{0,420}onChange=\{\(event\)\s*=>\s*commitState\(\{(?=[^}]*name)(?=[^}]*subject:\s*event\.target\.value)(?=[^}]*design)[^}]*\}\)\s*\}/,
    );

    const preset = source.slice(
      source.indexOf("const applyPreset"),
      source.indexOf("/* -------- save -------- */"),
    );
    expect(preset.match(/commitState\s*\(/g)).toHaveLength(1);
    expect(preset).toMatch(
      /commitState\(\{(?=[\s\S]{0,260}name)(?=[\s\S]{0,260}subject:\s*preset\.subject)(?=[\s\S]{0,260}design:)[\s\S]{0,260}\}\)/,
    );
    expect(preset).not.toMatch(/\bsetSubject\s*\(/);
  });

  it("routes unsubscribe findings to the footer catalog", () => {
    const findingHandler = source.slice(
      source.indexOf("const handleFindingClick"),
      source.indexOf("const handleWorkspaceTabKeyDown"),
    );
    expect(findingHandler).toMatch(
      /finding\.code\s*===\s*["']unsubscribe-missing["'][\s\S]{0,320}/,
    );
    const unsubscribeBranch = findingHandler.slice(
      findingHandler.indexOf('finding.code === "unsubscribe-missing"'),
    );
    expect(unsubscribeBranch).toMatch(
      /(?=[\s\S]{0,260}setWorkspaceTab\(["']build["']\))(?=[\s\S]{0,260}setWorkspacePanelOpen\(true\))(?=[\s\S]{0,260}setBlockSearch\(["']footer["']\))(?=[\s\S]{0,260}\breturn\b)/,
    );
  });

  it("reacts to every responsive breakpoint and cleans up listeners", () => {
    const responsive = source.slice(
      source.indexOf("// Responsive workspace state"),
      source.indexOf("/** Set right before an intentional navigation"),
    );
    for (const query of [
      "(max-width: 900px)",
      "(max-width: 1180px)",
      "(max-width: 720px)",
      "(max-width: 480px)",
    ]) {
      expect(responsive).toContain(`window.matchMedia("${query}")`);
    }
    expect(responsive.match(/addEventListener\(["']change["']/g)).toHaveLength(4);
    expect(responsive.match(/removeEventListener\(["']change["']/g)).toHaveLength(4);
    expect(responsive).toMatch(/current\s*===\s*next\s*\?\s*current\s*:\s*next/);
    expect(responsive).toMatch(
      /const\s+next:\s*Device\s*=\s*deviceBreakpoint\.matches\s*\?\s*["']mobile["']\s*:\s*["']desktop["'][\s\S]{0,160}setDevice\(/,
    );
    expect(responsive).toMatch(
      /setZoom\([\s\S]{0,260}Math\.max\(\s*MIN_ZOOM,[\s\S]{0,180}Math\.min\(MAX_ZOOM/,
    );
  });

  it("caches drag layout once and reuses it for canvas insertion", () => {
    expect(source).toMatch(
      /interface\s+DragLayoutCache\s*\{(?=[^}]*initialScrollTop:\s*number)(?=[^}]*items:)[^}]*\}/,
    );
    expect(source).toMatch(
      /dragLayoutCacheRef\s*=\s*useRef<DragLayoutCache\s*\|\s*null>\(null\)/,
    );

    const cacheLayout = source.slice(
      source.indexOf("const cacheDragLayout"),
      source.indexOf("const resetDrag"),
    );
    expect(cacheLayout).toContain('querySelectorAll<HTMLElement>("[data-block-wrapper]")');
    expect(cacheLayout).toContain("getBoundingClientRect()");
    expect(cacheLayout).toContain("initialScrollTop");

    const insertion = source.slice(
      source.indexOf("const insertionIndexFor"),
      source.indexOf("const announcements"),
    );
    expect(insertion).toContain("dragLayoutCacheRef.current");
    expect(insertion).toContain("scrollDelta");
    expect(insertion).toContain("item.midpoint - scrollDelta");
    expect(insertion).not.toContain("querySelectorAll");
    expect(insertion).not.toContain("getBoundingClientRect");
    expect(insertion).toContain(
      "event.over.rect.top + event.over.rect.height / 2",
    );

    const dragStart = source.slice(
      source.indexOf("const handleDragStart"),
      source.indexOf("const handleDragPosition"),
    );
    expect(dragStart.match(/cacheDragLayout\(\)/g)).toHaveLength(1);
    const reset = source.slice(
      source.indexOf("const resetDrag"),
      source.indexOf("const dragVerticalPosition"),
    );
    expect(reset).toContain("dragLayoutCacheRef.current = null");
  });

  it("skips identical style patches and centralizes builder alpha controls", () => {
    const patchStyles = source.slice(
      source.indexOf("const patchStyles"),
      source.indexOf("const insertBlockAt"),
    );
    expect(patchStyles).toMatch(/const\s+nextStyles\s*=\s*\{\s*\.\.\.design\.styles,\s*\.\.\.partial\s*\}/);
    expect(patchStyles).toMatch(
      /JSON\.stringify\(nextStyles\)\s*===\s*JSON\.stringify\(design\.styles\)[\s\S]{0,80}\breturn\b/,
    );

    const builderCss = css.slice(css.indexOf(".builder-studio {"));
    expect(builderCss).toContain("--builder-alpha-control-hover:");
    expect(builderCss).toContain("--builder-alpha-surface-soft:");
    expect(builderCss).toContain("--builder-alpha-accent-soft:");
    expect(builderCss).toContain("--builder-alpha-accent-border:");
    expect(
      builderCss.match(/rgba\(255, 255, 255, 0\.055\)/g),
    ).toHaveLength(1);
    const controlGroup = builderCss.slice(
      builderCss.indexOf(".builder-studio :is("),
      builderCss.indexOf(".builder-skip-link"),
    );
    expect(controlGroup).toContain(".builder-undo-group button");
    expect(controlGroup).toContain(".builder-selected-actions button");
    expect(controlGroup).toMatch(
      /\)\s*\{(?=[^}]*display:\s*inline-flex)(?=[^}]*align-items:\s*center)(?=[^}]*justify-content:\s*center)/,
    );
  });

  it("keeps the selected preview device lime while hovered", () => {
    const genericHover = css.indexOf(".builder-back-button:hover,");
    const selectedDevice = css.indexOf(
      '.builder-device-control button[aria-pressed="true"]',
    );
    expect(genericHover).toBeGreaterThan(-1);
    expect(selectedDevice).toBeGreaterThan(genericHover);

    const selectedRule = css.slice(
      selectedDevice,
      css.indexOf("}", selectedDevice) + 1,
    );
    expect(selectedRule).toMatch(/background:\s*rgba\(198, 255, 0, 0\.11\)/);
    expect(selectedRule).toMatch(/color:\s*var\(--lime\)/);
  });

  it("wires the editor model catalog, search, and preflight helpers", () => {
    expect(source).toMatch(
      /import\s*\{(?=[^}]*\bBLOCK_CATALOG\b)(?=[^}]*\bsearchBlockCatalog\b)(?=[^}]*\brunPreflight\b)[^}]*\}\s*from\s*["'][^"']*editor-model["']/,
    );
    expect(source).toMatch(
      /(?:[?:=]\s*|\breturn\s+)BLOCK_CATALOG\b|\bBLOCK_CATALOG\.(?:map|filter)\s*\(/,
    );
    expect(source).toMatch(/\bsearchBlockCatalog\s*\(\s*blockSearch\s*\)/);
    expect(source).toMatch(/\brunPreflight\s*\(\s*subject\s*,\s*design\s*\)/);
  });

  it("declares bounded zoom state and exposes responsive preview modes", () => {
    expect(source).toMatch(/const\s+MIN_ZOOM\s*=\s*50\b/);
    expect(source).toMatch(/const\s+MAX_ZOOM\s*=\s*150\b/);
    expect(source).toMatch(/const\s+DEFAULT_ZOOM\s*=\s*100\b/);
    expect(source).toMatch(/useState(?:<number>)?\(\s*DEFAULT_ZOOM\s*\)/);
    expect(source).toMatch(
      /setZoom\s*\(\s*\(?\s*\w+\s*\)?\s*=>[\s\S]{0,160}\bMIN_ZOOM\b/,
    );
    expect(source).toMatch(
      /setZoom\s*\(\s*\(?\s*\w+\s*\)?\s*=>[\s\S]{0,160}\bMAX_ZOOM\b/,
    );
    expect(source).toContain('aria-label="Zoom out"');
    expect(source).toContain('aria-label="Zoom in"');
    expect(source).toContain("Desktop");
    expect(source).toContain("Mobile");
  });

  it("wires compiled HTML into a sandboxed preview and exposes exports", () => {
    expect(source).toMatch(
      /import\s*\{(?=[^}]*\bcompileDesign\b)[^}]*\}\s*from\s*["']@\/lib\/template-builder\/compile["']/,
    );
    expect(source).toMatch(
      /(?:const|let)\s+compiledHtml\s*=\s*(?:useMemo\s*\(\s*\(\)\s*=>\s*)?compileDesign\s*\(\s*design\s*\)/,
    );
    expect(source).toMatch(
      /<iframe(?=[^>]*\bsrcDoc=\{compiledHtml\})(?=[^>]*\bsandbox(?:\s|=|\/|>))[^>]*>/,
    );
    expect(source).toContain("Copy HTML");
    expect(source).toContain("Download .html");
  });

  it("keeps builder interactions, forms, and preview media accessible", () => {
    const palette = source.slice(
      source.indexOf("function PaletteBlockButton"),
      source.indexOf("function CanvasDropZone"),
    );
    const sortable = source.slice(
      source.indexOf("function SortableBlock"),
      source.indexOf("function DragGhost"),
    );
    const formPrimitives = source.slice(
      source.indexOf("function Field"),
      source.indexOf("/* ------------------------------------------------------------------ */\n/* Variable-highlighting"),
    );
    const previews = source.slice(
      source.indexOf("function BlockPreview"),
      source.indexOf("/* ------------------------------------------------------------------ */\n/* Per-type inspector"),
    );

    expect(palette).toMatch(/inert=\{isDragging\s*\?\s*true\s*:\s*undefined\}/);
    expect(sortable).toMatch(/inert=\{isDragging\s*\?\s*true\s*:\s*undefined\}/);
    expect(sortable).toContain("Select ${label} block");
    const selectionLabel = sortable.indexOf("Select ${label} block");
    const selectionStart = sortable.lastIndexOf("<button", selectionLabel);
    const selectionEnd = sortable.indexOf("/>", selectionLabel);
    const previewStart = sortable.indexOf("<BlockPreview", selectionLabel);
    const selectionButton = sortable.slice(selectionStart, selectionEnd + 2);
    expect(selectionStart).toBeGreaterThan(-1);
    expect(selectionEnd).toBeGreaterThan(selectionLabel);
    expect(selectionEnd).toBeLessThan(previewStart);
    expect(selectionButton).toContain("aria-pressed={selected}");
    expect(selectionButton).not.toContain("<BlockPreview");
    expect(sortable.slice(selectionEnd + 2, previewStart)).toContain(
      'className="pointer-events-none"',
    );
    expect(css).toMatch(/\.builder-studio\.is-dragging\s*\{[^}]*user-select:\s*none/);

    expect(formPrimitives).toContain('autoComplete="off"');
    expect(formPrimitives).toMatch(/name=\{fieldName\(label\)\}/);
    expect(formPrimitives).toContain('aria-label={`${label} hex value`}');
    expect(source).toMatch(
      /role="group"[\s\S]{0,80}aria-label="Prompt ideas"/,
    );
    expect(source).toMatch(/<h1[^>]*>\s*Template builder\s*<\/h1>/);

    expect(previews.match(/\bwidth=\{/g)?.length).toBeGreaterThanOrEqual(2);
    expect(previews.match(/\bheight=\{/g)?.length).toBeGreaterThanOrEqual(2);
    expect(previews).toContain('loading="lazy"');
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.builder-studio[\s\S]*?\.builder-context-panel[\s\S]*?animation:\s*none/,
    );
    expect(css).toMatch(
      /\.builder-email-card\s*\{[^}]*overflow-wrap:\s*anywhere/,
    );
  });

  it("wires sensor-driven drag and drop with announcements", () => {
    expect(source).toMatch(
      /import\s*\{(?=[^}]*\bDndContext\b)(?=[^}]*\bDragOverlay\b)(?=[^}]*\bKeyboardSensor\b)(?=[^}]*\bMouseSensor\b)(?=[^}]*\bTouchSensor\b)(?=[^}]*\buseSensor\b)(?=[^}]*\buseSensors\b)[^}]*\}\s*from\s*["']@dnd-kit\/core["']/,
    );
    expect(source).toMatch(
      /import\s*\{(?=[^}]*\bsortableKeyboardCoordinates\b)[^}]*\}\s*from\s*["']@dnd-kit\/sortable["']/,
    );
    expect(source).toMatch(
      /useSensors\s*\((?=[\s\S]{0,800}useSensor\s*\(\s*MouseSensor\b)(?=[\s\S]{0,800}useSensor\s*\(\s*TouchSensor\b)(?=[\s\S]{0,800}useSensor\s*\(\s*KeyboardSensor\b)[\s\S]{0,800}\)/,
    );
    expect(source).toMatch(
      /useSensor\s*\(\s*KeyboardSensor\s*,\s*\{[\s\S]{0,300}coordinateGetter\s*:\s*sortableKeyboardCoordinates/,
    );
    expect(source).toMatch(/const\s+announcements\s*(?::[^=]+)?=\s*\{/);
    expect(source).toMatch(
      /<DndContext(?=[\s\S]{0,800}\bsensors=\{sensors\})(?=[\s\S]{0,800}\baccessibility=\{\{\s*announcements\s*\}\})[\s\S]{0,800}>/,
    );
    expect(source).toMatch(/<DragOverlay(?:\s|>)/);

    const sortableBlockSource = source.slice(
      source.indexOf("function SortableBlock"),
      source.indexOf("function DragGhost"),
    );
    expect.soft(sortableBlockSource).not.toMatch(/\btransform\s*[:,]/);
    expect.soft(sortableBlockSource).not.toMatch(/\btransition\s*[:,]/);
    expect.soft(source).not.toMatch(
      /import\s*\{\s*CSS\s*\}\s*from\s*["']@dnd-kit\/utilities["']/,
    );

    expect.soft(source).toMatch(
      /onDragOver\s*\([^)]*\)\s*\{[\s\S]{0,900}\binsertionIndexFor\s*\(/,
    );
    expect.soft(source).toMatch(
      /onDragEnd\s*\([^)]*\)\s*\{[\s\S]{0,1400}\binsertionIndexFor\s*\(/,
    );
    expect.soft(source).toMatch(
      /onDragEnd\s*\([^)]*\)\s*\{(?=[\s\S]{0,1400}\binsertionIndex\s*===\s*activeIndex\b)(?=[\s\S]{0,1400}\binsertionIndex\s*===\s*activeIndex\s*\+\s*1\b)(?=[\s\S]{0,1400}\bNo change\b)/,
    );
  });

  it("exposes status and panel controls and wires preflight issue selection", () => {
    expect(source).toContain("Draft saved");
    expect(source).toContain("Preflight score");
    expect(source).toContain("Show block library");
    expect(source).toContain("Hide properties");
    expect(source).toMatch(
      /(?:(?:if\s*\(\s*finding\.blockId\s*\)|finding\.blockId\s*&&)[\s\S]{0,160}|if\s*\(\s*!\s*finding\.blockId\s*\)\s*return[\s\S]{0,160})setSelectedId\s*\(\s*finding\.blockId\s*\)/,
    );
  });

  it("keeps the workspace disclosure outside the tablist", () => {
    const rail = source.slice(
      source.indexOf("{/* ---------------- Workspace rail ---------------- */}"),
      source.indexOf("{/* ---------------- Context workspace ---------------- */}"),
    );
    const navOpeningTag = rail.slice(rail.indexOf("<nav"), rail.indexOf(">", rail.indexOf("<nav")) + 1);
    const tabsClass = rail.indexOf('className="builder-mode-tabs"');
    const tabsStart = rail.lastIndexOf("<div", tabsClass);
    const tabsOpeningTag = rail.slice(tabsStart, rail.indexOf(">", tabsClass) + 1);
    const disclosureStart = rail.indexOf("{!workspacePanelOpen");

    expect(navOpeningTag).not.toContain('role="tablist"');
    expect(tabsOpeningTag).toContain('role="tablist"');
    expect(tabsOpeningTag).toContain('aria-orientation="vertical"');
    expect(disclosureStart).toBeGreaterThan(tabsStart);
    expect(rail.slice(tabsStart, disclosureStart)).not.toContain(
      'aria-label="Show block library"',
    );
    expect(rail.slice(tabsStart, disclosureStart)).toMatch(/<\/div>\s*$/);
    expect(rail).toContain('aria-controls="builder-workspace-panel"');
    expect(source).toContain('id="builder-workspace-panel"');
  });
});
