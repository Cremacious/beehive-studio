# Hive Routes — Claude Design Import Delta (2026-06-04)

## Source

- Bundle: claude.ai/design export originally at `/tmp/claude-design-hive/beehive-studio/` (now cleaned up; if a re-read is needed, restore from the original drop).
- 7 chat transcripts (chat1-chat7; chat7 is the meaningful one — 1259 lines), 19 HTML mockup files (18 surfaces + index hub), `hive.css` (676 lines, the canonical shared stylesheet), `lib.js`.
- Locked source spec the prompt was derived from: [docs/superpowers/specs/2026-06-03-hive-routes-unified-ui-design.md](./2026-06-03-hive-routes-unified-ui-design.md).
- Phase-2 handoff prompt that was actually pasted into Claude Design: [docs/superpowers/specs/2026-06-03-hive-routes-claude-design-prompt.md](./2026-06-03-hive-routes-claude-design-prompt.md).

## What Chris was trying to land

Chris pasted the Phase-2 handoff prompt into claude.ai/design, then iterated 10+ rounds of cleanup with the design agent. The starting point was a faithful reproduction of the locked unified-UI spec; the iteration added a layer of polish + four meaningful design deviations from the spec.

**Iteration arc (chat7):**
1. **Sidebar + top-bar reshuffle** — Claude Design first built mockups with a top app bar. Chris removed it ("Top bar removed everywhere — sidebar now anchors to top of viewport"). Sidebar is centered-title + 11 nav entries + sticky to viewport with subtle scrollbar.
2. **Back-link polish** — sized at exactly 12×12 ArrowLeft + JetBrains Mono 11px uppercase tracking-wider + muted, with `mb-4` above the panel. Matches `<HivePageShell>` already.
3. **Outline detail polish** — "Add a beat" became a brand-yellow pill (not tile), chapter chip got sized icon + nowrap, "unlinked" got brighter muted treatment, "+ New Act" got a sized + icon, scene planner summary gained "(click to expand)" hint.
4. **Chapters index — DROPPED ACTIVITY BADGES** (structural change). The mockup replaces `<ChapterActivityBadges>` (annotation count + suggestion count) with a simple "Last edit" timestamp column ("Apply drawing" turn). This is a real spec deviation worth surfacing to Chris before implementing — the activity badges are load-bearing for OWNER/MOD review workflows.
5. **Collaboration gutter rebuilt** — chat7 added the always-mounted right-rail to chapter view (320px, inside the panel, no orphan tab/section). `--layer-*` tokens added. Cards have per-layer left border + ✓/✗ resolve buttons. "Resolved" pill is a view-mode toggle, NOT additive. Live code already aligns with this (OrphanSection is dead code but file lingers).
6. **Wiki restructure — STRUCTURAL CHANGE.** Chris explicitly removed the 3-tab By Category / By Folder / Notes view switch ("keep the search bar but remove the [...] selector"). Replaced with a 14-card category index → drill-down to a new Wiki Category page → entry editor. Editor itself rebuilt as multi-section (centered title + category pill + tag chips + italic blurb + stacked labeled section cards + "+ Add section"). Folder and Notes routes are eliminated from the IA.
7. **Submissions tonal hierarchy** — three distinct background tones: section header bar (darkest `--canvas-dark-100`) > column sub-header (`--canvas-dark-300`) > content rows. Uses `.sub-head` chrome.
8. **Panel min-height rule** — every panel `flex-1` inside a `min-height: 100vh` wrapper, so short pages fill the viewport (with a uniform 24px gap below) and tall pages scroll. Live `<HivePageShell>` does NOT do this today.
9. **Dashboard Recent activity feed** — NEW feature on the dashboard panel, last of 3 sections (Overview / Linked book / Recent activity), 8 event rows with per-type icon chip in token-tinted background. Maps 1:1 to `getHiveActivityFeedAction`.

**Net design deviations from the locked spec** (Chris signed off on each interactively):
- (A) Chapters index loses activity badges in favor of "Last edit".
- (B) Wiki shell loses 3-tab view switch; wiki IA collapses to a category index + drill-down + entry editor.
- (C) Wiki entry editor is multi-section, not the spec's single-body TipTap canvas.
- (D) Dashboard gains a Recent activity section.
- (E) Panels use viewport-fill `min-height` (visual chrome convention, not surface-by-surface).

## Design system delta (current code → mockup)

The mockup ports tokens verbatim from `globals.css` — no token VALUE drift. But the mockup adds 5 net-new tokens and uses a few chrome details that live `<HivePageShell>` doesn't.

| Element | Live code today | Mockup `hive.css` | Action |
|---|---|---|---|
| Page backdrop | `#262728` from app layout | `#262728` body bg + `linear-gradient(180deg, var(--canvas-dark-150), var(--canvas-dark-100))` on `.app-shell` | Match — the app-layout already provides `bg-[#262728]`; the gradient is a nice-to-have if `AppNav` doesn't already provide depth. |
| Canvas stops | `--canvas-dark-100..400` (post-fix-pass) | Identical | OK |
| Brand | `--brand: #FFC300` + `--brand-ink: oklch(0.20 0.05 75)` | Identical + adds `--brand-hover: #FFD040`, `--brand-active: #E0AC01`, `--brand-soft: oklch(0.85 0.18 90 / 0.16)` | **ADD 3 brand tokens** — needed for button hover/active states + the visibility card selected-state icon background. |
| Annotation layers | Live uses inline `oklch(...)` values per-layer in `collaboration-gutter.tsx` | Mockup promotes to `--layer-grammar/-plot/-tone/-continuity/-general` | **ADD 5 `--layer-*` tokens** to `globals.css` :root and refactor `collaboration-gutter.tsx` + `annotate-modal.tsx` + `suggest-modal.tsx` to consume them via `<HivePill>` shape. |
| Beat dots | Already in spec (8 colors) | Identical | OK |
| Status / role / goal / wiki | Already shipped | Identical | OK |
| Ink scale | `--canvas-dark-ink-muted/-ink/-strong` | Identical + adds `--canvas-dark-ink-faint: oklch(0.500 0.003 256)` | **ADD `--canvas-dark-ink-faint`** for grip handles, "missed" goal label, very-secondary text. |
| Radius | `--r-card/-row/-btn/-pill` | Identical | OK |
| Hairlines + shadows | `--br-card`, `--sh-card`, `--sh-tile`, `--sh-inset` | Identical | OK |
| Panel chrome | `<HivePageShell>` outer + gradient panel | Identical + `panel { flex: 1 }` inside `min-height: 100vh` wrapper | **Add panel-min-height rule** to `<HivePageShell>` (outer wrapper gets `flex flex-col min-h-screen`; panel gets `flex-1`). |
| Section divider | `<HiveSectionDivider>` matches | Identical | OK |
| Pill convention | `<HivePill>` matches | Identical | OK |
| Forum-table | Per-page inline today (Chapters, Discussions, Outline, Members all roll their own) | `.forum-head` (column-header strip on `--canvas-dark-100`) + `.forum-list > a` (flat rows with hairline + `hover:bg-[var(--canvas-dark-300)]`) | OK structurally — implementer should verify each consumer renders flat-row chrome, NO per-row tile chrome. |
| Card-stack | Per-page tile gradient today | `.card-stack` + `.tile-card` | OK |
| CTA — primary | Brand pill (live) | `.btn-brand` (brand bg + `--brand-ink` + `--sh-tile` + `translateY(-1px)` on hover via `--brand-hover`) | Verify hover state lands the `translateY(-1px)` lift; live may not have it. |
| CTA — secondary | Tile-gradient buttons | `.btn-tile` (with `.danger` variant for Reject etc.) | OK |
| CTA — tertiary | Text link brand | `.btn-text` (brand color + underline-on-hover) | OK |
| Icon button | Existing kebab/icon buttons | `.btn-kebab` (transparent → `bg: --canvas-dark-100` on hover) | OK |
| Inputs | Recessed via inline style today | `.field` (recessed `--canvas-dark-100` + `--sh-inset`) + `.field-label` mono uppercase | Refactor inline-style inputs to a shared `<RecessedField>` if appetite — or just match the pattern per surface. |
| Sidebar | `hive-sidebar.tsx` already correct | Identical | OK (don't touch) |
| Top bar | AppNav (mounted in `(app)` layout — **MUST STAY**) | None — mockups remove it for the static preview | **Cross-cutting constraint**: keep AppNav. Mockups don't show it because they're standalone HTML; live code has it above the hive layout. |
| Fonts | Comfortaa / Geist / Newsreader / JetBrains Mono | Identical | OK |
| Light mode | Studio-editor-only (cream paper) | None — dark only | OK; reaffirm cream paper restriction stays. |

### Token additions required in `app/globals.css`

```css
:root {
  /* brand variants */
  --brand-hover:  #FFD040;
  --brand-active: #E0AC01;
  --brand-soft:   oklch(0.85 0.18 90 / 0.16);

  /* extended ink scale */
  --canvas-dark-ink-faint: oklch(0.500 0.003 256);

  /* annotation layers (5) — promote from inline oklch values */
  --layer-grammar:    oklch(0.78 0.13 70);
  --layer-plot:       oklch(0.66 0.18 25);
  --layer-tone:       oklch(0.72 0.11 280);
  --layer-continuity: oklch(0.74 0.12 145);
  --layer-general:    oklch(0.66 0.04 240);
}
```

## Per-page deltas

Each row: **Mockup file** — `live code path` — **Verdict** — bulleted notes.

### 01 Dashboard — `app/[locale]/(app)/hive/[hiveId]/page.tsx` — STRUCTURAL CHANGE

- Mockup body = 3 hairline sections: (1) Overview (avatar cluster + Members stat + Last active stat + Role pill — horizontal layout), (2) Linked book (cover + meta + 2-button column: Read book brand pill / Open in Studio tile), (3) **NEW: Recent activity** (8-row card-stack of `act-row`s: 28px avatar + 24px ev-ic icon chip in token-tinted bg + verb sentence with bolded handles/object names + relTime mono right-aligned + "View all activity →" mono link below).
- Recent activity needs `getHiveActivityFeedAction({ hiveId, limit: 8 })`; map each event type to an icon + accent token:
  - `chapter_updated/edit` → Pencil + `--brand`
  - `buzz_posted` → MessageCircle + `--goal-daily`
  - `annotation_added` → Edit2 + `--status-first-draft`
  - `discussion_posted` → MessageSquare + `--role-moderator`
  - `suggestion_accepted` → Check + `--status-success`
  - `chapter_submitted` → Send + `--status-warning`
  - `member_joined` → UserPlus + `--role-contributor`
  - `buzz_posted` (LINK variant) → Link icon + `--goal-daily`
- "HIVE" eyebrow on Dashboard was already killed in the fix pass — keep it killed.
- Do NOT regress the dashboard's standalone-hive fallback (when `linkedBook === null`).

### 02 Outline Index — `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx` + `_components/outline-index.tsx` — VISUAL POLISH

- Width `wide` (max-w-5xl). Header subtitle "{N} outlines in this hive". HeaderSlot is "+ New Outline" brand pill (live code may not have this CTA yet — verify; spec §6 row 2 lists no CTA but the mockup added one after Chris flagged it). **NEW affordance** — needs a server action `createHiveOutlineAction(hiveId)` or wire to existing path.
- Filter section: search input + sort dropdown (`Recently edited` / `Most beats` / `A – Z`).
- Outlines forum-table: `grid-cols-[1fr_90px_130px]`, columns "Outline / Beats / Last edit". Title cell is 2-row flex (title + horizontal beat-color-dots row showing up to 6 deduplicated `--beat-*` colors in first-appearance order).

### 03 Outline Detail — `app/[locale]/(app)/hive/[hiveId]/outline/[outlineId]/page.tsx` + `_components/hive-outline-surface.tsx` — VISUAL POLISH

- Width `wide`, `back="outlines"`. Title = outline title. Subtitle = "Last edited by @{username} · {relTime}".
- Body = stacked `.act-block` cards (tile-gradient, `var(--r-row)`, `var(--sh-tile)`). Each block has:
  - `.act-head` row with act name (mono uppercase 11px tracking-wider) + brand-pill "+ Add a beat" button right-aligned.
  - `.beat-row`s with 4-col grid `[22px 14px 1fr auto]`: grip (drag handle, faint) + colored dot + title (with optional inline `.beat-label` pill) + chapter chip (`Ch. N` with book icon) OR muted "unlinked" label.
- Bottom: full-width dashed-border "+ New Act" button.
- Do NOT regress: beat-dialog open-on-click (live code), drag-between-acts cross-act adoption, BETA_READER read-only mode.
- Color dot is `.beat-dot` with `box-shadow: 0 0 0 2px oklch(from --bd l c h / 0.18)` halo — small detail, easy miss.

### 04 Wiki Shell — `app/[locale]/(app)/hive/[hiveId]/wiki/page.tsx` + `_components/hive-wiki-shell.tsx` — STRUCTURAL CHANGE (BIG)

- **DROPS the 3-tab "By Category / By Folder / Notes" view switch entirely** — Chris explicitly removed it in chat7. Live code's `tablist` is gone.
- **DROPS folder + notes views from the hive wiki IA.** Categories become the primary IA. Folder rendering and standalone notes can still exist via the binder, but the hive wiki does not surface them as tabs. Verify with Chris before tearing out `by-folder-view.tsx` + `notes-view.tsx` — they may still be wanted as future surfaces.
- Width `wide`. Header subtitle "{N} entries across your story bible". HeaderSlot "+ New Entry" brand pill (opens existing `WikiCategoryPicker`).
- Body = search field (single section, NO label) + Categories section (14 `.cat-card`s in 2-col grid). Each card:
  - Tile-gradient bg, `var(--r-row)`, `var(--sh-tile)`.
  - 36×36 icon chip in `oklch(from var(--wiki-X) l c h / 0.16)` tinted bg + accent-colored lucide icon.
  - Category name (Comfortaa 15px bold).
  - Description blurb (12.5px muted, line-clamp-2).
  - **Count badge in top-right corner**, dark recessed (`--canvas-dark-100` + `--sh-inset`), accent-colored when count > 0, faint when count = 0.
  - Click → drill to Wiki Category page (page 04 wiki-category.html, NEW route).
- Map 14 categories from `CATEGORY_TEMPLATES`; counts come from `getHiveWikiView(hiveId).entries.reduce((map, e) => ...)`.

### 04b Wiki Category — NEW ROUTE `app/[locale]/(app)/hive/[hiveId]/wiki/category/[category]/page.tsx` — NEW FEATURE

- Width `wide`, `back="wiki"`. Title = category label (e.g. "Characters"). Subtitle = category blurb. HeaderSlot "+ New Entry" brand pill (calls `createBinderItemAction` with the locked category).
- Filter section: search + sort dropdown (Recently edited / A–Z / Recently added).
- Entries section: 2-col grid of `.entry-card`s (tile-gradient, padding 16, gap-9). Each card:
  - Title (Comfortaa bold 16px strong).
  - Blurb (13.5px line-clamp-2 — derived from first prose paragraph or first section body).
  - Tag chips row (`.chip token` with `--pill-accent: var(--wiki-X)`).
  - Foot row: "edited by @{username}" + relTime (mono muted).
  - Click → entry editor at page 05.
- Server action: extend `getHiveWikiView` or add `getHiveWikiEntriesByCategory(hiveId, category)`.

### 05 Wiki Entry Editor — `app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-entry-editor.tsx` — VISUAL POLISH (structure already matches)

- Live code already uses sections shape (`WikiSection[]`). This is pure chrome refresh:
  - `.wiki-entry` wrapper: `max-w-840px mx-auto p-32px`.
  - `.we-header`: right-aligned "Edited by @x · 3h ago" line + green `.save-badge` ("· Saved" with success-dot). **Drops** the META section label + the "Character" subtitle Chris explicitly killed.
  - `.we-title-block` centered: contenteditable h1 32px → category pill (with icon) + tag chips horizontal-centered → italic blurb (560px max-width).
  - `.we-sections` stacked with `gap-22px`. Each section:
    - `.we-sec-head`: brand-yellow mono uppercase 11px label (contenteditable, click-to-rename) + hover-reveal × remove button.
    - `.we-sec-card`: tile-gradient, padding 16, prose (`font-ui` 14px line-height 1.7).
  - Full-width "+ Add section" dashed-border button at bottom + tiny centered helper text.
- Back link OUTSIDE panel (mono mb-4) — Chris explicitly moved it there.
- Do NOT regress: BETA_READER read-only mode, 800ms debounced `updateBinderItemAction`, optimistic `lastEditedBy` refresh.

### 06 Chapters Index — `app/[locale]/(app)/hive/[hiveId]/chapters/_components/hive-chapter-index.tsx` — **STRUCTURAL CHANGE** ⚠

- **Mockup REMOVES `<ChapterActivityBadges>`** in favor of a simple "Last edit" timestamp column. This is a real spec deviation worth a quick check with Chris — the activity badges are how reviewers find chapters with pending suggestions. If kept, mockup becomes the 4-col layout `[40px 1fr 180px 180px]`; if dropped, follow mockup exactly.
- Width `standard` (max-w-3xl). Subtitle "{N} chapters · {Book Title}". No header CTA. Forum-table 3-col `[40px 1fr 180px]`:
  - `#` column: tabular-num muted 2-digit chapter number.
  - `Chapter`: clickable title (Link).
  - `Last edit`: relTime mono muted right-aligned.
- Chapter status pill (the deferred "(b)" follow-up from T10) still doesn't ship — mockup doesn't show one.
- **DO flag to Chris**: "mockup drops activity badges from chapter index — keep or drop?" before implementing.

### 07 Chapter View — `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/page.tsx` + `_components/hive-chapter-surface.tsx` — STRUCTURAL CHANGE

- Width `wide`, `back="chapters"`. Title = chapter title. Subtitle = "Chapter from {Book Title} by @{author}" or contributor-attributed variant. HeaderSlot = viewer's role pill (alpha-tint).
- **METADATA section (full-width above body)**: status pill + line-clamp-3 italic synopsis + `<details>` Scene Planner (mono uppercase summary with "(click to expand)" hint + chevron + 3 stanzas).
- **BODY section = 2-column flex `[1fr 320px]` with gap-6**:
  - Left: read-only TipTap prose in `.recessed.prose-dark` (Newsreader 18px line-height 1.78 on `--canvas-dark-100` recessed bg).
  - Right: `<CollaborationGutter>` 320px shrink-0 sticky top-16, left border `1px solid oklch(from --canvas-dark-300 l c h / 0.5)` + `pl-5`. NOT a separate panel.
- Gutter `.gutter-head`: "COLLABORATION" mono label + "{N} active" count.
- Gutter `.gutter-filter` (single row of 8 fpills): `[All] [Grammar] [Plot] [Tone] [Continuity] [General] [Suggestions] | [Resolved]`. Sep is `.fpill-sep` vertical 1px-by-16px divider. Active state = solid bg in accent color + `var(--canvas-dark-100)` ink.
- Annotation card: tile-gradient + `border-left: 3px solid var(--layer-X)`. Header has avatar + identity + ✓/✗ resolve buttons (24px round, success-tinted check / error-tinted X).
- Suggestion card: same chrome + `border-left: 3px solid var(--brand)`. Diff = strikethrough old + arrow + new. Action row: Accept brand pill + Reject tile-danger + "Open" brand text link.
- **NO Orphan tab/section.** Delete `components/hive/collab/orphan-section.tsx` (file lingers but already unmounted).
- Do NOT regress: optimistic `wrappedMutate` strip-mark flow on resolve/reject, `liveCollabCounts` provider, BETA_READER read-only, layer filter localStorage persistence, custom Reject dialog with optional reviewNote.
- Live `collaboration-gutter.tsx` should refactor inline `oklch(...)` layer values to consume the new `--layer-*` tokens.

### 08 Discussions List — `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussions-list.tsx` — VISUAL POLISH

- Width `wide`. Header "+ New Discussion" brand pill (already exists via `<NewDiscussionCTA>`).
- Filter section: topic chip-row (multi-select; on-state = `.chip.token.on` with topic accent via `--wiki-X` per TOPIC_META).
- Threads forum-table `[1fr 90px 130px]`: Thread / Replies (centered count + "replies" sublabel) / Last activity (relTime mono).
- Thread column: topic pill + Comfortaa semibold title (line-clamp-1, ellipsis) + body excerpt (13px muted line-clamp-1) + "started by @x" relTime byline.
- Replies column: big count (Comfortaa 18px bold) above small "replies" mono label, both centered.

### 09 Discussion Thread — `app/[locale]/(app)/hive/[hiveId]/discussions/[postId]/page.tsx` + `_components/discussion-thread.tsx` — VISUAL POLISH

- Width `wide`, `back="discussions"`. Title = derived from `body.split('\n')[0].slice(0, 80)`. Subtitle = "Started by @x".
- Sections: Original post / "{N} replies" / Reply composer.
- Original post = `.post` (large avatar + body): header row (uname link + relTime + optional `(edited)` + topic pill) + post-text (whitespace-pre-line).
- Reply list = `.reply-list` with `.reply-row` divs (hairline top borders, gap, padding 16/0). Each reply: md avatar + uname + relTime + kebab-on-right (when canEdit) + body.
- Reply composer = `.post` shape with viewer avatar + textarea field + right-aligned "Post Reply" brand pill.
- Do NOT regress: kebab Edit/Delete gates on `canEditDiscussionPost`, one-level reply depth enforcement, `(edited)` indicator on `updatedAt > createdAt`.

### 10 Submissions List — `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submissions-list.tsx` — VISUAL POLISH (tonal hierarchy)

- Width `standard`. HeaderSlot "+ New Submission" brand pill (gated on `canSubmitChapter`, disabled with tooltip otherwise — live has this).
- **New tonal hierarchy** per Chris's iteration: 3 distinct background tones for sections:
  1. **`.sub-head`** section header bar (`bg: --canvas-dark-100` darkest) with Comfortaa 16px bold section name + mono count (e.g. "My drafts · 1 draft").
  2. **`.forum-head`** column sub-header bar (`bg: --canvas-dark-300` lighter) with mono uppercase labels.
  3. Content rows on the medium panel gradient.
- This means `<HiveSectionDivider>` doesn't fit cleanly for this surface — submissions uses a sister `.sub-head` chrome. Either extend `<HiveSectionDivider>` with a `variant="submission-tone"` prop, or build a small `<HiveSubSectionHeader>` for these 3 sections (drafts / mine / all).
- 3 sections: My drafts / My submissions / All in this hive (last gated on `canReviewSubmissions`).
- Forum-table `[1fr 110px 130px]`: Submission / Status (status pill via `--status-*` tokens, centered) / Submitted (relTime right-aligned, or "—" for drafts).

### 11 Submission Composer — `submissions/_components/submission-composer.tsx` — VISUAL POLISH

- Width `standard`, `back="submissions"`. Title = "New submission" (or existing title). Subtitle = "Auto-saves as you type."
- First section: SaveStatusBadge inline at top + large title input (`font-comfortaa font-bold 22px`) + target-position select (`field-label` mono label above) + draft body (recessed `.prose-dark`, min-height 240px) — TipTap mounted here.
- Second section (just submit row): right-aligned "Submit for review" brand pill.
- Do NOT regress: 800ms debounced auto-save, `router.replace` dance on first save (DRAFT → existing-id route), submit flushes pending save.

### 12 Submission Review — `submissions/_components/submission-review.tsx` — VISUAL POLISH

- Width `standard`, `back="submissions"`. Title = submission title. Subtitle = "Pending review from @{submitter}". HeaderSlot = 2-button group: Approve (brand pill) + Reject (tile-danger).
- 2 sections: Submission (avatar + identity row + status pill right-aligned) / Body (recessed prose-dark, padding 26/28).
- Do NOT regress: approve → privileged binder-create path (T8 of H3 ship), reject → ConfirmDialog with reviewNote required.

### 13 Submission Read — `submissions/_components/submission-read.tsx` — VISUAL POLISH

- Width `standard`, `back="submissions"`. Title = submission title. Subtitle = "Submitted by @{submitter}". HeaderSlot = status pill (`--status-*` per draftStatus).
- Sections: Submission (meta row only, NO status pill since it's in headerSlot) / Body / Review note (only when REJECTED with non-null reviewNote — uses `.section.danger` label tone) / Approved chapter link (only when APPROVED with createdChapterId).
- Review note rendered in `.recessed` inset box with body text.

### 14 Suggestions — `app/[locale]/(app)/hive/[hiveId]/suggestions/page.tsx` + components — VISUAL POLISH

- Width `standard`. Subtitle = "{N} pending across {M} chapters" (or "No pending suggestions." empty state).
- Per-chapter hairline sections labeled "Chapter {N}: {title}" (NOT mono uppercase — mockup uses spec section-label style though).
- Card-stack of suggestion `.tile-card`s inside each section. Each card:
  - Header row: avatar + uname (no @ prefix in mockup) + relTime + optional `.act-badge` "replies" right-aligned with message icon.
  - `.diff` body: `recessed` inset block with old (strikethrough error-toned) + arrow + new (strong) all in Newsreader prose.
  - Action row: Accept brand pill + Reject tile-danger + "Open in chapter →" brand text link right-aligned.
- Mock dialog for Reject is custom (not `ConfirmDialog`) with reviewNote textarea — live code already has this.

### 15 Word Goals — `word-goals/_components/word-goals-page-shell.tsx` (+ modals) — VISUAL POLISH

- Width `standard`. HeaderSlot "+ New Goal" brand pill (gated on `canSetWordGoal` via `<NewGoalHeaderCTA>`).
- 4 hairline sections: Active goals / Contributors · {primary goal name} / Recent activity / History (rendered INLINE, NOT accordion).
- Active goals = card-stack of `.goal-card`s (tile-gradient padding 18). Each:
  - `.goal-top`: goal name (Comfortaa bold 17px) + type pill (`--goal-*`) + kebab right.
  - Progress track + brand-yellow fill (`.progress-fill` with subtle glow shadow).
  - `.goal-figures` row: `<b>14,200</b> / 24,000 words` left + `3 days left` right (both mono 12px).
- Contributors: `.contrib-row` per member (avatar + uname + delta in `.delta.pos` success color, right-aligned). Hairline-separated.
- Recent activity: per-row flex (64px-wide relTime + body sentence with strong handles). "Load older" tile button below.
- History: forum-list with 3-col grid `[1fr 120px 180px]` per row — name (muted) + type pill + figures with "met" success or "missed" faint right-aligned. Hairline borders, no card chrome.

### 16 Buzz Board — `buzz/_components/buzz-feed.tsx` + `buzz-post-card.tsx` — VISUAL POLISH

- Width `standard`. HeaderSlot "+ New Buzz" brand pill via `<BuzzHeaderCTA>` (gated on `canPostBuzz`).
- Single first section, no label — just card-stack of `.tile-card` posts in `padding: 24px`.
- Each post:
  - Header row: md avatar + uname + "· relTime" mono + optional "· (edited)" + kebab pushed right (`ml-auto`).
  - `.buzz-title` = derived from `body.split('\n')[0].slice(0,80)`, Comfortaa bold 16px **brand-yellow** (this is the sanctioned 12th brand-yellow use).
  - `.buzz-excerpt` = remainder of body, line-clamp-2 14px (omit when body single-line).
  - LinkCard if `type=LINK`: 48px thumb chip + title + url line, recessed inset box.
  - `.like-btn`: heart + count, mono 12px, muted by default, `--status-success` colored when liked (fill+stroke).
- Do NOT regress: optimistic like toggle with rollback, LINK URL validation, ComposeBuzzModal (text/link tabs).

### 17 Members — `members/page.tsx` + `_components/hive-members.tsx` — VISUAL POLISH

- Width `standard`. Subtitle "{N} members". NO header CTA.
- Sections: Invite link / Invite by username / Members forum-table.
- Invite link: `.invite-box` flex row — `.invite-url` recessed mono URL display (truncate) + Copy tile button + Regenerate tile button. Below: "{N} / {LIMIT} members" mono.
- Invite by username: search-field shape (with magnifier icon) + Send invite brand pill. Existing username-invite form kept.
- Members forum-table `[1fr 140px 60px]`: Member (avatar + uname strong + "joined Mar 1" relTime stacked) / Role (HivePill OR `.role-select` styled dropdown — owner is the role pill always; others are the dropdown when viewer is owner; OWNER target always pill, never dropdown; self is always pill never dropdown) / Actions (X kebab to remove).
- `.role-select` is a styled native `<select>` that wears the pill chrome (`--pill-accent` driven).
- Member-count progress bar vs `FREE_HIVE_MEMBER_LIMIT` — live has it; mockup just shows "{N} / {LIMIT}" mono line. Either keep the progress bar or just the line per Chris.

### 18 Settings — `settings/page.tsx` + `_components/hive-settings-form.tsx` — VISUAL POLISH

- Width `standard`, `back="dashboard"`. Subtitle "Manage your hive."
- 5 sections: Basics / Visibility / Discoverability / Danger zone / Save button.
- Basics: name input + description textarea (recessed `.field` shape with `.field-label` mono labels above).
- Visibility: `.vis-grid` 3-col of `.vis-card`s — Private / Friends / Public. Each card: icon chip (32px rounded-9 in `--canvas-dark-300` muted bg, **`--brand-soft` bg + brand-color icon when `.on`**) + name (Comfortaa semibold 14px) + desc (12.5px muted). Selected card gets `border: 1px solid --brand` + boxShadow ring.
- Discoverability: check-row (20px checkbox in recessed + brand check icon) + label + help-text. Disabled (opacity 0.5) when visibility ≠ Public.
- Danger zone (`.section.danger` — label uses error-toned color via tone="danger"): flex row with help-text left + Delete tile-danger button right.
- Last section: right-aligned Save brand pill.
- Today's live code likely places Save in headerSlot via `form="hive-settings-form"`. Mockup moves it to a final section row. Either works; mockup matches the locked spec.

## Recommendations

### Cross-cutting changes to land FIRST as shared primitive updates

1. **Add 9 new tokens to `globals.css`** (`--brand-hover`, `--brand-active`, `--brand-soft`, `--canvas-dark-ink-faint`, `--layer-grammar`, `--layer-plot`, `--layer-tone`, `--layer-continuity`, `--layer-general`). One commit, zero behavior change. Refactor `collaboration-gutter.tsx` + `annotate-modal.tsx` + `suggest-modal.tsx` to consume `--layer-*` via `<HivePill>` in the same commit.
2. **Extend `<HivePageShell>`** to enforce viewport-fill min-height: outer wrapper gets `min-h-screen flex flex-col`; panel `<section>` gets `flex-1`. Touches every hive page identically — single small commit.
3. **Audit "+ New Outline" CTA** — mockup adds it; live code may not have the affordance. Decide with Chris before T2.
4. **Delete dead `components/hive/collab/orphan-section.tsx`** — file lingers post-fix-pass but no consumer. One-line cleanup commit.

### Order of implementation passes

**Phase A — Foundation (1 commit, no per-page churn):**
- Token additions + dead-code sweep.
- `<HivePageShell>` viewport-fill rule.

**Phase B — Pure visual polish (parallel-safe per page):**
- 02 Outline Index · 03 Outline Detail (verify "+ New Outline" decision first)
- 05 Wiki Entry Editor (chrome only — sections data already exists)
- 08 Discussions List · 09 Discussion Thread
- 11 Submission Composer · 12 Review · 13 Read
- 14 Suggestions
- 15 Word Goals · 16 Buzz Board
- 17 Members · 18 Settings

**Phase C — Structural changes (needs Chris sign-off before each):**
- 04 Wiki shell — drop 3-tab view switch, build new category-index landing. **Verify with Chris: tear out `by-folder-view.tsx` + `notes-view.tsx`, or keep them as dead surfaces for future use?**
- 04b Wiki Category — NEW route + server action. **Verify with Chris: are characters surfaced inside category drill-down (they're currently UNION-coerced in `getHiveWikiView`)?**
- 06 Chapters Index — drop activity badges → "Last edit". **Verify with Chris: keep badges or follow mockup exactly?**
- 07 Chapter View — 2-col body layout + collab-gutter restructure (live code already has the gutter but mockup makes it always-mounted as 320px right rail inside the panel, NOT toggled).
- 10 Submissions List — tonal hierarchy via new `<HiveSubSectionHeader>` or extended `<HiveSectionDivider variant="tone">`.

**Phase D — NEW feature:**
- 01 Dashboard — Recent activity section. Reuses `getHiveActivityFeedAction`. Adds an `<ActivityEventRow>` component if not already shared.

### Hard constraints to repeat in implementer-facing tasks

- **Top navbar (`AppNav` mounted in `(app)` layout) MUST stay.** Mockups don't include it because they're standalone HTML; the live app already wears it above the hive layout. Don't strip it during the import.
- **Cream paper stays studio-editor-only.** Mockups all use dark walnut chrome; no prose surface in hive routes should reach for paper-100 / paper-ink tokens. The Wiki Entry Editor mockup confirms this — prose body is `.we-sec-card` tile-gradient with `var(--canvas-dark-ink)` ink, NOT cream.
- **Sidebar already correct** — `<HiveSidebar>` matches the mockup's 11-entry nav. Don't restyle it during the import unless badge wiring breaks.
- **Brand-yellow restraint** holds — 12-place usage map in the locked spec is unchanged. Mockup's only new brand-yellow surface is the Dashboard "View all activity →" mono link (acceptable — tertiary tertiary).
- **No new modals.** shadcn Dialog primitive already inherits the chrome. Per-surface modals (NewGoalModal, ComposeBuzzModal, DiscussionComposeModal, etc.) stay as-is.
