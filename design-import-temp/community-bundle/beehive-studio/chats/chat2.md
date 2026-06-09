# Chat

_Started 2026-05-26 16:26 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Beehive Studio"
Project currently has 3 file(s)
Current date is now May 26, 2026
</system-info>

<default aesthetic>
If no references, art direction or design systems were provided, use this default professional modern, minimal aesthetic as a base. Declare your choice out loud so you stick to it. Guidance:
- Choose a type pairing from web-safe set or Google Fonts. Helvetica is a good choice. Avoid hard-to-read or overly stylized fonts. Use 1-3 fonts only.
- Foreground and background: choose a color tone (warm, cool, neutral, something in-between). Use subtly-toned whites and blacks; avoid saturations above 0.02 for whites.
- Accents: choose 0-2 additional accent colors using oklch. All accents should share same chroma and lightness; vary hue.
- NEVER write out an SVG yourself that's more complicated than a square, circle, diamond, etc.
- For imagery, never hand-draw SVGs; use subtly-striped SVG placeholders instead with monospace explainers for what should be dropped there (e.g. “product shot”)

CRITICAL: ignore default aesthetic entirely if given other aesthetic instructions like reference images, design systems or guidance, or if there are files in the project already.
</default aesthetic>

<pasted_text name="Pasted text (432 lines)">
# Claude Design Brief — Prompt 1 of 3: Studio Shell

> **Project:** Beehive Studio — a solo-developer-built writing platform competing with Google Docs and Scrivener.
> **Brief audience:** Claude Design.
> **Date:** 2026-05-26.
> **Output expected:** high-fidelity mockups + design tokens for the studio editor's persistent chrome.

This is the first of three Claude Design briefs. Two follow-up briefs (Prompt 2: specialized editor surfaces; Prompt 3: overlays / modals / modes) reuse the system established here. Design with that reusability in mind — tokens, components, and patterns established in this brief will be inherited by the next two.

---

## 1. About the product

**Name:** Beehive Studio. Slogan: "Get buzzed about writing!"

**What it is:** a long-form writing platform for novelists, memoirists, and serious nonfiction writers. The studio editor is the core surface where users write books chapter by chapter, plan with outlines, keep research notes, and track character profiles. It competes directly with Scrivener (desktop, mature) and Google Docs (web, generic) — Beehive's wedge is that it's purpose-built for book-writing on the web, with a community + publishing pipeline attached.

**Who uses it:** indie authors writing 50k–120k word novels. They are at their desk for hours. The editor is the room they live in.

**Current visual language (what's being replaced):** dark-only, bee-themed. Near-black canvas (`#141414`), brand yellow (`#FFC300`) as the single accent, gray borders, no warmth. Functional but cold. Lacks the "writer's desk" feeling appropriate for a book-writing tool.

**Tech constraints (informational — Claude Design produces design only, not code):** Next.js 16 App Router, Tailwind v4 (no `tailwind.config.js`; `@theme` in CSS), shadcn/ui (New York style), lucide-react icons, TipTap v3 rich text. The design system needs to be implementable in these.

---

## 2. Brand direction

**Locked by Chris (the user):**

1. **Mixed palette.** Warm cream/paper writing surfaces (where the user actually writes prose), dark chrome around them (binder, toolbar, status bar, right panel). Think "writer's desk at night" — a warm sheet of paper on a dark wood desk lit by a lamp. The contrast is intentional: dark chrome frames the paper.
2. **Stacked-card / paper-layer visual language.** Components should feel like physical layers — subtle shadows, soft edges, depth. Not flat. Think of how Trello cards or sticky notes feel, but applied to a writing tool. Avoid hard slabs and high-contrast rectangles.
3. **Cozy. Homey. Comfortable. Book feeling.** This is the emotional target. Soft edges. Warm grays. Type that breathes. Spacing that doesn't feel cramped. A serif accent somewhere — possibly the prose body itself, possibly headings — to lean into "book" vs "app."
4. **Brand yellow** `#FFC300` stays as the primary accent. Active states. Save indicator when unsaved. Primary CTAs. Premium badges. Used sparingly — it's accent, not body.
5. **Supporting palette** — Claude Design proposes a small set of secondary colors to cover state and category needs:
   - Chapter status (5 distinct states): Idea, Outline, First Draft, Revised, Final.
   - Binder item types (6 categories): chapter, front matter, back matter, outline, research note, character. Each needs an icon color or subtle tint that's distinguishable at a glance.
   - Validation: error, success, warning.
   - The supporting palette should harmonize with cream-paper + dark-chrome, not feel imported from a different system.
6. **Typography.** Current stack: Comfortaa (headings, branding — soft rounded geometric sans), Geist (body — modern neutral sans). Propose what stays, what changes. A serif for prose body inside the editor would lean into "book feel" — recommend if appropriate. Headings could stay Comfortaa or be reconsidered.
7. **Light/dark editor toggle stays.** The user can toggle light mode (cream paper) vs dark mode (still warm — not near-black; think dark walnut or coffee, not slate) for the writing surface only. The chrome around the editor stays dark regardless. This was just built in SP4 (recently shipped).
8. **Density.** Current design is compact (240px side panels, 14px icons, tight padding). Some compactness keeps the writing area large; some breathing room serves the cozy feel. Recommend the balance.
9. **Discoverability.** Every menu, overlay, and action needs a discoverable visual entry point. Existing aria-labels (icon-only buttons announce their action) must be preserved structurally.

---

## 3. Scope of this brief (Prompt 1: Studio Shell)

The studio is at `/[locale]/studio/[bookId]`. It has three persistent columns inside the app layout. This brief covers all of that **persistent chrome** — what you see when you open a chapter and start writing.

**In scope:**
- 3.1 Binder (left panel) + its menus (per-item ⋯ menu, add menu)
- 3.2 Editor toolbar (the top bar above the prose, with ~25 buttons in two zones)
- 3.3 Editor body (the prose area itself — TipTap surface)
- 3.4 Bottom status bar (save indicator + word count + word goal + sprint timer — all integrated)
- 3.5 Right metadata panel + Publishing details expander
- 3.6 Create Hive integration (where the Hive entry point lives in the chrome)
- 3.7 Error toasts (transient notifications)

**Out of scope (covered by other briefs or by Chris separately):**
- App-level top nav bar (Chris designs separately).
- Specialized editor surfaces — Front Matter forms, Back Matter forms, Outline Kanban, Research Notes, Character profile (Prompt 2).
- Overlays and modes — Corkboard view, Focus mode, Find & Replace overlay, Writing analysis panel, Keyboard cheatsheet modal, Export modal, Version history drawer, snapshot preview banner (Prompt 3).
- Empty / first-time states (Prompt 3).
- Book creation wizard (separate later prompt).

---

## 4. The composition (orientation)

Picture a three-column row pinned to the viewport height minus the app nav (56px):

```
┌─────────────────────────────────────────────────────────────────────┐
│   App nav (h-14)  ← out of scope                                    │
├──────────┬──────────────────────────────────────┬───────────────────┤
│          │  ┌─ Editor toolbar ──────────────┐   │                   │
│          │  │ FORMAT zone  ·  VIEW zone     │   │                   │
│          │  ├───────────────────────────────┤   │                   │
│  Binder  │  │                               │   │  Metadata panel   │
│  (left)  │  │   Editor body (prose)         │   │  (right)          │
│  w-60    │  │   centered, max-w-3xl         │   │  w-60             │
│          │  │   ample top/bottom padding    │   │                   │
│          │  │                               │   │                   │
│          │  ├───────────────────────────────┤   │                   │
│          │  │ Status bar (save · words · goal · sprint)             │
│          │  └───────────────────────────────┘   │                   │
└──────────┴──────────────────────────────────────┴───────────────────┘
```

The Hive button (3.6) needs a home — Claude Design proposes options for where.

---

## 5. Surface-by-surface detail

### 5.1 Binder (left panel)

**Width:** currently 240px. Recommend adjustment if cozy density calls for it.

**Purpose:** the table of contents of the book in progress. Lists every binder item (chapter, front matter section, outline board, research note, character profile). Hierarchical — items can be nested under parents (e.g., a "Part One" parent with chapter children). Drag-drop to reorder. Click an item to make it active in the editor. The active item is the one currently open in the center pane.

**Visual top of panel:** the book's title is shown at the top. It's not editable here. There's also a button to toggle corkboard mode (Prompt 3) — small icon button.

**Item row anatomy (per item):**
- Small icon to the left indicating type (chapter / FM / BM / outline / note / character). Six icons total. These should be visually distinct so a writer scanning the tree can see "oh, that's my outline, that's a chapter" instantly. Currently lucide icons in muted gray — bland.
- Title (the item's name — user-editable).
- Right side, on hover: a ⋯ button revealing a per-item menu (5.1a).
- If the item has children: a small chevron on the left collapses/expands.
- Nested items are indented (typical tree depth: 1–3 levels).

**Item row states:**
- Default (inactive, not hovered): low-contrast text, no background.
- Hover: subtle background, ⋯ button visible.
- Active (this item is currently open in the editor): clearly distinguished — could be brand yellow accent, paper-card highlight, left-edge marker, whatever fits the language. Must be obvious at a glance.
- Pending rename: the title transforms to an inline text input, auto-focused. Press Enter to commit; Escape to cancel.
- Drag preview (during DnD): the row visually lifts (shadow grows, slight tilt or scale).
- Drop target: another row or the binder background shows where it'll land.

**Bottom of panel: the + Add menu (5.1b).** Primary entry point for creating a new item.

#### 5.1a Per-item ⋯ menu
- Triggered by clicking the ⋯ icon on a row (appears on row hover).
- Opens a small popover with action items:
  - Rename (enters inline-rename mode on that row)
  - Duplicate
  - Delete (destructive — should be visually distinguished, red-ish, or require a confirmation step)
- Plus potentially: Move to (nested submenu listing parent options), Change type (if applicable).
- States: open / closed; hover on each action; the destructive action visually marked.

#### 5.1b + Add menu (binder's primary action)
- A primary button at the bottom (or wherever Claude Design recommends) labeled "+ Add" or with a "+" icon.
- Click → opens a popover listing the item types you can create:
  - Chapter
  - Front Matter
  - Back Matter
  - Outline
  - Research Note
  - Character
- Each menu item shows the type's icon + name. Optionally a one-line description.
- Selecting an item creates it at the appropriate location (root or nested under whatever's active), scrolls to it in the binder, and immediately enters rename mode on the new item.
- States: open / closed; hover per option.

---

### 5.2 Editor toolbar

**Where:** the top of the center pane, above the prose. A horizontal bar. Currently has a thin border below it and a slightly different background from the body to distinguish.

**Purpose:** formatting actions for the prose (left-side cluster) and view/mode controls (right-side cluster).

**Layout:** three logical zones — FORMAT (left), flex spacer in the middle, VIEW (right). All buttons are small icon-only (or icon + small label in two cases). Most use a shared `ToolbarButton` wrapper that includes a tooltip and an aria-label.

**FORMAT zone (left → right, with vertical separators between groups):**

Group 1 — Inline:
1. Bold (B icon)
2. Italic (I icon)
3. Strikethrough (S with line through)

Group 2 — Block:
4. Heading 1
5. Heading 2
6. Heading 3

Group 3 — Lists & structure:
7. Bullet list
8. Numbered list
9. Blockquote
10. Horizontal rule

Group 4 — History:
11. Undo (can be disabled when nothing to undo)
12. Redo (can be disabled when nothing to redo)

Group 5 — More formatting:
13. Underline
14. Highlight
15. Link (toggles a small URL prompt; active when current selection is a link)

Group 6 — Alignment:
16. Align left
17. Align center
18. Align right

**VIEW zone (left → right inside the right cluster):**

19. Find & Replace (Search icon) — opens an overlay (Prompt 3). Active state when overlay is open.
20. Version history (Clock/History icon) — toggles the right-panel drawer (Prompt 3). Active when drawer is open.
21. Keyboard shortcuts help (HelpCircle icon) — opens a centered modal listing shortcuts (Prompt 3).
22. Editor theme toggle (Sun / Moon icons — shows the icon for the destination mode). Toggles the editor body between cream-paper light mode and dark mode. Chrome doesn't change.
23. Font size selector — a `<select>` dropdown with values 12 / 14 / 16 / 18 / 20 / 24 px. Affects the prose body's font size only. Saved to localStorage.
24. Export (Download icon + the text "Export") — opens the export modal (Prompt 3).
25. Writing analysis (BarChart3 icon) — toggles an analysis panel that slides in from the right (Prompt 3). Active when panel is open.
26. Focus mode (Maximize2 / Minimize2 — shows the icon for the destination mode). Toggling hides binder + metadata panel; the editor expands to full width.

**Per-button states:**
- Default (idle)
- Hover (subtle bg)
- Active (button is "on" — e.g., Bold while inside a bold selection, or Find while the overlay is open) — brand-yellow accent or equivalent
- Disabled (e.g., Undo with empty history) — visibly dimmed
- Pressed (instant feedback on click)

All icon-only buttons must have aria-labels (this is already wired in code via the `ToolbarButton` wrapper).

**Responsive consideration:** mobile is out of scope for now, but the toolbar gets dense on narrow viewports. Recommend at most a graceful-degradation approach (e.g., collapse less-used FORMAT buttons into an overflow menu) without redesigning for mobile this pass.

---

### 5.3 Editor body

**Where:** the center pane between the toolbar (5.2) and the status bar (5.4).

**Purpose:** the actual writing surface. A TipTap v3 rich-text editor rendering prose with H1/H2/H3 headings, bold/italic/underline/strikethrough/highlight, links, lists, blockquotes, horizontal rules, and align-left/center/right paragraphs.

**Current shape:** the prose container is centered horizontally with a max-width around 768px (a comfortable reading line length), with generous top/bottom padding. Font-size is user-controlled (5.2 #23). Line-height is roomy (~1.8). The TipTap surface is a contenteditable div — the cursor appears when the user clicks anywhere in the prose.

**Visual states:**
- **Default (empty chapter):** a placeholder shows ("Start writing…") in a muted color.
- **Default (with content):** prose rendered cleanly with hierarchy — H1/H2/H3 visually distinct, blockquotes indented and styled, lists with proper bullets/numbers, links styled in brand yellow, highlighted text with a subtle background.
- **Selection:** standard browser selection plus TipTap-managed marks (bold/italic toggle reflects in the toolbar).
- **Light mode (paper):** cream background, dark prose. This is the "cozy book" mode.
- **Dark mode (current):** dark canvas, light prose.
- **Read-only (snapshot preview):** non-editable; a banner above (covered in Prompt 3).
- **Loading skeleton:** when switching items, the prose briefly shows a loading state (handled in code).

**Special concern: how the prose looks IS the product.** This is the surface the user spends 95% of their time looking at. Make it inviting. A book-like serif could be considered for the prose itself (while keeping headings in Comfortaa or whatever heading face is recommended). Get the line length, line-height, and font weight to feel like a high-quality book reader — but with a writeable, modern web feel.

---

### 5.4 Bottom status bar (NEW STRUCTURE)

**Where:** pinned to the bottom of the center pane, full width of that pane. Single thin horizontal strip.

**Purpose:** at-a-glance status of the current writing session.

**LAYOUT — Chris locked this structure:**

- **Left side cluster (all the word-count things):**
  1. Save indicator: `● Saved` (default) · `○ Saving…` (animate-pulse) · `● Unsaved` (brand yellow).
  2. Separator (subtle dot or vertical pipe).
  3. Word count: `1,240 words`.
  4. Separator.
  5. Word goal display + inline edit:
     - Unset state: `Set word goal` link.
     - Set state: `45% of 2,000 word goal · edit`.
     - Editing state: a small number input replaces the goal text, with Save and Cancel buttons.

- **Right side cluster (sprint timer — newly integrated here):**
  1. Sprint timer control. States:
     - Idle: `Start sprint` button (with a small timer icon).
     - Sprint setup: clicking might show a quick popover to pick duration (15 min, 25 min, custom) — Claude Design recommends UX.
     - Running: countdown display (e.g., `12:34`) with pause and stop icon-buttons inline.
     - Paused: countdown frozen + resume and stop icon-buttons.
     - Finished: a brief celebratory state, then resets to idle. Could show "Sprint complete · +320 words" momentarily.

**Visual treatment:** thin (probably 32–40px tall). Background distinct from the prose body but consistent with editor theme. In light editor mode, this bar flips to a lighter warm tone matching the cream paper system; in dark mode, it stays dark to match chrome.

**States:**
- Default: shows current save status + counts.
- Sprint running: a subtle progress affordance (e.g., the bar tinted, or a thin progress strip along the top of the status bar showing sprint progress) would help.
- Light editor mode: status bar surface flips to a lighter, paper-adjacent tone.

---

### 5.5 Right metadata panel

**Where:** right-side column, width 240px. Same column slot will sometimes be replaced (Prompt 3) by the version history drawer or hidden entirely (focus mode, corkboard mode).

**Purpose:** chapter-level metadata for the currently active item. Behavior depends on item type:

- If active item is a chapter / front matter / back matter: show the metadata sections (5.5a–5.5g).
- If active item is something else (outline, note, character) OR no active item: show a single centered placeholder ("Select a chapter to see details.").

**Sections — top to bottom — when populated:**

#### 5.5a Title
- Shows the current item's title.
- Click → transforms into an inline input. Enter commits the new title. Escape cancels. Saving is debounced.

#### 5.5b Status pills
- Five chapter-status options as small pills in a horizontal row (may wrap to two rows on narrow widths): Idea · Outline · First Draft · Revised · Final.
- The current status is highlighted. Click another to change.
- This is one of the prime use cases for the **supporting palette** — each status could have its own color so writers see at a glance "I have 3 chapters in First Draft and 2 in Revised."

#### 5.5c Synopsis
- A small textarea labeled "Synopsis."
- Free-form one-line-or-paragraph summary of this chapter.
- Debounced autosave; placeholder "One-line chapter summary…".

#### 5.5d Scene Planner (chapter type only — hidden on FM/BM)
- A collapsible section labeled "Scene Planner."
- When expanded: three small textareas — Goal · Conflict · Outcome. Standard scene-structure prompts for narrative writers.
- States: collapsed (default) / expanded.

#### 5.5e Notes
- A larger textarea labeled "Notes" — private author notes (only the author sees these, never published).
- Placeholder: "Private notes — only you can see these."
- Debounced autosave.

#### 5.5f Publishing details (collapsible expander, pinned at bottom of panel)
- A separate visual section pinned at the BOTTOM of the right panel — visually distinct from the chapter-level sections above. The visual distinction matters because publishing details apply to the WHOLE BOOK, not just the current chapter; users were confused otherwise.
- **Header:** a row containing a chevron (▸ / ▾), the label "Publishing details," a small "Premium" badge, and a subtitle "Applies to the whole book, not just this chapter."
- **Collapsed state:** just the header.
- **Expanded state (premium user):** several form fields stacked:
  - Subtitle (text input)
  - ISBN (text input)
  - Publisher name (text input)
  - Dedication (text input)
  - Edition (text input)
  - Author bio (textarea, ~3 rows)
  - Trim size (select: 5×8 / 5.5×8.5 / 6×9)
- **Expanded state (non-premium):** an inline upsell card explaining the feature is premium, with an "Upgrade" link.
- **Saving indicator:** "Saving…" appears in the header (right side) during a save.

#### 5.5g Loading / empty
- Brief loading state while metadata is fetched.
- Empty title shows the empty placeholder; otherwise sections always render in order.

---

### 5.6 Create Hive integration

**What is a Hive:** in Beehive's broader product, a Hive is a private writing group — a small circle of authors who share progress, give feedback, and read each other's drafts. Each Hive has up to 5 members on the free tier (premium raises the cap).

**Current state:** a "Create Hive" button + modal exists as components inside the studio (`create-hive-button.tsx` + `create-hive-modal.tsx`). It's not clear where this button is mounted today — assume it currently lives somewhere on the studio chrome but its placement is suboptimal.

**Goal for this design pass:** Claude Design proposes **2–3 placement options** for the Hive entry point in the studio chrome and a visual treatment for the button + modal. Considerations:

- The Hive isn't a per-chapter concept — it's per-book or per-user-level.
- It's an outbound action from the studio (you go from your writing surface to your group), so a primary action treatment isn't appropriate (it shouldn't compete with Write/Edit).
- It should feel like a related-but-secondary action. Possible placements:
  - Inside the binder header next to the book title.
  - Bottom of the binder beneath the + Add menu (a small "Share with your Hive" or "Open Hive" button).
  - Inside the metadata panel as a section ("Hive · 4 members · view").
  - Inside an "Actions" cluster on the studio chrome — possibly near the future home of Publish.
- Claude Design recommends one with rationale, but provides the 2–3 candidates for Chris to choose from.

**Modal visual:** the Create Hive modal asks for a Hive name + optional description + initial members (search by username/email). Standard form modal — should feel consistent with the new design system (cards, warm-paper feel inside dark chrome).

**States to mock for the button:**
- Default (no hive yet — "Create Hive")
- User has a hive (button becomes "Hive · 3 members" or similar — entry point to manage)
- Modal: closed / opening / form-filling / submitting / success / error.

---

### 5.7 Error toasts

**Where:** fixed-positioned overlay; not part of the column layout.

**Purpose:** transient flash messages for save failures, action confirmations, restore success, premium-required errors, etc. Triggered by a `pushFlash` function from the editor provider.

**Visual states to mock:**
- Info (default — neutral, brief)
- Success (e.g., "Restored to Today 2:14 PM")
- Error (e.g., "Save failed — try again")
- Premium required (e.g., "Premium required to restore")

**Behavior:** appear from the bottom-right (or wherever fits), auto-dismiss after a short period (3–5s), can be manually dismissed.

---

## 6. Modes that affect the shell (informational — Prompt 3 will fully cover)

These modes change what's visible in the shell. Claude Design needs to be aware so the persistent surfaces work correctly when they're hidden:

1. **Focus mode** — hides the binder + metadata panel. Only the editor toolbar + body + status bar remain. Chrome around the prose should still feel cohesive even when sidebars are gone.
2. **Corkboard mode** — replaces the editor body with a grid of chapter cards. The toolbar and status bar may or may not still be visible — Claude Design recommends. Binder + metadata panel stay.
3. **Version history mode** (`historyOpen`) — the right metadata panel is replaced by the history drawer (Prompt 3). Toolbar gets an "active" state on the history button.

The shell must accommodate these gracefully.

---

## 7. Cross-cutting requirements

- **Light/dark editor toggle.** All shell surfaces must work with both editor modes. Specifically, the editor body, status bar, and any prose-adjacent area should flip per editor theme. The binder, toolbar buttons themselves, metadata panel chrome, and right-panel chrome stay in their main palette regardless.
- **Premium gating.** Publishing details (5.5f) and version history (Prompt 3) are premium-gated. Premium badges should have a consistent treatment across the system.
- **Accessibility.** Icon-only buttons announce their actions via aria-labels — this is already in code. Visual focus states must be designed (focus-visible rings or equivalent). Color contrast on light + dark modes meets WCAG AA for body text and AA Large for UI text.
- **Empty states.** Beyond the metadata placeholder noted in 5.5g, the binder can be empty on a new book — Prompt 3 covers the "start your first chapter" empty state, but the binder's empty visual treatment belongs here. Claude Design should mock it as part of the binder.
- **Responsive.** Mobile not in scope this pass. Tablet (≥768px) should remain usable — propose graceful collapse if anything is too dense.

---

## 8. Deliverables expected from Claude Design

1. **Design tokens** — proposed values for:
   - Background colors (chrome dark, editor-paper light, editor-dark, panel surfaces, hover, active).
   - Borders and dividers.
   - Text colors (primary, secondary, muted, on-paper, on-dark, accent).
   - Brand and supporting palette (with names — e.g., `brand-yellow`, `status-first-draft`, `type-character`, `success`, `warning`).
   - Typography (font families chosen, scale, line-heights, weights).
   - Spacing scale and component padding presets.
   - Shadow / elevation scale (3–4 levels — important for stacked-card language).
   - Radii (small, medium, large).

2. **High-fidelity mockups** of each numbered surface (5.1 through 5.7), in both light editor mode and dark editor mode where applicable. For each surface, include all the states listed.

3. **Component anatomy callouts** — for at least the binder row, toolbar button, status pill, and publishing expander, annotate the components so they can be implemented faithfully.

4. **Hive button placement** — 2–3 candidate placements with a recommendation and rationale (per §5.6).

5. **The "stacked-paper / cozy" interpretation** — show the design language clearly. If it's just "rounded corners on dark gray," it hasn't hit the brief. Look for opportunities to use subtle texture, layered shadows, ivory edges, warm tones, or other treatments that evoke the book-feeling.

6. **A short rationale doc** — 1–2 pages explaining the design choices (palette logic, typography choice, density decisions, recommendations on the open questions).

---

## 9. Out of scope for THIS prompt

Listed again for clarity:
- App-level top nav bar.
- Specialized editor surfaces (Front Matter, Back Matter, Outline, Notes, Character — see Prompt 2).
- Corkboard, Focus, Find & Replace, Writing analysis, Keyboard cheatsheet, Export, Version history drawer, snapshot preview banner (see Prompt 3).
- First-time empty states and onboarding (Prompt 3).
- Book creation wizard.
- Pricing / upgrade pages.
- Anything outside `/[locale]/studio/[bookId]`.

---

## 10. Tone

Beehive's brand voice is warm, encouraging, slightly playful (the bee-themed name, the "Get buzzed about writing!" slogan), but it's a serious tool for serious writing. The design should feel:

- **Warm, not corporate.**
- **Crafted, not generic.**
- **Calm, not noisy.**
- **A place a writer wants to be for hours.**

Lean cozy. Lean paper. Lean book.

</pasted_text>

<!-- The user attached a local folder named "beehive-studio". It may contain a codebase, design components, or other files. Explore it with local_ls("beehive-studio") — all paths into this folder must start with "beehive-studio/". -->


<system-reminder>Auto-injected reminder (ignore if not relevant): do not recreate copyrighted or branded UI unless the user's email domain matches that company. Create original designs instead.</system-reminder>

## Assistant

_[tool: list_files]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: read_file]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: read_file]_

I have enough context to understand the system. The user wants a comprehensive design brief delivered: design tokens + high-fidelity mockups for the studio editor's persistent chrome (binder, toolbar, editor body, status bar, metadata panel, Hive integration, toasts). Let me ask a few critical questions before diving in, since this is large.

_[tool: update_todos]_

The brief is locked and detailed — no questions needed. I'll deliver this as a single design document with all the tokens, mockups, states, and rationale in one navigable page.

**My system choice (declared upfront):**
- Chrome: warm walnut/espresso (not slate) — oklch hues around 50–65° (warm umber)
- Paper: ivory cream surfaces for the prose area
- Type: Comfortaa (display/brand) + Geist (UI) stay. **Newsreader** (open serif) added for prose body in editor — the "book feel" the brief calls out. JetBrains Mono for ISBN/numerics.
- Stacked-paper depth: inset white highlight + sub-pixel dark edge + soft drop, on every elevated card
- Density loosened slightly (binder 264, metadata 280, row 36px)

Let me build it.

_[tool: write_file]_

_[tool: write_file]_

Now the main design document. I'll structure it as a long-form spec with sticky nav, building component-by-component.

_[tool: write_file]_

Now the icon set + main HTML. I'll use a single SVG symbol definitions block then `<use>` references everywhere.

_[tool: write_file]_

Now the main HTML file. I'll write it in two parts to keep individual writes manageable.

_[tool: show_html]_

Let me check progress before continuing.

_[tool: show_to_user]_

_[tool: str_replace_edit]_

Now let me add the studio shell composition and binder sections.

_[tool: str_replace_edit]_

Let me continue with the binder, toolbar, editor body sections.

_[tool: str_replace_edit]_

Now status bar, metadata panel, Hive placements, toasts, modes, and handoff.Now Hive placement, toasts, modes, handoff.

_[tool: str_replace_edit]_

_[tool: update_todos]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Delivered — `studio-shell/Studio Shell.html` is a single navigable spec covering all of Prompt 1.

**What's in the doc (12 sections, sticky TOC):**
1. Rationale — six locked decisions
2. Tokens — full chrome + paper + dark canvas scales, brand, 5 statuses, 6 type colors, type, spacing, radii, elevation
3. Studio shell — full 1440×880 composition in **both** dark editor and light/paper editor modes
4. Binder — 6 row states (default · hover · active · renaming · drag · drop), 6 item types with tinted icons, ⋯ menu, + Add menu, empty state
5. Toolbar — full + responsive collapse, 5 per-button states, link prompt, font-size dropdown
6. Editor body — paper + coffee with full prose specimen, empty state, snapshot read-only
7. Status bar — 10 states (idle / saving / unsaved / goal-unset / editing / sprint setup / running / paused / complete / light)
8. Metadata panel — chapter default · scene planner expanded · publishing expanded · empty · non-premium upsell · seam anatomy
9. Hive — **3 placements** (binder footer recommended, header chip, metadata panel) + Create Hive modal + 4 modal states
10. Toasts — info / success / error / premium + stacking
11. Modes — Focus / Corkboard / Version history mocks
12. Handoff + open questions for Chris

**Key decisions to flag:**
- Warm walnut chrome (not slate) — I rotated every neutral to ~55° hue
- Newsreader added as the prose face; Comfortaa stays for branding/headings
- Binder 240→264, metadata 240→288, row 28→36 — cozier without shrinking prose
- Brand yellow restricted to 5 places (active row, unsaved dot, +Add, premium, active toolbar btn)
- Hive recommendation: binder footer (rationale in §9)

Tokens are in `studio-shell/tokens.css` — drop-in for your Tailwind v4 `@theme` block. Prompts 2 & 3 will inherit verbatim.

