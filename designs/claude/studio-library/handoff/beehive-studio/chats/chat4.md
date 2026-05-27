# Chat

_Started 2026-05-26 17:41 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Beehive Studio"
Project currently has 5 file(s)
User is viewing file: specialized-surfaces/Specialized Surfaces.html
Current date is now May 26, 2026
</system-info>

<pasted_text name="Pasted text (498 lines)">
# Claude Design Brief — Prompt 3 of 3: Overlays, Modes, and Modals

> **Project:** Beehive Studio. **Audience:** Claude Design. **Date:** 2026-05-26.
> **Sequence:** third and final brief in the studio editor design pass.
> **Inherits:** the design system established in Prompts 1 (Studio Shell) and 2 (Specialized Editor Surfaces).
> **Output expected:** high-fidelity mockups for every transient / overlay / modal / mode surface inside the studio, plus the empty/first-time states.

These surfaces don't render alongside the studio chrome — they appear on top of it (modals), in place of it (modes), or as panels that slide in (drawers). Many are entry points triggered from the editor toolbar designed in Prompt 1. Each one needs to inherit the brand language without competing with the underlying surfaces.

---

## 1. Context (compressed)

Beehive Studio: book-writing platform at `/[locale]/studio/[bookId]`. Three-column persistent chrome (binder · editor · metadata panel) was designed in Prompt 1. Specialized editor surfaces (FM/BM previews, outline, notes, character profile) were designed in Prompt 2. This brief covers everything else — the overlays and modes that sit on top.

Brand direction recap (locked, see Prompt 1):
- Mixed palette: warm cream paper writing surfaces; dark chrome around.
- Stacked-card / paper-layer language.
- Cozy. Homey. Book-feeling.
- Brand yellow `#FFC300` as primary accent + a supporting palette for state and category.
- Light/dark editor toggle for writing surfaces only.

---

## 2. Scope of this brief

**In scope:**
- 2.1 Corkboard view (mode — replaces editor body)
- 2.2 Focus mode (mode — hides sidebars)
- 2.3 Version history drawer (panel — replaces metadata panel)
- 2.4 Snapshot preview banner (transient — top of editor pane during preview)
- 2.5 Find & Replace (overlay — between toolbar and prose)
- 2.6 Writing analysis panel (slide-in panel)
- 2.7 Keyboard cheatsheet modal (centered modal)
- 2.8 Export modal (centered modal)
- 2.9 Confirmation dialogs (destructive actions)
- 2.10 First-time empty states ("Start your first chapter," "Select a chapter," empty book)
- 2.11 Sprint timer states (the sprint timer is integrated into the status bar per Prompt 1 — this brief covers the running-sprint visual treatment and the sprint-end celebration)

**Out of scope:**
- Persistent shell (Prompt 1).
- Specialized editor surfaces (Prompt 2).
- Book creation wizard, pricing pages, app-level nav (separate later passes).

---

## 3. Surface 1 — Corkboard view (mode)

### 3.1 What it is

A bird's-eye view of the entire book's chapters as a grid of index cards on a desk. Each card represents one chapter (front matter and back matter usually excluded — confirm in implementation). The user sees titles + synopses at a glance, can rearrange chapter order, click a card to open that chapter.

### 3.2 Trigger and lifecycle

Triggered from a corkboard toggle in the binder area (or possibly the toolbar — Claude Design from Prompt 1 should have placed this). When active, the **center pane** transforms: the editor toolbar + prose body + status bar are replaced by the corkboard grid. The binder + metadata panel remain on the sides.

Exiting corkboard returns to the previously-active chapter editor.

### 3.3 Visual

The "corkboard" metaphor is literal — this is the chance to lean fully into the paper / desk / writer's-studio brand:
- The background could be a corkboard texture, or a desk surface (wood / felt), or just a warm dark surface.
- Each chapter card is an index card — beige/cream, slight rotation possible (subtle, not gimmicky), drop shadow, maybe a paperclip or pushpin metaphor.
- Cards arranged in a grid (responsive — 2 to 4 columns depending on viewport width).
- Each card shows:
  - Title (handwritten-feel font? Or the same headings face — recommend)
  - Status pill (using the supporting palette from Prompt 1)
  - Synopsis (first ~3 lines, truncated)
  - Word count (small, corner)
  - Chapter number / position
- Drag a card to reorder; cards reflow.
- Click a card → exit corkboard, open that chapter in the editor.

### 3.4 States

- Default (cards filled, all chapters represented)
- Hover on a card (lifts slightly, deeper shadow)
- Active card (the chapter currently being edited — distinguished by a marker)
- Dragging (the card lifts off, others reflow around the gap)
- Empty (the book has no chapters yet — single empty state message + "Create your first chapter" primary action)
- Filtering or grouping options? (e.g., filter by status — propose if useful, but don't bloat MVP)

### 3.5 Header strip

Above the grid, a thin header strip with:
- A title or label ("All chapters" / "Corkboard")
- Chapter count
- Optional: filter / sort controls
- Exit corkboard button (clear affordance)

---

## 4. Surface 2 — Focus mode

### 4.1 What it is

A distraction-free writing mode. The binder (left) and metadata panel (right) hide; the editor expands to fill the available width.

### 4.2 Trigger and lifecycle

Triggered from the focus button in the editor toolbar (Maximize2 icon when in normal mode, Minimize2 when in focus). Toggling exits back to the three-column layout.

### 4.3 Visual

This is mostly a layout shift, not a new surface. But the design needs to:
- Make the transition feel intentional (animation? simple cross-fade? recommend).
- The editor's max-width might increase slightly so the prose has more room — or stay the same and just hide the sidebars (cleaner). Claude Design picks.
- The bottom status bar stays visible (with save status + word count + word goal + sprint).
- The toolbar stays visible.
- The transitions back-to-normal should be smooth — sidebars slide in, content shifts.

### 4.4 States

- Entering focus (transition)
- In focus (sidebars hidden)
- Exiting focus (transition)

### 4.5 Possible refinements

- Optional: in focus mode, fade non-prose chrome slightly (toolbar more muted) to reinforce "writing only." Recommend.
- Optional: a "minimal" sub-mode that even fades the toolbar until hover. Recommend only if confident; otherwise keep focus as a simple sidebar-hide.

---

## 5. Surface 3 — Version history drawer

### 5.1 What it is

A premium feature. Beehive automatically snapshots a chapter's content every minute of active writing. The drawer lets the user view past versions and restore them.

### 5.2 Trigger and lifecycle

Triggered from the History (Clock) icon in the editor toolbar's VIEW zone. When active, the **right panel** swaps from the metadata panel to the history drawer (same width slot — covered architecturally by `RightPanelSlot`).

The user can:
- See a list of up to 50 snapshots, newest first.
- Click a snapshot row to preview that version (the editor body transforms to read-only, a banner appears — see 6).
- Close the drawer (X button) to return to the metadata panel.
- For free users: see an upsell card instead of the snapshot list.

### 5.3 Visual

- Same width as the metadata panel it's replacing (consistent with Prompt 1's right-panel slot).
- Header: a small icon (Clock or History — lucide) + "Version history" label + close (×).
- Body, **premium user**:
  - Scrollable list of snapshot rows.
  - Each row shows two lines:
    - Date/time (relative: "Today 2:14 PM," "Yesterday 11:30 AM," "May 24 · 9:00 AM")
    - Word count ("1,240 words")
  - Click a row to enter preview mode (5.4 below).
  - The row corresponding to the *currently previewed* snapshot, if any, is highlighted.
  - Empty state: "No snapshots yet — keep writing and your chapters will be saved here automatically every minute."
- Body, **free user**:
  - An upsell card with a premium badge, a brief value statement ("Version history lets you restore any version of your chapter going back through your edits"), and an "Upgrade →" CTA linking to /pricing.

### 5.4 Triggering preview

Click a snapshot row → editor enters preview mode. See §6 (Snapshot preview banner).

### 5.5 States

- Loading (initial fetch)
- Populated (snapshots listed)
- Empty (no snapshots)
- Free-tier upsell
- Error (action failed)
- Row hover / active
- Row currently being previewed (highlighted to show user where they are)

---

## 6. Surface 4 — Snapshot preview banner

### 6.1 What it is

A transient banner that appears at the top of the editor pane (between the toolbar and the prose body) when the user is previewing a past snapshot. Signals "you are not looking at your live draft right now."

### 6.2 Visual

- Thin horizontal banner (~32–40px tall) with the brand accent treatment — yellow-ish, attention-getting but not alarming. It's an informational mode indicator, not an error.
- Content (left to right):
  - A small icon (History / Clock)
  - Label: "Previewing version from {date} · read-only"
  - Right side: two buttons —
    - **Restore this version** (primary, brand yellow, calls the restore action — destructive in the sense that it overwrites the live draft, but reversible since a snapshot of pre-restore state is auto-saved before)
    - **Back to current** (secondary, dismisses preview without changes)

### 6.3 Editor body behavior while banner is visible

- Editor is read-only (cursor visible but no typing accepted).
- Editor content shows the snapshot's content.
- Autosave is paused (handled in code — informational for design).

### 6.4 Banner states

- Default (showing the date + buttons)
- Restoring (after clicking Restore — show a spinner or "Restoring…" state on the button briefly)
- Error (rare — show inline error in the banner if restore fails)

---

## 7. Surface 5 — Find & Replace overlay

### 7.1 What it is

In-editor find-and-replace. Toggled via Cmd/Ctrl+F or the Search icon in the toolbar.

### 7.2 Visual

- A horizontal strip that appears between the editor toolbar and the prose body. Similar pattern to VS Code or Google Docs.
- Anatomy:
  - **Search input** (left, primary — auto-focuses on open)
  - **Match count** ("3 of 12")
  - **Previous match** / **Next match** buttons (arrow icons)
  - **Match case** toggle (Aa icon button or text label)
  - **Replace toggle** (expands to show the replace row)
  - **Close (×)** button
- When **Replace** is toggled:
  - A second row appears below with a **Replace input**, a **Replace** button (replaces the current match), and a **Replace all** button.
- Highlighted matches in the prose body (current match more distinctive than others — propose colors).

### 7.3 States

- Open / closed (animated slide-down on open)
- Typing in search input
- Match count > 0
- No matches found ("No results")
- Replace row hidden / shown
- Currently focused match highlighted distinctly

### 7.4 Light/dark parity

Works in both editor modes — the overlay should look at home on cream paper AND on dark editor.

---

## 8. Surface 6 — Writing analysis panel

### 8.1 What it is

A reading-level / pacing / writing-stats analysis tool. Slides in from the right side of the editor pane (overlaying the prose temporarily, or pushing the prose narrower — Claude Design recommends).

### 8.2 Trigger and lifecycle

Triggered from the BarChart3 icon in the toolbar. Toggling closes it.

### 8.3 Content

Likely sections (current behavior):
- **Readability score** (Flesch-Kincaid or similar) — a single headline number with a label.
- **Sentence length distribution** — chart or histogram showing how varied sentence lengths are.
- **Pacing** — words per scene / chapter or some pacing metric.
- **Adverb count** / **passive voice count** / **filler word count** — small stat rows.
- **Most-used words** — a small word cloud or list.

### 8.4 Visual

- Panel width: probably 280–360px, slides in from the right of the editor pane.
- Header: "Writing analysis" + close (×).
- Inside: scrollable sections, each visually distinct (cards / dividers).
- Charts should feel hand-drawn or paper-like, not "Bloomberg terminal."
- Empty state: "Write at least N words for analysis."

### 8.5 States

- Opening / closing (slide animation)
- Loading (computing stats)
- Default (filled with data)
- Empty (very short prose — not enough to analyze)
- Light/dark parity

---

## 9. Surface 7 — Keyboard cheatsheet modal

### 9.1 What it is

A modal listing keyboard shortcuts available in the studio editor.

### 9.2 Trigger

Triggered by:
- The HelpCircle icon in the editor toolbar (primary, discoverable)
- Cmd/Ctrl+/ (secondary, for power users)

### 9.3 Visual

- Centered modal, dimmed backdrop.
- Card width ~480px (or whatever fits the language).
- Header: "Keyboard shortcuts" + close (×).
- Body: a list of shortcut rows. Each row has the action on the left and the key combo on the right (in `<kbd>` styling — paper key caps).
- Current shortcuts listed:
  - Save · ⌘/Ctrl+S
  - Find & replace · ⌘/Ctrl+F
  - Bold · ⌘/Ctrl+B
  - Italic · ⌘/Ctrl+I
  - Underline · ⌘/Ctrl+U
  - Undo · ⌘/Ctrl+Z
  - Redo · ⌘/Ctrl+Shift+Z
  - Close panels · Esc
  - This help · ⌘/Ctrl+/
- Platform-aware: ⌘ on Mac, Ctrl on Windows/Linux.

### 9.4 Visual treatment of the `<kbd>` elements

These should feel like physical keys. Soft shadow, slightly raised. Paper-key feel ties to the cozy brand.

### 9.5 States

- Closed
- Opening (fade + slight scale)
- Open
- Closing
- Hover on close button

---

## 10. Surface 8 — Export modal

### 10.1 What it is

A modal where the user picks an export format (PDF, EPUB, DOCX, others) and a preset (different visual styles defined by `exportPresets`).

### 10.2 Trigger

The "Export" button in the editor toolbar's VIEW zone.

### 10.3 Visual

- Centered modal, larger than the cheatsheet — maybe 640px wide.
- Header: "Export book" + close (×).
- Body:
  - **Format picker** — visual selector for output format. Each option shows the format name, an icon, and a one-line description. Probably 3–5 options (PDF, EPUB, DOCX, possibly Markdown, plain text).
  - **Preset picker** — once a format is selected, show available presets for that format. Each preset is a small card showing a preview (a thumbnail of the rendered output if possible — title page mock), a name, and a brief description (e.g., "Classic novel" / "Modern minimal" / "Academic").
  - **Options** — possibly a few toggles (include front matter / include back matter / page numbers / table of contents).
- Footer: Cancel · **Export** (primary CTA, brand yellow).

### 10.4 States

- Closed
- Open (form-filling)
- Loading presets
- Format selected, preset chosen
- Submitting (export in progress — spinner on Export button)
- Success (close + show flash toast "Exported successfully — download started")
- Error (inline error message in modal)
- Premium-required (if export presets are premium-gated — confirm; currently unclear)

---

## 11. Surface 9 — Confirmation dialogs

### 11.1 What they are

Destructive action confirmations. Show up when the user does something irreversible:
- Delete a chapter (or any binder item)
- Delete a book (probably from the parent /studio page, but could appear from here)
- Restore a snapshot (technically reversible because pre-restore state is snapshotted, but disruptive — should it confirm? Maybe lighter confirmation)
- Force discard unsaved changes (rare)

### 11.2 Visual

- Standard centered confirmation dialog. Small, focused.
- Header: action question ("Delete chapter?")
- Body: a brief explanation ("This will permanently delete 'Chapter 12: The Confession' and its 3,240 words. This action cannot be undone.")
- Footer:
  - Cancel (secondary)
  - Delete (primary destructive — red or warning-color from the supporting palette, NOT brand yellow)

### 11.3 States

- Open
- Submitting (after clicking the destructive action)
- Error (rare)
- Close on cancel / success

---

## 12. Surface 10 — First-time and empty states

The studio editor has several "nothing here yet" moments. They are the first impression — they should be inviting, not desolate.

### 12.1 Empty book — "Start your first chapter"

- Triggered when: the user opens a brand-new book with zero binder items.
- Where: the **center pane** shows this (no chapter to display).
- Content:
  - A welcoming heading ("Start your first chapter")
  - A subtle illustration or paper-card visual (something that matches the cozy/paper brand — a blank notebook open on the desk?)
  - Encouraging body copy ("Your binder is empty. Create a chapter — you can rename it anytime.")
  - A primary button ("+ Start your first chapter") that creates a chapter and opens it in rename mode
- Tone: warm, encouraging. Not "Empty state." More like "Welcome — your story starts here."

### 12.2 Has chapters, none selected — "Select a chapter"

- Triggered when: the book has binder items but the user hasn't clicked one yet (rare — usually the first item is auto-selected, but possible after delete or refresh).
- Where: center pane.
- Content:
  - Heading ("Select a chapter to write")
  - Body ("Pick a chapter from the binder on the left, or click **+ Add** to create a new one.")
  - Maybe a small directional arrow or visual cue pointing to the binder.
- More functional, less hero — the user is mid-flow, not new.

### 12.3 Empty metadata panel — "Select a chapter to see details"

- Triggered when: the active binder item is a non-chapter (outline / note / character) or no active item.
- Where: right panel.
- A simple muted line ("Select a chapter to see details.").
- This already exists today. Just needs to be visually coherent with the new system — a quiet placeholder, not a loud empty state.

### 12.4 Empty binder

- Triggered when: the book has zero items.
- Where: left panel.
- Content: a friendly message ("Your binder is empty") + a "+ Add" prompt clearly visible.
- The new binder design from Prompt 1 should already have this — Claude Design should explicitly mock it here as part of Prompt 3 to make sure it's coherent with the empty-book center-pane (12.1).

### 12.5 Empty outline / note / character

- For each specialized editor surface (covered in Prompt 2), there's an empty-state moment when the user just created one. Prompt 2's deliverables already include empty states. Claude Design should ensure consistency — same visual language across all "nothing here yet" moments.

### 12.6 Tone

These are micro-moments but they set the tone. A new user creating their first book sees the empty state for hours before their first chapter is fleshed out. Make them feel "okay, this is a cozy place — I'm going to like this," not "broken / generic / unfinished."

---

## 13. Surface 11 — Sprint timer states

### 13.1 Where the sprint timer lives

Per Prompt 1, the sprint timer is integrated into the bottom status bar's right-side cluster. Prompt 1 established the structural layout (word counts left, sprint right). This brief focuses on the **timer's running and finished states** because those are transient visual treatments.

### 13.2 States to design here

- **Sprint setup popover** — when the user clicks "Start sprint," a small popover lets them pick the duration (15 min / 25 min / 50 min / custom). Brief and friendly.
- **Sprint running** — the timer in the status bar shows a countdown (`12:34`) with pause and stop icon-buttons. The status bar may show a subtle progress affordance — a thin progress strip or a tint that grows.
- **Sprint paused** — countdown frozen; resume and stop buttons.
- **Sprint finished** — a celebratory moment. A confetti burst? A "Sprint complete · +320 words" toast? A glow on the status bar? Claude Design proposes how to make it feel rewarding without being childish.
- **Sprint cancelled** — the timer resets quietly to idle.

### 13.3 Why this matters

Writing sprints are a key motivational ritual for authors. The visual reward at the end should feel earned, not gimmicky. Lean into the cozy brand — maybe a candle flame burning out, or a stack of pages settling — something tactile.

---

## 14. Cross-cutting requirements

- **Light/dark editor mode parity** — overlays that appear over the editor (snapshot banner, find & replace, writing analysis) must work in both editor modes.
- **Dim backdrop pattern** — modals (cheatsheet, export, confirm dialogs) all use a consistent backdrop dim. Establish the opacity / blur level.
- **Modal close patterns** — every modal closes on Esc, click-outside, and the close (×) button. Make sure the focus management is designed (focus traps for screen readers).
- **Accessibility** — all icon-only buttons in overlays have aria-labels; modals announce as dialogs with proper labelling; focus states designed.
- **Z-index discipline** — modals over drawers over overlays over banners over base chrome. Document the stack order.
- **Animations / transitions** — overlays appear and disappear with subtle motion. Document timing curves so they feel consistent. Lean toward warm, gentle ease — nothing snappy or hard-stop.
- **Brand voice in copy** — all empty states, confirmation dialogs, errors, and tooltip strings should match Beehive's warm/encouraging voice. Strict avoidance of generic SaaS phrasing.

---

## 15. Deliverables expected from Claude Design

1. **High-fidelity mockups for each surface** (3.1 through 12.4 and 13.2) in both light and dark editor modes where relevant.
2. **State variants** for each surface — including animation start/end frames if appropriate.
3. **Modal vs drawer vs overlay vs banner taxonomy** documented — a small diagram or table showing how each pattern is used, when, and the consistent styling for each.
4. **Empty state illustrations** — quick spec for any illustration / paper-card visuals used in 12.1 and 12.4 (or a recommendation to not use illustration if a text-only treatment fits better).
5. **Backdrop / overlay system** — opacity, blur, color tint when modals are open. Should feel consistent.
6. **Z-index / stacking order** — documented.
7. **Motion specs** — duration, easing, direction for each overlay's enter / exit. Subtle and gentle.
8. **Confirmation dialog system** — a reusable pattern showing the destructive variant and the standard variant.
9. **Sprint completion treatment** — proposed celebration visual.
10. **Cheatsheet `<kbd>` design** — what does a keyboard key look like in the system (paper-key feel).
11. **Corkboard interpretation** — fully realized "writer's desk / paper cards" visual; this is one of the most brand-defining surfaces.

---

## 16. Tone (same as prior briefs)

Every overlay is a temporary surface — they appear, do their job, and disappear. None should feel like they're hijacking the editor; all should feel like part of the same warm, paper-feeling workshop. The user shouldn't dread opening Export. They should feel like the cheatsheet is a friendly reminder, not a manual. Confirmation dialogs should respect that the user is in flow. Empty states should welcome, not lecture.

---

## 17. Out of scope (clarity)

- Persistent shell (Prompt 1).
- Specialized editor surfaces (Prompt 2).
- The chapter editor itself (Prompt 1).
- Book creation wizard, pricing pages, app-level nav.
- Anything outside `/[locale]/studio/[bookId]`.
- Backend integrations (Stripe, Cloudinary, etc.).

---

## 18. Closing — the three-brief system

After Claude Design delivers on Prompts 1, 2, and 3, Beehive will have a complete design system for the studio editor surface — every visible state, every interactive surface, every empty state. The implementation then becomes a mechanical port: tokens map to Tailwind v4 `@theme` values; components map to existing shadcn-style React components and TipTap configurations. The brand will have evolved from "generic dark SaaS with yellow accent" to a cohesive, distinctive, warm writer's workshop.

After implementation, the design system established here also informs the other passes Chris has flagged separately: app-level nav and book creation wizard. Those will reuse the tokens, paper-card language, and supporting palette established across these three briefs.

</pasted_text>

<!-- The user attached a local folder named "beehive-studio". It may contain a codebase, design components, or other files. Explore it with local_ls("beehive-studio") — all paths into this folder must start with "beehive-studio/". -->

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Design System (design system)">
[Design System] This project uses the **Design System** design system. This is a binding choice for visual style — every visual must follow it. Don't invent colors, type, spacing, or components not grounded here.

Scope: the design system is a visual style reference only. Its guide may describe example products, brands, or people that are unrelated to the user and unrelated to the subject of this conversation. Never treat anything in the design system as a fact about the user, their work, or the topic they asked about.

    Explore it to find what you need:
    - Always copy out the fonts and colors you need
    - For prototypes and designs, always copy out any relevant components
    - If the design system contains existing mocks of products, and you were asked to design or prototype something similar, copy and fork those mocks to start your design. This helps you make high-quality designs.
    
    Explore it quickly to find relevant UI kits (e.g. mocks of existing products you can copy and fork)

Full system at `/projects/019dc7e7-b561-7845-bc48-5be50e5e48f0/`. Before producing any visuals, explore it: call `list_files("/projects/019dc7e7-b561-7845-bc48-5be50e5e48f0/")` to see the structure, then `read_file` the README/base.md or whatever index file it has. Don't guess at the design system's contents.

For assets and UI kits beyond the guide: `read_file("/projects/019dc7e7-b561-7845-bc48-5be50e5e48f0/<path>")` and `copy_files` to bring them into the current project.
</attached-skill>

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

I have a thorough understanding of the established design language now. Let me plan and build Prompt 3.

_[tool: write_file]_

_[tool: write_file]_

Now the main document. Given its size, I'll build it in stages.

_[tool: str_replace_edit]_

_[tool: update_todos]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Prompt 3 is complete and surfaced. The doc inherits Prompts 1 + 2's tokens verbatim and adds the overlay/mode/modal layer:

- **Taxonomy + system** — five-pattern decision chart, z-index ladder, backdrop recipe, motion specs table
- **Corkboard mode** — full-bleed in studio context with binder + metadata still on; hover/drag/filter/empty states
- **Focus mode** — animated before/after comparison with 88% chrome fade
- **Version history drawer** — populated · loading · empty · free-tier upsell · error
- **Snapshot banner** — default · restoring · error · paper parity
- **Find & Replace** — replace-expanded, no-results, paper parity, highlight palette
- **Writing analysis** — readability + histogram + stats + word cloud, hand-drawn not Bloomberg
- **Cheatsheet** — paper-key `<kbd>` in dark + cream, grouped shortcut list
- **Export** — format picker · preset thumbnails · options · submitting/success/error states
- **Confirm dialogs** — destructive / warn / info weights
- **Empty states** — open-notebook SVG illustration, all four moments
- **Sprint timer** — setup popover · running pill · paused · candle+toast+confetti finish · banner alternative
- **Handoff** — locked items, open questions, three-brief recapThe three-brief system is now complete. Prompt 3 sits at `overlays-modes/Overlays Modes.html` alongside the earlier two — eleven surfaces designed in studio context, with states, light/dark parity where it matters, and a final handoff section that maps what's locked, what's still open, and what carries forward to the app-level passes.

## User

Verifier agent check completed

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

Fixed — all three confirm-dialog modals now shrink to their column instead of forcing horizontal overflow.Trivial fix done — the page no longer scrolls horizontally on §12.

