# Template Builder Studio Redesign

## Product intent

Rebuild the existing template editor as a focused, modern email-design studio. Preserve Sendthen's compact black-and-lime character and the reliability of the current email-safe compiler, while making block discovery, placement, selection, responsive preview, quality review, and export feel competitive with current visual builders.

The editor remains structured rather than freeform. Email clients reward predictable document flow, so the canvas continues to represent an ordered list of email-safe blocks instead of arbitrary x/y positioning. The interaction layer should still feel direct: blocks can be dragged from the library, sorted with pointer/touch/keyboard input, inserted between content, selected from a layers view, duplicated, and removed without leaving the canvas.

## Chosen approach

Three approaches were considered:

1. Restyle the current three-pane UI only. This is low risk but would not address touch, keyboard drag, navigation, or modern quality tooling.
2. Rebuild the editor shell around the existing `TemplateDesign` v1 model. This preserves saved templates and compilation while allowing a modern block library, accessible sortable interactions, layers, brand presets, zoom, preview, export, and issue-led review. This is the selected approach.
3. Introduce a v2 nested `document → row → column → block` model immediately. It enables cross-column drag and responsive column controls, but requires migration, compiler, API validation, editor, and regression work well beyond a safe UI rebuild.

## Workspace architecture

The desktop workspace uses four visual regions:

- A 64px command bar with navigation, editable document identity, save state, undo/redo, preview, test send, and primary save.
- A compact mode rail plus a 264px contextual left panel for Build, Layers, Brand, and Review.
- A fluid, patterned canvas with a sticky viewport toolbar, zoom controls, desktop/mobile widths, and a centered email card.
- A 320px properties inspector that follows the selected block and falls back to global document controls.

At narrower widths, optional panels progressively collapse so the canvas remains usable. Click-to-add and layer move controls remain available when touch dragging is inconvenient.

## Interaction model

The drag system uses pointer, touch, and keyboard sensors with an activation threshold, sortable coordinates, a drag overlay, clear drop feedback, Escape cancellation, and a single history transaction per completed move. The same ordered design array remains the source of truth. The layers panel and canvas share selection and ordering, so choosing a layer scrolls the corresponding block into view.

Block discovery adds search, categories, descriptions, and recent/common emphasis. Build inserts normal blocks; Layers exposes document order; Brand applies a complete style token set as one undoable change; Review computes actionable preflight issues and selects the relevant block when an issue is clicked.

Preview renders the real compiled HTML in a sandboxed iframe, with desktop and mobile frames. Export copies or downloads the same compiled HTML, eliminating divergence between the visual preview and delivery output.

## State and data flow

`Editor` remains the state owner for name, subject, `TemplateDesign`, history, selection, panel mode, device, zoom, dialogs, and save/test-send status. Pure editor-domain helpers provide block catalog filtering, layer labels, reordering, and preflight checks; these are independently tested.

All design mutations pass through the existing history-aware `commit` function. Applying a brand preset, inserting generated starter content, or reordering is therefore undoable. Saving and test sending continue to use the existing API routes. No schema or saved-template migration is required.

## Quality and accessibility

The UI uses the existing semantic design tokens, raises small-label contrast, keeps controls at touch-friendly sizes, supplies visible focus states and accessible names, and avoids color-only state. The preflight model checks subject presence, unsubscribe coverage, image alt text, incomplete links, empty content, and unsafe content width. Responsive behavior is validated at desktop and compact widths.

Automated verification covers pure editor behavior, visible editor affordances, existing compiler security, the complete test suite, TypeScript/Next build, and a rendered browser pass at desktop and mobile widths.

