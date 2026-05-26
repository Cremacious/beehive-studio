# DP2 — Studio Shell Design Spec

> **Date:** 2026-05-26
> **Sub-project:** Design Port 2 of 4. The largest and most visible of the four.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Port the persistent studio chrome (binder · editor toolbar · editor body · bottom status bar · right metadata panel · Hive integration · error toasts) to match Claude Design's `designs/claude/studio-shell/Studio Shell.html` mockup. After DP2, the studio's daily-use surface is fully redesigned; specialized editor surfaces (DP3) and overlays (DP4) follow.

## 2. Context

DP1 landed the foundation: tokens + Newsreader font + shadcn bridge. Every component already inherits warm walnut chrome automatically. DP2 takes that foundation and applies the structural + visual specifics from the mockup.

Locked decisions from the brainstorm:
- **Hive button placement:** binder footer (beneath `+ Add`).
- **Icons:** lucide-react everywhere; no custom SVGs.
- **Sprint timer refactor:** extract `SprintControls`, status bar composes it. `sprint-timer.tsx` deleted.
- **Execution order:** status bar → binder → metadata panel → toolbar → editor body → brand-yellow audit.
- **Verification:** eyeball side-by-side (mockup tab vs dev server tab).
- **Brand-yellow audit:** scoped to the surfaces DP2 touches (toolbar + binder + status bar). DP3/DP4 audit their own surfaces.

Pixel-perfect targets: editor body, binder, toolbar. Structural fidelity: status bar, metadata panel, Hive button, error toasts.

Active bug fixed by Task 1: the floating SprintTimer overlay currently clips the word-goal button in the bottom-right of the editor area. Moving sprint into the status bar's right cluster eliminates the overlap.

## 3. Non-goals

- Specialized editor surfaces (FM/BM, Outline, Notes, Character) — those are DP3.
- Overlays / modals (history drawer, find/replace, cheatsheet, export, etc.) — those are DP4.
- Empty states (start your first chapter, select a chapter to write, etc.) — those are DP4.
- App-level top nav — Chris redesigns separately.
- New features. DP2 is purely visual + minimal structural (the sprint relocation). All existing behavior preserved.
- New unit tests. DP2 is UI; verification is manual side-by-side.

## 4. Architecture

### 4.1 Surfaces and execution order

| # | Surface | Files affected | Fidelity |
|---|---------|---------------|----------|
| Task 1 | Sprint refactor + bottom status bar | new `sprint-controls.tsx`, delete `sprint-timer.tsx`, modify `editor-status-bar.tsx` + `chapter-editor.tsx` + `corkboard-or-editor.tsx` light-mode CSS | structural |
| Task 2 | Binder + ⋯ menu + + Add menu + Hive footer | `binder/binder-tree.tsx`, `binder/binder-item.tsx`, `binder/binder-item-menu.tsx`, `binder/binder-add-menu.tsx`, new `binder/binder-hive-footer.tsx` | pixel-perfect |
| Task 3 | Right metadata panel + Publishing expander | `metadata/metadata-panel.tsx` | structural |
| Task 4 | Editor toolbar (26 buttons) | `editor/editor-toolbar.tsx` | pixel-perfect |
| Task 5 | Editor body — prose + paper mode | `editor/chapter-editor.tsx`, possibly `corkboard-or-editor.tsx` light-mode prose CSS | pixel-perfect |
| Task 6 | Brand-yellow audit + error toasts + DP2 close-out | `editor/error-toasts.tsx` + sweep of toolbar/binder/status bar files | structural |

Each task is one atomic commit. Single-task subagent dispatches with manual verification between tasks.

### 4.2 Component-level changes

#### Task 1: SprintControls extraction

- **New:** `app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx`. Owns:
  - Sprint state (idle / setup / running / paused / finished).
  - Duration picker popover (15 / 25 / 50 / custom minutes).
  - Timer tick logic (setInterval ref + cleanup).
  - Visual treatment of each state per mockup.
  - Props: `currentWordCount: number` (for the +N words at finish).
- **Modify:** `editor/editor-status-bar.tsx`:
  - Left cluster: save indicator (existing) · word count (existing) · word goal (existing, inline edit preserved).
  - Right cluster: `<SprintControls currentWordCount={…} />`.
  - The bar structure becomes `<div data-slot="editor-status-bar"><div class="left-cluster">…</div><div class="right-cluster"><SprintControls /></div></div>`.
- **Modify:** `editor/chapter-editor.tsx`:
  - Remove the `<SprintTimer currentWordCount={…} />` render from the chapter-render path.
  - The status bar handles it now.
- **Delete:** `editor/sprint-timer.tsx`.
- **Extend:** `corkboard-or-editor.tsx` light-mode CSS to cover the new `[data-slot="editor-status-bar"] .right-cluster` and any sprint-control-specific selectors.

#### Task 2: Binder + menus + Hive footer

- **Modify:** `binder/binder-tree.tsx` — wrapper styling, header (book title + corkboard toggle), tree-list container. Apply paper-card aesthetic per mockup. Mount `<BinderHiveFooter />` at the bottom.
- **Modify:** `binder/binder-item.tsx` — row aesthetic. Six item types get tinted icons via `--type-chapter`, `--type-front-matter`, `--type-back-matter`, `--type-outline`, `--type-research`, `--type-character`. Row states (default / hover / active / renaming / drag / drop-target) all match the mockup.
- **Modify:** `binder/binder-item-menu.tsx` — popover styling. Destructive delete row visually marked (warning-color from tokens).
- **Modify:** `binder/binder-add-menu.tsx` — popover styling. Each item-type option shows its tinted icon + name.
- **New:** `binder/binder-hive-footer.tsx` — small "Hive" button beneath `+ Add`. Reuses `create-hive-button` logic OR triggers `create-hive-modal` directly — confirm during implementation which integration point is cleanest.

#### Task 3: Metadata panel

- **Modify:** `metadata/metadata-panel.tsx` (one file holds `ChapterMetadata` + `PublishingSection`):
  - Section visual treatment per mockup.
  - Status pills (5 options) use the `--status-*` palette from tokens.
  - Inline title rename: keep the existing toggle pattern; restyle.
  - Synopsis textarea: paper-card field treatment.
  - Scene Planner expander: chevron + section heading, paper card with three sub-fields when open.
  - Notes textarea: paper-card field treatment.
  - Publishing expander (pinned at bottom): retain SP5 "Applies to the whole book" subtitle. Visual treatment per mockup.

#### Task 4: Editor toolbar

- **Modify:** `editor/editor-toolbar.tsx`:
  - Three-zone layout (FORMAT · spacer · VIEW) preserved.
  - FORMAT zone groupings with separators between groups.
  - VIEW zone clusters: Find / History / Help / theme toggle / font-size dropdown / Export / Analysis / Focus.
  - `ToolbarButton` wrapper:
    - Default state: muted icon.
    - Hover: paper hover tint.
    - Active: brand-yellow background + ink color (per Claude Design's restraint — active state is one of the 5 sanctioned yellow uses).
    - Disabled: dimmed icon.
  - Sun/Moon theme toggle, Export label button, Font-size `<select>` styled to mockup.

#### Task 5: Editor body

- **Modify:** `editor/chapter-editor.tsx`:
  - TipTap `EditorContent` className updated to use `--font-prose` (Newsreader) as the body face.
  - Prose typography (line-height, font-size, paragraph margins) per mockup.
  - Container max-width / centering / padding per mockup.
  - Placeholder text styling.
  - Paper light mode: the SP4 CSS in `corkboard-or-editor.tsx` already references `--paper-*` tokens (DP1 Task 3); confirm no additional rules needed for the new prose face.

#### Task 6: Audit + toasts + close-out

- **Audit:** grep the surfaces DP2 touched for hardcoded `#FFC300` / `text-brand` / `bg-brand` usage. Restrain to the 5 sanctioned places:
  1. Active binder row indicator.
  2. Unsaved-save-status indicator dot.
  3. `+ Add` button primary CTA.
  4. Premium badges.
  5. Active toolbar button background.

  Other brand-yellow usages get downgraded to neutral chrome tokens (typically `--chrome-200` for text, `--chrome-700` for borders).

- **Modify:** `editor/error-toasts.tsx` — visual treatment per mockup. Variants: info / success / error / premium. Each uses an appropriate token (info → chrome, success → `--success`, error → `--error`, premium → `--brand`).

### 4.3 What DP2 does NOT touch

- TipTap configuration (extensions, commands, keymaps). Pure visual.
- Server actions, types, DB. None.
- Provider state. Provider gains no new fields. `sprintActive` state stays inside `SprintControls`.
- Other studio components not listed (corkboard view, focus mode behavior, history drawer, etc.) — those are DP3/DP4 surfaces.

## 5. Testing (manual, per task + final)

Per-task verification (after each task's dev-server smoke):
- Surface looks like the mockup at a glance.
- All interactive states render correctly (hover / active / disabled / focused).
- Functional behavior preserved (rename works, drag-drop works, sprint ticks correctly, autosave fires).
- No console errors.
- Toggle dark / light editor mode where applicable; surfaces adapt.

Final 13-item checklist after Task 6:
1. `npm run dev` boots clean. Studio loads.
2. Open a chapter → binder, toolbar, editor, metadata panel all visually match mockup.
3. Binder rows: default / hover / active / renaming all look right; item-type icons are tinted.
4. ⋯ menu + + Add menu open with mockup styling; destructive delete row distinct.
5. Hive footer button visible at bottom of binder; click opens Create Hive modal.
6. Editor toolbar: all 26 buttons render with mockup spacing + states.
7. Sprint timer no longer floats — it's in the right cluster of the bottom status bar. The previous overlap with the word-goal button is resolved.
8. Status bar: save indicator + word count + word goal on left; sprint controls on right.
9. Toggle light mode → editor body becomes cream paper; status bar and toolbar adapt; chrome stays dark walnut.
10. Right metadata panel: title rename, status pills (5 colors), synopsis, Scene Planner expander, Notes, Publishing expander all match mockup.
11. Brand yellow appears only in the 5 sanctioned places across DP2's surfaces.
12. `npx tsc --noEmit` clean.
13. `npm test` clean (still 119).

## 6. Risks

1. **Mockup CSS may hardcode values instead of using tokens.** Claude Design's `studio-shell/styles.css` had access to tokens but may have rgba literals. During each task, port to token references where possible. If a literal is intentional (specific alpha blend), use `oklch(from var(--brand) l c h / 0.X)`.

2. **Lucide icon mismatch.** Stroke-widths, sizes, line caps may differ between Claude Design's mockup icons and lucide defaults. Adjust via `size=` / `strokeWidth=` props; do not switch to custom SVGs.

3. **Decorative rgba(255,195,0,0.x) literals in globals.css utilities** (`paper-grit`, `auth-glow`, `hero-glow`, etc.) are out of scope for DP2's audit — they're effect recipes, not chrome surfaces.

4. **Sprint timer regression.** Refactoring `sprint-timer.tsx` into `sprint-controls.tsx` mounted inside the status bar could break the start/pause/resume/finish flow. Mitigation: dev-smoke a full sprint cycle in Task 1's manual verification.

5. **Binder drag-drop regression.** Restyling rows touches the DnD container. Mitigation: actually drag-drop a binder item in Task 2 verification.

6. **TipTap prose class names.** Existing TipTap emits `.tiptap.ProseMirror`. Claude Design's prose CSS (`.prose-bh`, `.prose-chapter` in `globals.css`) may not be referenced by the current `EditorContent`. During Task 5, decide whether to:
   - Apply those classes to `EditorContent` via className prop.
   - Or update the prose CSS selectors to target `.tiptap.ProseMirror` instead.
   Choose whichever requires the smaller edit.

7. **Hive button + modal integration.** The existing `create-hive-button.tsx` is a free-standing button component. The new binder-hive-footer might wrap it OR re-implement just the click handler. During Task 2 implementation, confirm the cleanest integration; reuse where possible.

8. **Studio Shell.html mockup may show states we don't currently implement.** If the mockup shows a state Beehive doesn't have today (e.g., a non-existent variant of the status bar), document it for a future audit but don't expand DP2 scope to add behavior.

## 7. Definition of done

- 6 atomic commits (one per task) + 1 docs commit for AGENTS.md.
- All 13 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119 — no new unit tests required).
- Pixel-perfect side-by-side verification on editor body / binder / toolbar.
- Brand yellow restrained to 5 sanctioned places across DP2's surfaces.
- AGENTS.md Resume Here updated; DP2 entry under "What Has Been Built."
- Pushed to origin/main.

## 8. Out-of-scope reminders

These are explicitly NOT part of DP2:
- Specialized editor surfaces (FM/BM, Outline, Notes, Character) → DP3.
- Overlays + modals (history drawer, find/replace, cheatsheet, export, writing analysis, etc.) → DP4.
- Empty states → DP4.
- App-level nav → Chris designs separately.
- Performance / accessibility audits beyond what's already in place (aria-labels from SP6 retained).
- New features.

After DP2: DP3 Specialized Editor Surfaces, then DP4 Overlays / Modes / Modals, then Phase 8 Stripe monetization.
