# Chat

_Started 2026-05-26 17:17 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Beehive Studio"
Project currently has 4 file(s)
User is viewing file: studio-shell/Studio Shell.html
Current date is now May 26, 2026
</system-info>

<pasted_text name="Pasted text (380 lines)">
# Claude Design Brief — Prompt 2 of 3: Specialized Editor Surfaces

> **Project:** Beehive Studio. **Audience:** Claude Design. **Date:** 2026-05-26.
> **Sequence:** second of three briefs. Inherits the design system established in Prompt 1 (Studio Shell).
> **Output expected:** high-fidelity mockups + extensions to the design system for the non-chapter editor surfaces.

This brief depends on Prompt 1 having established the foundation: brand palette (cream paper + dark chrome, brand yellow, supporting colors), typography (recommended in Prompt 1), spacing/density choices, the stacked-card / cozy / book-feeling visual language, and the persistent chrome (binder · toolbar · status bar · metadata panel) that frames these specialized surfaces.

These specialized surfaces all live in the **center pane** of the studio (between the persistent binder and metadata panel). When the user clicks a non-chapter binder item, the center pane swaps from the TipTap chapter editor (covered in Prompt 1, §5.3) to one of these specialized editors.

---

## 1. Context (compressed — see Prompt 1 for full)

Beehive Studio is a book-writing platform for indie authors. The studio editor at `/[locale]/studio/[bookId]` has three columns: binder (left), center pane (book content), metadata panel (right). The **center pane** is what this brief covers — specifically, what the user sees when their active binder item is NOT a regular chapter.

Brand direction (locked, see Prompt 1):
- Mixed palette: warm cream paper for the writing surface, dark chrome around.
- Stacked-card / paper-layer visual language.
- Cozy. Homey. Book feeling.
- Brand yellow `#FFC300` as primary accent; supporting palette for state/category.
- Light/dark editor toggle (the writing surfaces flip; chrome stays dark).

---

## 2. Scope of this brief

There are six binder item types in Beehive. Prompt 1 covered the regular `chapter` type's editor. This brief covers the other five — plus a generic fallback.

**In scope:**
- 2.1 Front Matter / Back Matter (5 subtypes — title page, copyright, dedication, acknowledgments, about author)
- 2.2 Outline boards (currently Kanban — Claude Design rethinks the format)
- 2.3 Research Notes
- 2.4 Character profile
- 2.5 Generic textarea fallback (catch-all for binder types without a specialized renderer)

**Out of scope (covered in other briefs):**
- The persistent studio shell (Prompt 1).
- Overlays, modals, modes — Corkboard, Focus, Find & Replace, etc. (Prompt 3).
- Regular chapter editor (Prompt 1, §5.3).

---

## 3. The shared pattern — for context

Architecturally, every specialized editor shares one technical pattern:
- Each binder item has a `content` jsonb column that carries the subtype-specific data.
- When the user clicks a non-chapter item in the binder, the center pane branches to the right specialized renderer.
- Saves are debounced and autosaved with a save-status badge (small visual indicator showing Saved / Saving / Unsaved).

Visually, every specialized editor should:
- Feel like a coherent member of the same design family (consistent header treatments, save indicator, transitions).
- Inherit the bottom status bar from Prompt 1 where relevant (or be designed without it if the surface doesn't have word count — e.g., the Outline doesn't have "words").
- Use the cream-paper writing surface where the user is producing text content (FM/BM previews, note bodies, character bio fields).
- Use a slightly different chrome treatment for the structural / planning surfaces (Outline) — those aren't prose writing, they're organizing work.

---

## 4. Surface 1 — Front Matter / Back Matter (WYSIWYG preview)

### 4.1 What this surface is for

When a book is exported (PDF / EPUB / DOCX), it includes more than chapters — it has a title page, a copyright statement, possibly a dedication, possibly acknowledgments, possibly an "About the author" section, and so on. These are **front matter** (before the chapters) and **back matter** (after the chapters).

Today the user fills these out via subtype-specific form fields ("Book title:", "Subtitle:", "Author:" inputs stacked vertically). Functional but feels like an admin panel — at odds with the book-writing experience.

### 4.2 New direction: WYSIWYG previews

**Locked by Chris:** reimagine these as live-editable previews of the actual book page that will be produced at export. The user sees a styled rendition of the title page (centered title, byline, big text) and edits the actual rendered text — not filling a form, but typing onto the page.

For each subtype, the visual is a "page" — a paper-card surface, roughly book-page-shaped (taller than wide), centered in the pane with comfortable padding around it. The user clicks on a piece of text to edit it inline. Empty fields show as placeholder text with a subtle indicator that they're editable (not just static).

### 4.3 The subtypes

There are **5 front/back matter subtypes**. The same binder item type (`front_matter` or `back_matter`) is used; the subtype is a property the user picks via a subtype picker.

#### 4.3a Title page
- The most iconic book page. Centered vertically and horizontally.
- Editable fields (rendered as live text on the page):
  - **Book title** (large, primary — likely 32–48pt depending on type system)
  - **Subtitle** (smaller, italic or different weight, beneath the title)
  - **"a novel by" (or similar byline copy)** — optional small label
  - **Author name** (medium-large, usually one line below the title block)
  - Decorative element optional (publisher logo placeholder, or a small ornament)
- The look should feel like flipping open a real book to its title page.

#### 4.3b Copyright
- Smaller text, more legal feel. Typically left-aligned or centered, smaller font, in the middle or upper-third of the page.
- Editable fields:
  - **Copyright year**
  - **Copyright holder** (usually the author or a publishing entity)
  - **Edition** (e.g., "First Edition" — optional)
  - **ISBN** (formatted)
  - **Publisher name** (and possibly address)
  - **Rights statement** (the standard "All rights reserved. No part of this book may be reproduced..." paragraph — likely a free-form textarea so the user can customize)
- Layout: a paragraph block. Feels like the real copyright page of a book.

#### 4.3c Dedication
- A single short field. Centered, italic, with generous space.
- "For Maya, who said I should write this."
- One field — the dedication text itself. Anything from one line to a short paragraph.

#### 4.3d Acknowledgments
- Long-form. Reads like a chapter — paragraphs of "Thanks to..." text. Can run multiple pages in a real book.
- Has a heading "Acknowledgments" (centered, top of page, in the heading face).
- Then a flowing body of rich text below (with light formatting — possibly bold for names, italic for emphasis).
- Could use the same TipTap-style prose treatment as chapters, just preceded by the heading.

#### 4.3e About the Author
- A heading "About the Author."
- An optional **author photo** (placeholder/upload affordance).
- A **bio** body (rich text, ~1–3 paragraphs).
- Optional **links** (website / social).

### 4.4 The subtype picker

Above the page preview, a small UI element lets the user switch what subtype this binder item is. (E.g., they created a "Front Matter" item generically and now choose "Title Page" as its specific type.)

Visual: a dropdown or pill bar showing the 5 subtypes; the current one is highlighted. Switching changes the page rendering and may discard fields that don't apply (with confirmation).

States:
- Default (a subtype is selected — the page renders)
- "No subtype chosen yet" — the picker is prominent; the page shows a brief explainer ("Choose the type of front/back matter page this is.")
- Switching states.

### 4.5 The save status badge

Small badge that mirrors the editor's save indicator: `● Saved` / `○ Saving…` / `● Unsaved`. Should live consistently with the page preview — possibly in the top-right corner of the page, like a real document's "last saved" indicator.

### 4.6 Page chrome and surrounding space

Around the page preview, the center pane has dark chrome (consistent with the rest of the studio chrome). The page itself is the cream-paper writing surface. Think of it like a book page set on a dark desk.

- A subtle shadow under the page makes it feel like a physical sheet.
- The pane itself can scroll if the page is taller than the viewport.
- Optional: a "page settings" affordance to peek at typographic settings (font choice for this matter page, alignment) — recommend if appropriate, otherwise defer.

### 4.7 States

For each subtype:
- Default (populated)
- Empty (all fields blank — placeholder text guides the user)
- Active typing (showing the inline edit caret)
- Saving / saved transition
- Switching between subtypes
- Light/dark editor mode parity

### 4.8 Implementation note (informational)

Today the FM/BM forms exist as separate React components per subtype (`title-page-form.tsx`, `copyright-form.tsx`, `dedication-form.tsx`, `acknowledgments-form.tsx`, `about-author-form.tsx`) with a dispatcher. The new design will reuse this dispatcher pattern but each subtype will be a WYSIWYG preview component instead of a form-fields component. Claude Design doesn't need to think about implementation — just deliver the visual / interaction design.

---

## 5. Surface 2 — Outline

### 5.1 What this surface is for

The Outline is a planning surface. Authors use it to plan a novel before writing — laying out the structure of the story, organizing scenes/beats by act, tracking plot threads, etc. Not a writing surface per se; a thinking-and-planning surface.

### 5.2 Current state (being replaced)

Today the Outline is a Kanban board: columns (e.g., "Act 1 / Act 2 / Act 3"), with draggable cards inside columns representing chapters or beats. Cards can be linked to actual binder chapters (chapter-link popover). Functional Kanban — works fine but isn't differentiated, and feels more like a generic project-management tool than a novelist's workspace.

### 5.3 New direction: propose alternative layouts

**Locked by Chris:** Claude Design proposes **2–4 alternative layouts** that better serve a novelist's planning needs, while staying consistent with the cozy / book-feeling brand. Possible directions (suggestive — Claude Design should explore freely):

- **Timeline view** — horizontal scrolling timeline with story beats arrayed by chronology. Could show parallel storylines as horizontal swim lanes.
- **Beat sheet** — vertical list of story beats keyed to a structure template (Save the Cat, Three Act, Hero's Journey). Each beat is a card with title + description + linked-chapter.
- **Story arc visualization** — a literal arc (rising action → climax → falling action) with cards placed along the curve.
- **Mind-map / radial** — central premise in the middle, branches for characters / plot threads / themes radiating outward.
- **Index-card stack** — a physical-feeling stack of index cards on a desk; user drags and rearranges.
- **Kanban refined** — the current model but with the new visual language (paper-card columns, index-card cards, stacked-paper depth).

Recommend **at least one** "primary" outline view that ships first and **one or two alternatives** that could be future view-mode toggles (the same data, different visualization). Show the data model can support multiple views: each "card" / "beat" has a title, a description, optional links to chapters, optional tags or status, optional position.

### 5.4 Card / beat anatomy

Whatever the layout, each unit (card / beat / node) should support:
- A title (one line, editable inline).
- A description (a short paragraph, expandable).
- A status (optional — could mirror chapter status or be its own taxonomy).
- A link to a binder chapter (when this beat corresponds to an actual draft chapter, show "→ Chapter 12: The Confession" and clicking jumps to that chapter in the editor).
- Tags or color labels (optional, to organize by POV character / storyline / theme).
- Drag handle / repositioning affordance.

Card states:
- Default
- Hover
- Selected / focused
- Being dragged
- Linked-to-chapter (visually distinct from unlinked beats)
- Empty placeholder card ("Add a beat" prompt)

### 5.5 The Outline as a whole

- The center pane is wider and more interactive here than for prose. It's a workspace, not a reading surface.
- A header strip at the top: outline title (editable) + a view-mode switcher (if multiple layouts are recommended) + a save status badge + maybe an "Add beat" / "Add column" / "Add section" primary action.
- Empty state: a friendly "Plan your story — add your first beat" with a clear primary action.
- Lots of cards (a fully-outlined novel might have 30–60 beats) — needs to be navigable. Horizontal scroll for timeline, infinite scroll or pagination for very long lists.

### 5.6 Inheritance from Prompt 1 chrome

- The Outline does NOT need the bottom status bar (no word count concept) — Claude Design can recommend whether to hide it, replace it with outline-specific info (beat count, etc.), or keep it for navigation consistency.
- The right metadata panel may need outline-specific metadata when an outline item is active — propose what should go there (or whether it should hide).

### 5.7 Chapter-link popover

When the user wants to link a card/beat to an actual binder chapter, they invoke a popover that lets them search and pick from existing chapters in the book. Visual:
- Search input ("Find a chapter...")
- List of matching chapters with their titles and statuses
- Click to link; X to unlink
- States: open / closed / searching / no-results

---

## 6. Surface 3 — Research Notes

### 6.1 What this surface is for

A standalone rich-text note for research, character bios, world-building, scene ideas, anything that isn't a chapter but needs to be written and kept alongside the book. Common use: a note titled "Magic system rules" or "Maya's backstory."

### 6.2 Layout

A simpler relative of the chapter editor. The user gets:
- A title at the top (inline-editable, larger).
- A small note-specific toolbar (formatting controls — bold/italic/lists/links — fewer than the chapter toolbar).
- A rich text body (TipTap, same prose treatment as chapters but possibly slightly different — these are notes, not prose).
- Note attribute controls: tags, color label, pinned state. Position these somewhere accessible — propose a header strip beneath the title.
- Save status indicator.

### 6.3 Visual treatment

Same paper-card writing surface as a chapter. But the note feels more like an index card / personal note than a "book page" — possibly a slightly more casual visual (rougher edges? a paperclip metaphor? subtle texture?). Or maybe just a cleaner, slightly smaller surface than a chapter. Recommend.

### 6.4 States

- Default (with content)
- Empty / new note (cursor in title, then in body)
- Saving / saved
- Light/dark mode parity
- Pinned (visual distinction in binder — also relevant for binder design from Prompt 1)
- Tagged / labeled

### 6.5 The note-attribute controls

A small cluster (top of note, or side rail) for:
- Tags (multi-select chip input)
- Color label (small swatch row — uses the supporting palette)
- Pin/unpin toggle

Should feel like sticky-note flair — flag, color, label — without becoming visually noisy.

---

## 7. Surface 4 — Character Profile

### 7.1 What this surface is for

A structured character sheet for a fictional character in the book. Common fields novelists track:
- Name, age, role in story (protagonist / antagonist / supporting)
- Appearance (physical description)
- Personality (traits, quirks, mannerisms)
- Motivations / goals
- Backstory
- Character arc (how they change over the story)
- Relationships (links to other characters)
- Notes (free-form)

### 7.2 Layout

This is the most structured of the surfaces. A profile-sheet feel — labeled fields arranged in a sensible flow. But it should still feel like a writer's notebook, not a form.

Possible layouts:
- **A) Sheet style** — like a character sheet from a tabletop RPG / writing workbook. Labeled fields with hand-drawn-feel headings, fields that look like writing lines.
- **B) Card grid** — each section (Appearance / Personality / Backstory / Arc) is its own paper card. Drag to reorder, expand/collapse.
- **C) Narrative profile** — the fields are presented as inline-editable text in a flowing layout that reads more like a Wikipedia article or character bio than a form.

Recommend one with rationale. Either way, the surface needs:
- An optional **character image** (avatar upload — placeholder when empty).
- A **name** (large, editable inline).
- Section-based content for the structured fields.
- A free-form notes section at the bottom.

### 7.3 Relationships

A subsection for relationships — link this character to other characters in the binder. UI: similar to the chapter-link popover, but for characters. A list of "Maya → Sam (sister)" entries.

### 7.4 States

- Default (populated)
- Empty / new character (only name + avatar placeholder, prompts to fill out)
- Saving / saved
- Light/dark editor mode parity

---

## 8. Surface 5 — Generic non-chapter fallback

### 8.1 What this surface is for

A catch-all for binder item types that don't have a specialized renderer yet. Currently used for any type the dispatcher doesn't recognize — falls back to a single big textarea with the item's title at the top.

### 8.2 Design treatment

This surface should be minimal and not invite long-term reliance — it's a temporary holder until that item type gets a proper renderer. But it still needs to feel coherent with the rest of the system:
- Title at the top.
- A textarea for raw text.
- Save status indicator.

Visually plain. Same paper-card surface, fewer affordances. Possibly a small disclaimer / hint that this is a basic editor.

### 8.3 Outlook

Likely deprecated once Outline / Notes / Character all have full renderers and the binder doesn't expose any unrendered types. Design lightly.

---

## 9. Inheritance from Prompt 1

These specialized surfaces all sit inside the same studio shell from Prompt 1. The following surfaces continue to render around them:
- The binder (left) — unchanged.
- The bottom status bar (where applicable — FM/BM previews and notes have word count concepts; Outline doesn't; Character is borderline). Recommend per surface.
- The metadata panel (right) — its content changes based on active item type. Today, non-chapter items show "Select a chapter to see details." (empty placeholder). Recommend whether each specialized surface should populate the metadata panel with something useful or keep the empty placeholder.
  - FM/BM: probably reuses the chapter metadata sections (status, synopsis, notes — Scene Planner is already hidden on FM/BM).
  - Outline: could show outline-specific info (beat count, linked-chapter count, last edit).
  - Note: could show note attributes (tags, color, pinned status) as a metadata-style panel.
  - Character: could show character-specific metadata (status, last edit, related characters count).

Claude Design proposes — but doesn't have to fully design — these metadata-panel variants. The default of "show nothing" is acceptable for some surfaces if they're self-contained.

---

## 10. Cross-cutting requirements (same as Prompt 1)

- **Light/dark editor mode parity** for all paper-card writing surfaces.
- **Save status badge** consistent across all four specialized surfaces — same visual language as the bottom status bar's save indicator.
- **Accessibility** — labels for icon-only buttons, focus states, contrast.
- **Premium gating** — none of these surfaces are premium-gated currently. (Snapshots are premium but those are per-chapter, not per-surface-type.)
- **Empty states** — every surface needs a friendly empty state design.
- **Drag-drop** affordances — Outline and possibly the character-card-grid layout need clear drag handles and drop indicators.
- **Inheritance** — these surfaces should feel like the same brand as the Prompt 1 shell, not a different product.

---

## 11. Deliverables expected from Claude Design

1. **Mockups for each surface** (4.1–4.5 subtypes, 5 outline alternatives if more than one is proposed, 6 notes, 7 character, 8 fallback) in both light and dark editor modes where applicable.
2. **State variants** for each: default, empty, saving, hover/active where relevant.
3. **Subtype picker visual** for FM/BM.
4. **Chapter-link popover** for Outline.
5. **Outline view-mode comparison** — if multiple outline layouts proposed, a side-by-side or rationale doc explaining when each makes sense for a novelist.
6. **Note attribute controls** for the notes surface.
7. **Character profile section anatomy** — show how the sections (Appearance, Personality, etc.) lay out.
8. **Design system extensions** — any new tokens / components added beyond Prompt 1's foundation should be added to the system doc:
   - Paper-card variants (book-page-shaped vs index-card vs profile-sheet).
   - Specialized headings (chapter title vs note title vs character name).
   - Tag chip components.
   - Color-label swatches (supporting palette in action).
   - Drag handle / drop indicator visuals.

---

## 12. Tone (same as Prompt 1)

Warm. Cozy. A writer's notebook — not a SaaS dashboard. Each specialized surface should feel like a different page in the same beautifully designed paper journal. Title page = formal and elegant. Dedication = intimate and small. Outline = a planning corkboard or beat sheet on the desk. Note = a casual index card with a paperclip. Character = a profile in a writer's notebook with little sketches.

The user spends hours here. Make it feel like a place a serious writer wants to plan, draft, and live.

---

## 13. Out of scope (clarity)

- The persistent shell (covered in Prompt 1).
- Overlays / modes / modals (covered in Prompt 3).
- The chapter editor itself (covered in Prompt 1).
- Book creation wizard.
- Discover / Community / Hive pages outside the studio.
- Backend / data model design.

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

_[tool: local_ls]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

_[tool: write_file]_

## Assistant

_[tool: write_file]_

_[tool: write_file]_

Now let me build the HTML doc. I'll write it in chunks to manage size.

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now let me append the Outline section (which is the largest — has 3 view alternatives, beat anatomy, and the link popover).

_[tool: read_file]_

Now let me add the remaining sections (Notes, Character, Fallback, Extensions, Metadata, Handoff). I'll need to append at the very end after `</section>`.

_[tool: read_file]_

_[tool: str_replace_edit]_

Now let me check the file loads cleanly.

_[tool: update_todos]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Delivered Prompt 2 as `specialized-surfaces/Specialized Surfaces.html` — a 15-section design doc that picks up where the Studio Shell left off and tackles every non-chapter editor surface.

**What's in it:**
- **FM/BM** — five WYSIWYG book pages (Title, Copyright, Dedication, Acknowledgments, About) replacing the per-subtype form panels. Pill-bar picker, save badge in the surface header, full states matrix including empty / typing / no-subtype / discard-confirm modal, both light and dark editor.
- **Outline** — three views off one data model. Beat Sheet is the recommended primary (vertical, structure-keyed, with a connector line down the gutter); Story Arc plots cards along a literal rising curve; Corkboard reuses paper index cards on a peg-board ground. Plus a beat anatomy diagram, five card states, and the chapter-link popover (default / searching / no-results-create).
- **Research Notes** — legal-pad treatment with a paperclip, red margin rule, ruled lines; tag chips + 5-swatch color label + pin toggle as a strip beneath the title.
- **Character Profile** — recommended Sectioned-Card-Grid layout (with two alternates evaluated). Portrait header + 7 default sections + a relationships block reusing the link-popover vocabulary.
- **Generic fallback** — minimal cream sheet, intentionally less inviting.
- **Design-system extensions** — paper-card variants, specialized heading scale, tag chip on three surfaces, color swatches, drag handle, drop indicator.
- **Metadata-panel variants** — four right-rail compositions, one per surface type.
- **Handoff** with locked items + open questions for Chris.

The doc inherits Prompt 1's tokens/type/elevation verbatim via `@import` — zero new colors, sizes, or spacing values. All chrome stays warm walnut; only the editor canvas flips between cream paper and coffee where applicable.

