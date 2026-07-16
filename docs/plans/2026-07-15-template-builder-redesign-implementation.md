# Template Builder Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Sendthen template builder as a polished, accessible design studio with modern sortable drag-and-drop, layers, brand presets, zoom, compiled preview/export, and issue-led QA.

**Architecture:** Keep `TemplateDesign` v1 and the existing save/test-send/compiler contracts stable. Add tested pure editor-domain helpers, then rebuild the client editor shell around shared state and accessible sortable interactions. Use the real compiler for preview/export and semantic Tailwind/CSS tokens for responsive layout.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, Playwright, dnd-kit.

### Task 1: Define editor-domain behavior

**Files:**
- Create: `tests/builder-editor-model.test.ts`
- Create: `lib/template-builder/editor-model.ts`

**Steps:**
1. Write failing tests for catalog search, friendly layer labels, immutable block reordering, and actionable preflight checks.
2. Run `pnpm vitest run tests/builder-editor-model.test.ts` and confirm it fails because the editor model does not exist.
3. Implement the smallest pure helper module that satisfies the tests.
4. Re-run the focused test and confirm it passes.

### Task 2: Lock the new workspace contract

**Files:**
- Create: `tests/builder-ui.test.ts`
- Modify: `components/builder/editor.tsx`

**Steps:**
1. Write failing source-contract tests for the Build/Layers/Brand/Review modes, block search, responsive preview, zoom, compiled preview/export, drag accessibility, and preflight status.
2. Run `pnpm vitest run tests/builder-ui.test.ts` and confirm the expected affordances are absent.
3. Keep the tests focused on durable labels and semantics rather than exact class strings.

### Task 3: Add accessible sortable foundations

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `components/builder/editor.tsx`

**Steps:**
1. Add the official dnd-kit core/sortable/utilities packages.
2. Configure mouse, touch, and keyboard sensors with activation constraints and sortable keyboard coordinates.
3. Add sortable canvas blocks, draggable library blocks, a drag overlay, cancellation feedback, and one history commit on drop.
4. Preserve click-to-add, move buttons, selection, duplicate/delete, and empty-canvas insertion.
5. Run the focused editor tests.

### Task 4: Rebuild the studio shell

**Files:**
- Modify: `components/builder/editor.tsx`
- Modify: `app/globals.css`

**Steps:**
1. Replace the old top bar with a document command bar and visible save status.
2. Add the mode rail and searchable Build panel with grouped block cards.
3. Add Layers selection/reordering, Brand theme presets, and Review score/issues.
4. Add the sticky canvas toolbar, device widths, zoom controls, workspace grid, polished email frame, selection chrome, and contextual inspector header.
5. Add responsive panel collapse behavior and touch-friendly controls.
6. Run focused UI/model tests and fix regressions.

### Task 5: Add real preview and export

**Files:**
- Modify: `components/builder/editor.tsx`

**Steps:**
1. Render `compileDesign(design)` inside a sandboxed preview iframe.
2. Add desktop/mobile preview controls.
3. Add copy-HTML and download-HTML actions with visible success feedback.
4. Ensure dialogs support Escape, backdrop close, accessible names, and focusable controls.
5. Run focused tests.

### Task 6: Verify behavior and presentation

**Files:**
- Modify as needed based on verification.

**Steps:**
1. Run `pnpm test`.
2. Run `pnpm build`.
3. Start the app and render the builder at desktop and compact widths.
4. Exercise add, reorder, select, duplicate, delete, undo/redo, brand apply, review issue selection, preview, and export.
5. Run an accessibility/design review, fix material findings, and repeat the focused checks.

