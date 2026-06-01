# Hive Aesthetic Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Draft
**Date:** 2026-06-01
**Scope:** All Hive routes (`/hive/[hiveId]/*` + `/hive/invite/[token]`) chrome surfaces. Sister plan to the Editor Aesthetic Refresh (which shipped the token system).

**Goal:** Re-skin every hive chrome surface to the same warmer, cool-gray, iOS-modern stacked-depth aesthetic established by the editor refresh, without changing any feature, affordance, behavior, route, or information architecture, and without touching the read-only cream prose canvas inside the hive chapter view.

**Architecture:** The editor refresh already landed Phase 1 (tokens) in `app/globals.css` and re-skinned the shadcn `Dialog` primitive in editor T8. This plan consumes those token + primitive cascades. Tasks 1-13 re-skin one hive surface area per task using only the new tokens; T14 walks a feature-integrity sweep across every hive affordance; T15 lands the AGENTS.md write-up + ship commit. No DB changes, no new components, no test churn, no new tokens — presentation-only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (CSS variables), shadcn/ui primitives, lucide-react, TipTap (untouched read-only in hive chapter view). Tests: vitest (all existing must stay green).

**Reference precedents (tone, granularity, code-block density):**
- [`docs/superpowers/plans/2026-06-01-editor-aesthetic-refresh.md`](2026-06-01-editor-aesthetic-refresh.md) — the closest precedent. Match its task structure and code-block density.
- [`docs/superpowers/plans/2026-05-29-h2-mirror-model.md`](2026-05-29-h2-mirror-model.md) — the H2 plan that shipped the hive UI surfaces this refresh targets.

**Spec:** [`docs/superpowers/specs/2026-06-01-editor-aesthetic-refresh-design.md`](../specs/2026-06-01-editor-aesthetic-refresh-design.md) — the locked design system. Authoritative for tokens, radius scale, depth philosophy, brand-yellow usage map, typography rules. This plan inherits the entire spec — no new tokens, no new radius scale.

---

## Approach

This is **presentation-only**. No new features, no IA changes, no behavior changes, no schema changes, no new components, no test changes, no new tokens. Every task re-skins a bounded hive surface area by:

1. Swapping flat `bg-*` Tailwind classes / inline `background: var(--canvas-dark-200)` fills for vertical gradients composed from the new mid-stops:
   - **Outer panels:** `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`
   - **Inset tiles / buttons:** `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`
   - **Hover (buttons):** `linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))`
   - **Active row:** `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`
   - **App backdrop:** `linear-gradient(180deg, var(--canvas-dark-150), var(--canvas-dark-100))`
2. Replacing tight `rounded-md` / arbitrary radii with the radius scale `--r-card` (20px) / `--r-row` (14px) / `--r-btn` (12px) / `--r-pill` (999px) / `--r-nav` (20px).
3. Adding `box-shadow: var(--sh-card)` (panels), `var(--sh-tile)` (inset tiles), or `var(--sh-inset)` (recessed inputs), plus `border: var(--br-card)` (hairline top-edge highlight) to every chrome surface.
4. Applying `color: var(--brand)` to every h1 / h2 / h3 / panel-title / page-title in hive chrome (Comfortaa, weight 600-700).
5. Preserving the **read-only cream prose surface** inside the hive chapter view (`/hive/[hiveId]/chapters/[chapterId]`) exactly as-is — Newsreader serif, paper-100 background, paper-ink text, all unchanged byte-for-byte.

Brand-yellow stays restrained per the spec's usage map (chrome headings, active nav, active filter chips, premium badges, brand CTAs, annotation layer accents). Every hive affordance shipped in H1-H4 stays visible and operable. The shadcn `Dialog` primitive — already re-skinned in editor T8 — cascades automatically to every hive modal (CreateHiveModal, ConfirmDialog, DiscussionComposeModal, ComposeBuzzModal, EditBuzzModal, NewGoalModal, EditGoalModal, etc.). **Do NOT re-skin `components/ui/dialog.tsx`** — it's already done.

---

## Pre-flight Findings

Verified by direct reads + grep against `main` at HEAD = (editor refresh ship commit, parent of this plan).

### A. Tokens + shadcn Dialog primitive are already in place

The editor refresh's T1 landed `--canvas-dark-150/250/350/400`, `--r-card/-row/-btn/-pill/-nav`, `--sh-card/-tile/-inset`, `--br-card` into `app/globals.css` `:root`. Editor T8 re-skinned `components/ui/dialog.tsx` once, cascading to every shadcn-Dialog-based modal in the app. This plan **must not** re-add tokens, re-skin the Dialog primitive, or touch the ConfirmDialog wrapper at `components/ui/confirm-dialog.tsx` (it composes Dialog and inherits the cascade). Hive modals that compose the Dialog primitive automatically pick up the new look without code changes.

### B. The hive routes diverge from studio chrome — sidebar, not binder

Studio uses a left-rail binder; hive routes use a left-rail **sidebar** (`hive-sidebar.tsx`) with 11 entries (Dashboard / Outline / Wiki / Annotations / Discussions / Submit Chapter / Edit Suggestions / Word Goals / Buzz Board / Members / Settings — exact order per H1 T15). Active state per the editor refresh / studio binder precedent: gradient + tile shadow only — **no left-stripe accent** (Chris's clarification: the binder gradient + shadow is enough; left-stripe was studio-specific to disambiguate from drag handles). The Word Goals sidebar widget (the H4 T11 progress badge embedded inside the sidebar) gets re-skinned in T9.

### C. Cream paper appears in exactly one hive surface

The hive chapter view (`/hive/[hiveId]/chapters/[chapterId]`) mounts a read-only TipTap surface that reuses the studio editor's cream prose styling for visual consistency between the author's editing experience and the hive member's reading experience. Only the **outer wrapper / frame** of that surface (the dark panel around the cream sheet, plus the collab gutter chrome) is touched. The cream sheet itself, the Newsreader serif, the paper-ink color, and the prose padding stay unchanged byte-for-byte. No other hive surface uses cream paper — wiki entries, outline, dashboard, members, settings, etc. all sit on dark walnut card surfaces and need the standard panel treatment.

### D. The H3 Collaboration Gutter chrome was already re-skinned in editor T9

`components/hive/collab/*` (annotation-card / suggestion-card / gutter-filter-strip / orphan-section / collaboration-gutter / selection-popover / annotate-modal / suggest-modal) was touched in the editor refresh because the gutter mounts inside the studio editor on hive-linked books. The hive chapter view (T5 of this plan) reuses these same components — so they're already styled. T5 only verifies the gutter chrome inside the hive chapter view's surrounding panel chrome doesn't conflict. **Do not re-skin the gutter components.**

### E. Three patterns recur across hive surfaces

Every hive subroute boils down to one of three shells:
1. **List page:** a panel with a page title (brand-yellow Comfortaa h1), a control row (search / filter / sort), and a list/grid of paper-card rows (members, discussions, submissions, buzz feed, annotations-by-chapter, suggestions-by-chapter).
2. **Detail page:** a panel with a back-link header, a centered content card, and (sometimes) a sidebar of metadata or actions (discussion thread, submission review/read, chapter view).
3. **Form page:** a panel with section labels, inputs / selects with `--sh-inset`, and a primary action (settings, submission composer, new goal modal, discussion compose).

T2-T13 each apply the standard treatment to one or two of these shells per route group. The treatment is the same across all three; what varies is the per-route content density and the brand-yellow accent placement.

### F. Coming-Soon stubs still exist for any future hive subroutes

H1 T15 landed `_components/coming-soon.tsx` as a shared shell for hive subroutes not yet shipped. After H2/H3/H4 most of those got replaced with real implementations, but the component itself remains and may be referenced by any future-deferred subroute. T12 re-skins it once so any future stubbed route inherits the new look.

---

## Tasks (T1-T15)

No database changes. No new files except the plan doc itself. Every task modifies existing hive route / component files only.

---

### Task 1: Hive layout shell + sidebar

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/layout.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx`

**Surfaces changed:**
- Layout outer container backdrop → `linear-gradient(180deg, var(--canvas-dark-150), var(--canvas-dark-100))`
- Sidebar panel → `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`, `border-radius: var(--r-card)`, `box-shadow: var(--sh-card)`, `border: var(--br-card)`
- Sidebar header (hive name + crest/avatar block) → hive name `color: var(--brand)`, Comfortaa weight 700
- Sidebar nav entries (idle) → `border-radius: var(--r-row)`, transparent bg, text `color: var(--canvas-dark-ink)`
- Sidebar nav entries (hover) → `background: linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`
- Sidebar nav entries (active) → `background: linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `box-shadow: var(--sh-tile)` — **no left-stripe** (per Pre-flight B)
- Icons inside nav entries → muted by default (`var(--canvas-dark-ink-muted)`), brand-yellow when the row is active
- Main content area (right of sidebar) → no panel chrome of its own; per-page tasks supply the panel(s)

- [ ] **Step 1: Layout backdrop**

In `layout.tsx`, the outermost wrapper inside the locale layout — apply the app backdrop gradient + horizontal padding to give the sidebar and content area visual breathing room:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-150), var(--canvas-dark-100))',
  }}
  className="min-h-[calc(100vh-56px)] flex gap-4 px-4 py-4"
>
  <HiveSidebar hiveId={hiveId} viewerRole={viewerRole} ... />
  <main className="flex-1 min-w-0">{children}</main>
</div>
```

- [ ] **Step 2: Sidebar panel container**

In `hive-sidebar.tsx`, replace the outer `<aside>` background / rounding / border:

```tsx
<aside
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="w-[260px] shrink-0 flex flex-col overflow-hidden"
>
  {/* header + nav + footer (word-goals badge mounts in T9) */}
</aside>
```

- [ ] **Step 3: Sidebar header**

The header block at the top of the sidebar (hive crest/avatar + hive name + member-count metadata):

```tsx
<div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: 'var(--br-card)' }}>
  <HiveCrest /* unchanged */ />
  <div className="min-w-0">
    <h2 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-base truncate">
      {hiveName}
    </h2>
    <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
      {memberCount} {memberCount === 1 ? 'member' : 'members'}
    </p>
  </div>
</div>
```

- [ ] **Step 4: Nav entries**

Each of the 11 nav entries (`<Link>` to subroute) replaced with the active / idle treatment:

```tsx
<Link
  href={href}
  style={{
    borderRadius: 'var(--r-row)',
    background: isActive
      ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
      : undefined,
    boxShadow: isActive ? 'var(--sh-tile)' : undefined,
  }}
  className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'text-[var(--canvas-dark-ink-strong)]'
      : 'text-[var(--canvas-dark-ink)] hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]'
  }`}
>
  <Icon
    className="w-4 h-4"
    style={{ color: isActive ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
  />
  <span>{label}</span>
</Link>
```

All 11 entries — Dashboard / Outline / Wiki / Annotations / Discussions / Submit Chapter / Edit Suggestions / Word Goals / Buzz Board / Members / Settings — preserved in this exact order. Icons stay lucide-react at 16px.

- [ ] **Step 5: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `npm run dev`, navigate to any hive page. Confirm: sidebar reads as a single rounded panel with the new gradient; hive name brand-yellow; active row has lighter gradient + tile shadow + brand-yellow icon; idle rows readable on hover.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/layout.tsx" "app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx"
git commit -m "style(hive): T1 — hive layout shell + sidebar aesthetic refresh"
```

**Acceptance criteria:**
- Hive layout backdrop uses the app-backdrop gradient.
- Sidebar renders as a single rounded panel with `--sh-card` shadow.
- Hive name in header is brand-yellow Comfortaa.
- Every nav entry is present and clickable; active entry uses the gradient + tile shadow + brand-yellow icon (no left-stripe).
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 1 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin `layout.tsx` (app backdrop) and `_components/hive-sidebar.tsx` (panel + header + 11 nav entries). Preserve every nav entry in the documented order. The active entry uses gradient + tile shadow — NO left-stripe accent. Hive name in the header is brand-yellow Comfortaa. Run tsc + tests + visual check, then commit.

---

### Task 2: Hive dashboard page

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/page.tsx`

**Surfaces changed:**
- Page title "Welcome to {hive name}" → `color: var(--brand)`, Comfortaa weight 700, text-2xl
- Welcome card (the H1 landing card with hive name + member count + last-active relTime) → outer panel treatment
- Book card (the linked-book or standalone hint card) → outer panel treatment + paper-warm cover preserved (the cover SVG / image inside doesn't change)
- Stats tiles (member count / activity count / etc., if present) → tile gradient + `--sh-tile` + `--r-card`
- "Last activity" subline → mono text in `var(--canvas-dark-ink-muted)`

- [ ] **Step 1: Page header**

Replace the page-level h1 element:

```tsx
<h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-6">
  Welcome to {hive.name}
</h1>
```

- [ ] **Step 2: Welcome / member-count card**

The card that summarizes the hive (description, member count, last-active relTime):

```tsx
<section
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6 mb-6"
>
  {/* existing children: description + meta row */}
</section>
```

- [ ] **Step 3: Book card**

If the hive is linked to a non-shadow book, the dashboard surfaces a card linking to the book's editor:

```tsx
<Link
  href={`/${locale}/studio/${book.id}`}
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="block p-5 hover:translate-y-[-1px] transition-transform"
>
  {/* preserve: existing cover image / paper-warm cover SVG, title, author meta */}
</Link>
```

The book cover stays exactly as-is; only the surrounding card chrome changes.

- [ ] **Step 4: Standalone-hive fallback**

For standalone hives (no linked book — shadow-book pattern from H2 T8), the dashboard shows a "Standalone hive — no book linked" empty card. Apply the same panel treatment + brand-yellow heading for any sub-card.

- [ ] **Step 5: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open the dashboard for both a linked-book hive and a standalone hive. Confirm: page heading is brand-yellow; welcome card and book card both render as rounded panels; book cover unchanged.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/page.tsx"
git commit -m "style(hive): T2 — dashboard aesthetic refresh"
```

**Acceptance criteria:**
- Page heading is brand-yellow Comfortaa.
- Welcome card and book card both panel-styled.
- Book cover image / paper-warm SVG unchanged.
- Standalone-hive fallback panel-styled.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 2 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin `page.tsx` (the hive dashboard). Page heading brand-yellow Comfortaa. Welcome card + book card use outer panel treatment. Book cover artwork unchanged. Standalone-hive fallback also panel-styled. Run tsc + tests + visual check, then commit.

---

### Task 3: Hive Wiki — shell + entry editor + folder renderer + category picker

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-shell.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/by-category-view.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/by-folder-view.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/notes-view.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/entry-card.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-entry-editor.tsx`

**Surfaces changed:**
- Wiki shell outer container → outer panel treatment
- Page title "Wiki" → `color: var(--brand)`, Comfortaa weight 700
- "+ New Entry" trigger → `color: var(--brand)`, weight 600, `border-radius: var(--r-btn)`, hover bg lighter gradient
- Search input → recessed input treatment (`var(--sh-inset)`, `border-radius: var(--r-row)`)
- 3-tab view switch (By Category / By Folder / Notes) → tile gradient idle + active tab uses solid `var(--brand)` bg + `var(--brand-ink)` text, `border-radius: var(--r-pill)`
- Category accordion sections → each section header bg uses tile gradient + `var(--sh-tile)`, category accent color (the existing `--wiki-*` tint) preserved as a left-edge stripe
- Folder rows (in By Folder view) → row treatment (`--r-row`, hover gradient)
- Entry cards → `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`, `--r-row`, `--sh-tile`, title in `var(--canvas-dark-ink-strong)`, excerpt in `var(--canvas-dark-ink-muted)`, tag chips preserved
- Notes-view cards → same entry-card treatment
- Hive wiki entry editor surface → outer panel treatment; the existing cream paper child sheet is NOT used here (wiki entries live on dark walnut cards per H2 T13). Scoped `[data-slot="wiki-entry-pane"] .ProseMirror { color: var(--canvas-dark-ink); }` preserved
- Category breadcrumb chip in entry editor → existing `--wiki-{CATEGORY}` accent retained
- Tag strip → existing accent (already wired to `--wiki-{CATEGORY}` via the shared TagChipStrip) preserved
- Read-only mode footer (BETA_READER) → muted text on inset background

- [ ] **Step 1: Shell outer panel**

In `hive-wiki-shell.tsx`, wrap the entire shell in the outer panel treatment:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6 min-h-[calc(100vh-120px)]"
>
  {/* header + tab strip + view */}
</div>
```

- [ ] **Step 2: Page title + New Entry trigger**

```tsx
<div className="flex items-center justify-between mb-4">
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl">
    Wiki
  </h1>
  {canEditWiki && (
    <button
      onClick={() => setPickerOpen(true)}
      style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
      className="font-geist font-semibold text-sm px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
    >
      + New Entry
    </button>
  )}
</div>
```

- [ ] **Step 3: Search input (recessed)**

```tsx
<input
  type="text"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Search wiki..."
  style={{
    background: 'var(--canvas-dark-100)',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-inset)',
    border: 'var(--br-card)',
    color: 'var(--canvas-dark-ink)',
  }}
  className="w-full px-3 py-2 text-sm font-geist placeholder:text-[var(--canvas-dark-ink-muted)] focus:outline-none"
/>
```

- [ ] **Step 4: 3-tab view switch**

```tsx
<div className="flex gap-1 mb-6" role="tablist">
  {(['by-category', 'by-folder', 'notes'] as const).map((tab) => {
    const isActive = view === tab
    return (
      <button
        key={tab}
        role="tab"
        aria-selected={isActive}
        onClick={() => setView(tab)}
        style={{
          background: isActive
            ? 'var(--brand)'
            : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          color: isActive ? 'var(--brand-ink)' : 'var(--canvas-dark-ink)',
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--sh-tile)',
        }}
        className="px-4 py-1.5 text-xs font-geist font-semibold"
      >
        {tab === 'by-category' ? 'By Category' : tab === 'by-folder' ? 'By Folder' : 'Notes'}
      </button>
    )
  })}
</div>
```

- [ ] **Step 5: By Category view — section accordion headers**

In `by-category-view.tsx`, each category section header (collapsible row with category icon + label + count + caret):

```tsx
<button
  onClick={() => toggle(category)}
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
    borderLeft: `3px solid var(--wiki-${category.toLowerCase()})`,
  }}
  className="w-full flex items-center gap-3 px-4 py-3 mb-2"
>
  <Icon className="w-4 h-4" style={{ color: `var(--wiki-${category.toLowerCase()})` }} />
  <span className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)]">
    {label}
  </span>
  <span className="ml-auto text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
    {entries.length}
  </span>
  <ChevronDown className="w-4 h-4 text-[var(--canvas-dark-ink-muted)]" />
</button>
```

The existing per-category `--wiki-*` accent stays as a thin left stripe — the only place a category-tinted accent appears.

- [ ] **Step 6: By Folder view — folder rows + nesting**

In `by-folder-view.tsx`, folder rows mirror the wiki section header style; nested entries beneath each folder use the entry-card treatment from Step 8.

- [ ] **Step 7: Notes view — flat grid**

In `notes-view.tsx`, the "+ New Note" trigger uses the same `+ New Entry` brand-yellow text pattern from Step 2. Note cards use the entry-card treatment.

- [ ] **Step 8: Entry card (shared)**

In `entry-card.tsx`:

```tsx
<button
  onClick={onClick}
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="text-left p-4 flex flex-col gap-2 hover:translate-y-[-1px] transition-transform"
>
  <h3 className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)] truncate">
    {entry.title}
  </h3>
  <p className="text-xs text-[var(--canvas-dark-ink-muted)] line-clamp-2">
    {entry.excerpt}
  </p>
  {/* tag chips preserved with existing TagChipStrip */}
  <div className="text-[10px] font-mono text-[var(--canvas-dark-ink-muted)]">
    @{entry.authorUsername} · {relTime}
  </div>
</button>
```

- [ ] **Step 9: Hive wiki entry editor surface**

In `hive-wiki-entry-editor.tsx`:
- Outer container → outer panel treatment with `data-slot="wiki-entry-pane"` preserved (per H2 T13 — required for scoped ProseMirror styling).
- Breadcrumb "← Back to wiki" link → text in `var(--canvas-dark-ink-muted)`, hover `var(--canvas-dark-ink-strong)`.
- Category pill (icon + label, accent color from `--wiki-{category}`) → preserved as-is; the accent color rule is brand-independent per the spec.
- Title contenteditable → `color: var(--canvas-dark-ink-strong)`, Comfortaa weight 700, text-2xl. Inline `wiki-title` class continues to wire the contenteditable placeholder.
- Tag strip → preserved (already styled via TagChipStrip with category accent).
- TipTap body container → inside the panel, no extra background; the scoped `[data-slot="wiki-entry-pane"] .ProseMirror { color: var(--canvas-dark-ink); }` block in `globals.css` stays.
- Save badge (top right) → off-green status pill (existing — not brand-yellow).
- Read-only footer (BETA_READER) → "Read-only — your role is Beta Reader" in `var(--canvas-dark-ink-muted)` on inset bg, `var(--sh-inset)`, `--r-row`.

- [ ] **Step 10: Category picker modal**

The shared `WikiCategoryPicker` (consumed via `hive-wiki-shell.tsx` New Entry flow) is rendered via the shadcn `Dialog` primitive — **already re-skinned** in editor T8. Do not re-skin. Verify the 13 category cards (CHARACTER excluded — Character is its own first-class binder type) still render with `--wiki-{category}` accent tint and now sit on the new modal panel surface correctly. If padding feels off after the Dialog refresh, adjust `sm:max-w-3xl` / inner padding only.

- [ ] **Step 11: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `/hive/{hiveId}/wiki`. Confirm: shell is a single rounded panel; "Wiki" heading brand-yellow; "+ New Entry" brand-yellow; search input recessed; 3 tab pills, active is brand-yellow; By Category shows 14 sections with left-stripe accents; By Folder shows recursive tree; Notes view shows flat grid. Click an entry → editor opens inside panel with scoped ProseMirror body readable. Click "+ New Entry" → picker modal opens with new panel surface.

- [ ] **Step 12: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/wiki/"
git commit -m "style(hive): T3 — wiki shell + entry editor + folder renderer + category picker aesthetic refresh"
```

**Acceptance criteria:**
- Wiki shell renders as a single rounded panel.
- "Wiki" page heading brand-yellow Comfortaa.
- "+ New Entry" trigger brand-yellow.
- 3-tab view switch: idle uses tile gradient, active uses solid brand-yellow pill.
- By Category section accordions show `--wiki-{category}` left-stripe accent.
- Entry cards use tile gradient + tile shadow; titles emphasized, excerpts muted.
- Hive wiki entry editor surface uses outer panel treatment; ProseMirror body readable.
- Category picker modal inherits Dialog primitive cascade.
- Read-only footer (BETA_READER) renders on inset background.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 3 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the 7 wiki files. Preserve the `data-slot="wiki-entry-pane"` attribute (load-bearing for scoped ProseMirror). Preserve every `--wiki-{CATEGORY}` accent color (used as left-stripe / pill / tag accent). DO NOT re-skin the Dialog primitive — `WikiCategoryPicker` inherits the cascade. Preserve the BETA_READER read-only mode footer. Run tsc + tests + visual check on `/hive/{hiveId}/wiki`, then commit.

---

### Task 4: Hive Outline — beat sheet surface

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/_components/hive-outline-surface.tsx`

**Surfaces changed:**
- Outline shell outer container → outer panel treatment
- Page title "Outline" → `color: var(--brand)`, Comfortaa weight 700
- "Last edited by @{username} · {relTime}" subline → mono text muted (right of title)
- Act group headers → tile gradient + `--sh-tile` + `--r-row`, act-name input inline-editable, ungrouped "No Act" header non-editable
- Per-act "+ Add beat" trigger → brand-yellow text, weight 600
- Beat rows (`OutlineBeatRow` — presentational, reused from studio) → already styled in editor T10; verify they sit correctly inside the new panel
- Chapter-link popover (the hive-cloned variant `HiveChapterLinkPopover`) → panel treatment for the popover content surface, recessed input for the search field
- Read-only mode (BETA_READER) — disables drag handles + status pills + "Add beat" triggers; footer "Read-only — your role is Beta Reader"
- Empty state ("No outline yet — the author can create one in the editor" → brand-yellow link "Open the book in the studio")
- Standalone-hive variant of chapter-link popover ("Standalone hive — no chapters available to link.") → muted text on inset

- [ ] **Step 1: Outer panel**

In `hive-outline-surface.tsx`:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  {/* header + acts + footer */}
</div>
```

- [ ] **Step 2: Header (title + edited-by)**

```tsx
<div className="flex items-center justify-between mb-6">
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl">
    Outline
  </h1>
  {lastEditedByUsername && (
    <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
      Last edited by @{lastEditedByUsername} · {relTime(lastEditedAt)}
    </p>
  )}
</div>
```

- [ ] **Step 3: Act group header**

For each act group, header treatment:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="flex items-center gap-3 px-4 py-2 mb-3"
>
  {act === null ? (
    <span className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-muted)]">
      No Act
    </span>
  ) : (
    <input
      defaultValue={act}
      onBlur={(e) => commitActName(act, e.currentTarget.value)}
      readOnly={readOnly}
      style={{ background: 'transparent' }}
      className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)] focus:outline-none"
    />
  )}
  <span className="ml-auto text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
    {beats.length} {beats.length === 1 ? 'beat' : 'beats'}
  </span>
</div>
```

- [ ] **Step 4: Per-act + ungrouped "Add a beat" trigger**

```tsx
{!readOnly && (
  <button
    onClick={() => addBeat({ act })}
    style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
    className="font-geist font-semibold text-sm px-2 py-1 mt-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
  >
    + Add a beat
  </button>
)}
```

- [ ] **Step 5: Beat rows (`OutlineBeatRow`)**

`OutlineBeatRow` is the shared presentational component already re-skinned in editor T10. Verify it sits correctly inside the new panel — beat row paper-card, status pill via existing `--status-{state}` tint, chapter-link chip preserved. No code changes expected unless visual conflicts surface during T11.

- [ ] **Step 6: Hive chapter-link popover**

The local `HiveChapterLinkPopover` (cloned from studio per H2 T17 to drop the `useBookEditor` dependency):

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="min-w-[280px] p-2"
>
  {/* search input (recessed) + chapter list (rows) */}
</div>
```

Chapter list rows use the row treatment from T1 Step 4. Search input uses the recessed input pattern from T3 Step 3. Standalone-hive variant text on inset bg:

```tsx
<p
  style={{
    background: 'var(--canvas-dark-100)',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-inset)',
  }}
  className="px-3 py-2 text-xs text-[var(--canvas-dark-ink-muted)]"
>
  Standalone hive — no chapters available to link.
</p>
```

- [ ] **Step 7: Empty state**

When `outline === null`:

```tsx
<div className="text-center py-12">
  <p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-3">
    No outline yet — the author can create one in the editor.
  </p>
  <Link
    href={`/${locale}/studio/${bookId}`}
    style={{ color: 'var(--brand)' }}
    className="font-geist font-semibold text-sm"
  >
    Open the book in the studio →
  </Link>
</div>
```

- [ ] **Step 8: Read-only footer**

```tsx
{readOnly && (
  <p
    style={{
      background: 'var(--canvas-dark-100)',
      borderRadius: 'var(--r-row)',
      boxShadow: 'var(--sh-inset)',
    }}
    className="mt-6 px-3 py-2 text-xs text-[var(--canvas-dark-ink-muted)]"
  >
    Read-only — your role is Beta Reader
  </p>
)}
```

- [ ] **Step 9: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `/hive/{hiveId}/outline` for: (a) a hive with beats grouped into Acts, (b) a hive with no outline → empty state, (c) a standalone hive → popover variant, (d) BETA_READER role → read-only footer renders + drag/add disabled.

- [ ] **Step 10: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/outline/"
git commit -m "style(hive): T4 — outline beat sheet aesthetic refresh"
```

**Acceptance criteria:**
- Outline shell as outer panel.
- "Outline" heading brand-yellow Comfortaa.
- "Last edited by" subline mono muted.
- Act group headers tile gradient + tile shadow.
- Per-act and ungrouped "+ Add a beat" brand-yellow.
- Hive chapter-link popover panel-styled with recessed search.
- Empty-state link brand-yellow.
- Read-only footer on inset.
- Drag, status pills, chapter-link chip all preserved.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 4 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin both outline files. Preserve `OutlineBeatRow` (already styled in editor T10), all drag handles, status pill behavior, chapter-link chip. The hive chapter-link popover is the local clone — re-skin its surface. Standalone-hive variant: chapter-list message on inset bg. Read-only footer for BETA_READER. Run tsc + tests + visual check on three hive variants (acts present / outline missing / standalone), then commit.

---

### Task 5: Hive Chapters — index + chapter view

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/_components/hive-chapter-index.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/hive-chapter-surface.tsx`

**Surfaces changed:**
- Chapters index page → outer panel + brand-yellow heading + chapter list rows (row treatment)
- Each chapter row → tile gradient + tile shadow + `--r-row`, title emphasized, word-count metadata mono muted, status pill preserved
- Chapter view outer frame → outer panel (the dark frame around the cream paper sheet)
- **Cream paper sheet inside the chapter view → UNCHANGED** (Newsreader serif, paper-100 bg, paper-ink text, prose padding all preserved byte-for-byte per Pre-flight C)
- Collab gutter chrome (mounted inside chapter view) → already re-skinned in editor T9; verify no conflict with the new panel chrome around it
- "← Back to chapters" link → muted text, brand-yellow on hover

- [ ] **Step 1: Chapter index outer panel + heading**

In `hive-chapter-index.tsx`:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-6">
    Chapters
  </h1>
  <div className="flex flex-col gap-2">
    {/* chapter rows */}
  </div>
</div>
```

- [ ] **Step 2: Chapter row**

```tsx
<Link
  href={`/${locale}/hive/${hiveId}/chapters/${chapter.id}`}
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="flex items-center gap-3 px-4 py-3 hover:translate-y-[-1px] transition-transform"
>
  <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--status-${chapter.status.toLowerCase()})` }} />
  <h3 className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)] truncate">
    {chapter.title}
  </h3>
  <span className="ml-auto text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
    {chapter.wordCount.toLocaleString()} words
  </span>
</Link>
```

- [ ] **Step 3: Chapter view outer frame**

In `hive-chapter-surface.tsx`, the outermost wrapper around the cream paper sheet + collab gutter:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex gap-0 overflow-hidden"
>
  <div className="flex-1 min-w-0 px-8 py-6">
    {/* back-link + chapter title + cream paper sheet (unchanged) */}
  </div>
  {/* collab gutter (already styled in editor T9) */}
</div>
```

- [ ] **Step 4: Back link + chapter title**

```tsx
<Link
  href={`/${locale}/hive/${hiveId}/chapters`}
  className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4 inline-block"
>
  ← Back to chapters
</Link>
<h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-6">
  {chapter.title}
</h1>
```

- [ ] **Step 5: Cream paper sheet UNCHANGED**

The cream paper sheet container (containing the read-only TipTap surface with Newsreader serif and paper-ink prose color) is left exactly as it was — same `background: var(--paper-100)`, same `color: var(--paper-ink)`, same line-height, same max-width, same padding. **Do not touch this element.**

- [ ] **Step 6: Verify collab gutter chrome**

The collab gutter (`<CollaborationGutter />` mount point inside `hive-chapter-surface.tsx`) was re-skinned in editor T9. Confirm: gutter container's left border + the surrounding panel's right edge don't create a visual collision. If they do, drop the gutter's outer left border (its parent now provides the visual boundary).

- [ ] **Step 7: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `/hive/{hiveId}/chapters` → chapter index renders as panel with row list. Click a chapter → chapter view opens; cream paper sheet identical to studio editor (read-only); collab gutter sits cleanly on the right. Open an annotation → card renders correctly inside the panel.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/chapters/"
git commit -m "style(hive): T5 — chapters index + chapter view aesthetic refresh"
```

**Acceptance criteria:**
- Chapters index renders as outer panel; "Chapters" heading brand-yellow.
- Each chapter row uses tile gradient + tile shadow; status dot preserved.
- Chapter view outer frame uses outer panel treatment.
- Cream paper sheet inside chapter view byte-for-byte unchanged.
- Collab gutter (editor T9 styling) integrates cleanly.
- "← Back to chapters" link muted with brand-yellow hover.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 5 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the 4 chapter files. CRITICAL: do NOT touch the cream paper sheet inside `hive-chapter-surface.tsx` — Newsreader serif, paper-100 bg, paper-ink prose color all preserved byte-for-byte. The collab gutter is already styled (editor T9) — verify integration only. Run tsc + tests + visual check, then commit.

---

### Task 6: Annotations bulk view + Suggestions bulk view

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/annotations/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/annotations/_components/annotations-by-chapter.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/suggestions/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/suggestions/_components/suggestions-by-chapter.tsx`

**Surfaces changed:**
- Both pages → outer panel container + brand-yellow page heading ("Annotations" / "Edit Suggestions")
- Per-chapter group headers (the chapter title grouping rows of annotations / suggestions) → tile gradient + `--sh-tile` + `--r-row`
- Annotation / suggestion cards inside groups → reuse the styling already shipped in editor T11 (`components/hive/collab/annotation-card.tsx`, `suggestion-card.tsx`). DO NOT re-skin those cards — they already use the per-layer accent + tile gradient.
- Filter strip (if present at the page top) → reuse `GutterFilterStrip` styling from editor T11. Confirm it sits cleanly inside the new outer panel.
- "Jump to chapter" links inside cards → preserved with muted text + brand-yellow hover

- [ ] **Step 1: Annotations page panel**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-6">
    Annotations
  </h1>
  <AnnotationsByChapter ... />
</div>
```

- [ ] **Step 2: Per-chapter group header**

In `annotations-by-chapter.tsx`:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="flex items-center gap-3 px-4 py-2 mb-3"
>
  <h2 className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)]">
    {chapter.title}
  </h2>
  <span className="ml-auto text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
    {annotations.length}
  </span>
  <Link
    href={`/${locale}/hive/${hiveId}/chapters/${chapter.id}`}
    className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]"
  >
    Jump →
  </Link>
</div>
```

- [ ] **Step 3: Annotation cards (no changes)**

The existing `<AnnotationCard />` import from `components/hive/collab/annotation-card.tsx` is consumed as-is. Layer accents (GRAMMAR / PLOT / etc.) preserved.

- [ ] **Step 4: Suggestions page mirrors annotations**

`suggestions/page.tsx` + `suggestions-by-chapter.tsx` get identical treatment. Heading is "Edit Suggestions". `<SuggestionCard />` from editor T11 reused.

- [ ] **Step 5: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open both pages. Confirm: outer panel + brand-yellow heading; per-chapter group headers tile-gradient; annotation/suggestion cards render with their layer accents; "Jump →" links work.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/annotations/" "app/[locale]/(app)/hive/[hiveId]/suggestions/"
git commit -m "style(hive): T6 — annotations + suggestions bulk views aesthetic refresh"
```

**Acceptance criteria:**
- Annotations page + Suggestions page each render as outer panel with brand-yellow heading.
- Per-chapter group headers use tile gradient.
- Cards reuse editor T11 styling unchanged.
- "Jump →" links operational.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 6 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the 4 files. DO NOT re-skin `AnnotationCard` or `SuggestionCard` — editor T11 already handled them. Only the page chrome + per-chapter group headers + jump-links change here. Run tsc + tests + visual check, then commit.

---

### Task 7: Submissions — list + composer + review/read

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submissions-list.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-row.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/new/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-composer.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/[submissionId]/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-review.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-read.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-shared.tsx`

**Surfaces changed:**
- List page → outer panel + brand-yellow heading "Submissions" + "+ New Submission" brand-yellow CTA + submissions list as paper-card rows
- Each submission row → tile gradient + `--r-row` + `--sh-tile`, title emphasized, status pill preserved (`PENDING` / `APPROVED` / `REJECTED` per H3 schema), submitter `@username`, timestamp mono muted
- Composer (`/submissions/new`) → outer panel + brand-yellow heading "Submit a Chapter" + chapter picker (Select w/ recessed input) + diff preview block + Submit brand CTA
- Review page (moderator view) → outer panel + brand-yellow heading + read-only diff block + Approve/Reject action row (Approve = brand-yellow filled, Reject = outline destructive)
- Read page (read view for non-moderators) → outer panel + read-only diff + status pill
- Shared subcomponents in `submission-shared.tsx` (diff renderer, status pill, etc.) → tile treatment on diff container, status pill uses existing `--status-*` tokens

- [ ] **Step 1: List page outer panel**

In `submissions/page.tsx`:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <div className="flex items-center justify-between mb-6">
    <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl">
      Submissions
    </h1>
    {canSubmit && (
      <Link
        href={`/${locale}/hive/${hiveId}/submissions/new`}
        style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
        className="font-geist font-semibold text-sm px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
      >
        + New Submission
      </Link>
    )}
  </div>
  <SubmissionsList ... />
</div>
```

- [ ] **Step 2: Submission row**

In `submission-row.tsx`:

```tsx
<Link
  href={`/${locale}/hive/${hiveId}/submissions/${submission.id}`}
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="flex items-center gap-3 px-4 py-3 hover:translate-y-[-1px] transition-transform"
>
  <h3 className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)] truncate">
    {submission.chapterTitle}
  </h3>
  <StatusPill status={submission.status} /> {/* preserved */}
  <span className="ml-auto text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
    @{submission.submitterUsername} · {relTime(submission.createdAt)}
  </span>
</Link>
```

- [ ] **Step 3: Composer page**

In `submission-composer.tsx`:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-6">
    Submit a Chapter
  </h1>
  {/* chapter picker (recessed Select) + diff preview + Submit CTA */}
</div>
```

Diff preview block:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="p-4 my-4"
>
  {/* diff lines preserved */}
</div>
```

Submit CTA:

```tsx
<button
  type="submit"
  style={{
    background: 'var(--brand)',
    color: 'var(--brand-ink)',
    borderRadius: 'var(--r-btn)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="font-geist font-semibold text-sm px-4 py-2"
>
  Submit for Review
</button>
```

- [ ] **Step 4: Review page**

`submission-review.tsx` (moderator view): same outer panel; Approve button uses solid brand-yellow CTA; Reject button outline destructive:

```tsx
<button
  onClick={onReject}
  style={{
    color: 'var(--destructive)',
    borderRadius: 'var(--r-btn)',
    border: '1px solid color-mix(in oklch, var(--destructive) 40%, transparent)',
  }}
  className="font-geist font-semibold text-sm px-4 py-2 hover:bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)]"
>
  Reject
</button>
```

- [ ] **Step 5: Read page**

`submission-read.tsx`: outer panel + read-only diff block (tile treatment) + status pill. No action row.

- [ ] **Step 6: Shared subcomponents**

`submission-shared.tsx` exports the diff renderer + status pill helpers. Diff renderer container gets the tile treatment (Step 3). Status pill uses the existing `--status-{state}` tokens (PENDING / APPROVED / REJECTED).

- [ ] **Step 7: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Walk: list page → "+ New Submission" → composer → submit → list shows PENDING row → moderator opens review page → Approve / Reject flow. Confirm every surface panel-styled, status pills colored correctly.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/submissions/"
git commit -m "style(hive): T7 — submissions list + composer + review + read aesthetic refresh"
```

**Acceptance criteria:**
- List page: outer panel, brand-yellow heading, brand-yellow "+ New Submission".
- Submission rows: tile gradient + tile shadow + status pill.
- Composer: outer panel + diff preview tile + solid brand-yellow Submit CTA.
- Review: Approve solid brand-yellow + Reject outline destructive.
- Read: read-only diff inside outer panel.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 7 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin all 9 submission files. The diff renderer in `submission-shared.tsx` is the visual heart of the composer/review/read pages — it gets the tile treatment. Status pills use the existing `--status-{state}` tokens — preserved. Approve = solid brand-yellow CTA; Reject = outline destructive. Run tsc + tests + visual check covering composer → list → review, then commit.

---

### Task 8: Discussions — list + thread + compose modal

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussions-list.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussion-row.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/[postId]/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussion-thread.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussion-compose-modal.tsx`

**Surfaces changed:**
- List page → outer panel + brand-yellow heading "Discussions" + "+ New Discussion" brand-yellow CTA
- Discussion row → tile gradient + `--r-row` + `--sh-tile`, title emphasized, reply-count metadata mono muted, last-activity relTime
- Thread page → outer panel + brand-yellow thread title + thread body card + reply list + inline reply composer
- Each reply card → tile gradient with author avatar + `@username` + timestamp
- Reply composer (inline at thread bottom) → textarea with `var(--sh-inset)` + brand-yellow Post button
- Compose modal (`discussion-compose-modal.tsx`) → inherits Dialog primitive cascade from editor T8; verify title input + body textarea use recessed treatment

- [ ] **Step 1: List page outer panel + header**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <div className="flex items-center justify-between mb-6">
    <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl">
      Discussions
    </h1>
    <button
      onClick={() => setComposeOpen(true)}
      style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
      className="font-geist font-semibold text-sm px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
    >
      + New Discussion
    </button>
  </div>
  <DiscussionsList ... />
</div>
```

- [ ] **Step 2: Discussion row**

In `discussion-row.tsx`:

```tsx
<Link
  href={`/${locale}/hive/${hiveId}/discussions/${post.id}`}
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="flex items-start gap-3 px-4 py-3 hover:translate-y-[-1px] transition-transform"
>
  <Avatar src={post.author.avatarUrl} />
  <div className="flex-1 min-w-0">
    <h3 className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)] truncate">
      {post.title}
    </h3>
    <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
      @{post.author.username} · {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'} · {relTime(post.lastActivityAt)}
    </p>
  </div>
</Link>
```

- [ ] **Step 3: Thread page**

`[postId]/page.tsx` + `discussion-thread.tsx`:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <Link
    href={`/${locale}/hive/${hiveId}/discussions`}
    className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4 inline-block"
  >
    ← Back to discussions
  </Link>
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-2">
    {post.title}
  </h1>
  <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mb-6">
    @{post.author.username} · {relTime(post.createdAt)}
  </p>
  {/* body card + reply list + reply composer */}
</div>
```

Body card (tile treatment):

```tsx
<article
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="p-4 mb-6 font-prose text-[var(--canvas-dark-ink)]"
>
  {/* body content */}
</article>
```

- [ ] **Step 4: Reply card (per-reply row)**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="flex gap-3 p-4 mb-3"
>
  <Avatar src={reply.author.avatarUrl} />
  <div className="flex-1 min-w-0">
    <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mb-1">
      @{reply.author.username} · {relTime(reply.createdAt)}
    </p>
    <p className="text-sm text-[var(--canvas-dark-ink)]">{reply.body}</p>
  </div>
</div>
```

- [ ] **Step 5: Reply composer**

```tsx
<form onSubmit={postReply} className="mt-6">
  <textarea
    value={reply}
    onChange={(e) => setReply(e.target.value)}
    placeholder="Write a reply..."
    style={{
      background: 'var(--canvas-dark-100)',
      borderRadius: 'var(--r-row)',
      boxShadow: 'var(--sh-inset)',
      border: 'var(--br-card)',
      color: 'var(--canvas-dark-ink)',
    }}
    className="w-full px-3 py-2 min-h-[80px] resize-y font-geist text-sm focus:outline-none"
  />
  <div className="flex justify-end mt-2">
    <button
      type="submit"
      style={{
        background: 'var(--brand)',
        color: 'var(--brand-ink)',
        borderRadius: 'var(--r-btn)',
        boxShadow: 'var(--sh-tile)',
      }}
      className="font-geist font-semibold text-sm px-4 py-2"
    >
      Post Reply
    </button>
  </div>
</form>
```

- [ ] **Step 6: Compose modal**

`discussion-compose-modal.tsx` is a shadcn-Dialog composition — already styled. Inside, title input + body textarea use recessed-input treatment from Step 5 / T3 Step 3. Post button is solid brand-yellow CTA.

- [ ] **Step 7: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

List → "+ New Discussion" → compose modal → submit → row appears → thread opens with body card + reply list + composer at bottom. Post a reply → row appears.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/discussions/"
git commit -m "style(hive): T8 — discussions list + thread + compose aesthetic refresh"
```

**Acceptance criteria:**
- List page: outer panel + brand-yellow heading + brand-yellow "+ New Discussion".
- Discussion rows: tile gradient + avatar + reply-count subline.
- Thread: outer panel + back link + brand-yellow title + body card + reply cards (tile gradient).
- Reply composer: textarea recessed + Post Reply brand-yellow CTA.
- Compose modal inherits Dialog cascade.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 8 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the 6 discussion files. DO NOT re-skin the Dialog primitive — `discussion-compose-modal.tsx` inherits. Inside the modal, only the title/body inputs + Post button receive the recessed/brand CTA treatment. Run tsc + tests + visual check covering list → compose → thread → reply, then commit.

---

### Task 9: Word Goals — page + modals + sidebar progress badge

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/active-goals-strip.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/goal-card.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/contributors-panel.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/recent-activity-panel.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/goal-history.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/empty-state.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/new-goal-modal.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/edit-goal-modal.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx` (re-skin the embedded word-goals progress badge — touched in T1 for nav, now for the badge widget)

**Surfaces changed:**
- Page → outer panel + brand-yellow heading "Word Goals" + "+ New Goal" brand-yellow CTA (gated by canCreateGoal)
- Active goals strip → row of goal-card tiles (tile gradient + `--sh-tile`)
- Goal card → tile gradient, goal title emphasized, progress bar uses `var(--brand)` fill on track `var(--canvas-dark-100)` + `var(--sh-inset)`, target/current count mono muted
- Contributors panel + Recent Activity panel + Goal History → each as a sub-panel (tile gradient on background, `--r-card`, `--sh-tile`) with brand-yellow sub-heading
- Empty state → centered EmptyState (inherits editor T13 styling) + brand-yellow CTA
- New/Edit goal modals → inherit Dialog cascade; inputs use recessed treatment; primary CTA solid brand-yellow
- **Sidebar word-goals badge** (H4 T11 widget embedded in sidebar above the nav footer) → tile gradient + tile shadow + brand-yellow progress fill + brand-yellow goal title

- [ ] **Step 1: Page outer panel + header**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <div className="flex items-center justify-between mb-6">
    <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl">
      Word Goals
    </h1>
    {canCreateGoal && (
      <button
        onClick={() => setNewModalOpen(true)}
        style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
        className="font-geist font-semibold text-sm px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
      >
        + New Goal
      </button>
    )}
  </div>
  {/* active goals strip + 3-column grid (contributors / activity / history) */}
</div>
```

- [ ] **Step 2: Goal card**

In `goal-card.tsx`:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="p-4"
>
  <h3 className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)] mb-2">
    {goal.title}
  </h3>
  <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mb-3">
    {goal.currentWords.toLocaleString()} / {goal.targetWords.toLocaleString()} words
  </p>
  <div
    style={{
      background: 'var(--canvas-dark-100)',
      borderRadius: 'var(--r-pill)',
      boxShadow: 'var(--sh-inset)',
    }}
    className="h-2 overflow-hidden"
  >
    <div
      style={{
        background: 'var(--brand)',
        width: `${Math.min(100, (goal.currentWords / goal.targetWords) * 100)}%`,
        borderRadius: 'var(--r-pill)',
      }}
      className="h-full"
    />
  </div>
  {/* deadline + edit kebab */}
</div>
```

- [ ] **Step 3: Contributors, Recent Activity, History sub-panels**

Each as a sub-panel:

```tsx
<section
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="p-4"
>
  <h2 style={{ color: 'var(--brand)' }} className="font-comfortaa font-semibold text-sm mb-3">
    Contributors
  </h2>
  {/* rows */}
</section>
```

Repeat for Recent Activity ("Recent Activity") and Goal History ("History").

- [ ] **Step 4: Empty state**

The `<EmptyState>` import from the editor `_components/empty-state.tsx` (re-skinned in editor T13) is consumed here as-is. Pass `onEditorCanvas={false}` (or omit — the dark-chrome variant is the default).

- [ ] **Step 5: New/Edit goal modals**

Both compose the shadcn Dialog primitive — already styled. Inside the modal, title input + numeric target input + date picker use the recessed-input treatment. Primary CTA solid brand-yellow.

- [ ] **Step 6: Sidebar word-goals progress badge**

In `hive-sidebar.tsx`, the existing word-goals badge widget (visible above the nav footer when the hive has an active goal):

```tsx
{activeGoalSummary && (
  <Link
    href={`/${locale}/hive/${hiveId}/word-goals`}
    style={{
      background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
      borderRadius: 'var(--r-row)',
      boxShadow: 'var(--sh-tile)',
      border: 'var(--br-card)',
    }}
    className="block p-3 mx-3 mb-3"
  >
    <p style={{ color: 'var(--brand)' }} className="font-comfortaa font-semibold text-xs mb-1.5 truncate">
      {activeGoalSummary.title}
    </p>
    <div
      style={{
        background: 'var(--canvas-dark-100)',
        borderRadius: 'var(--r-pill)',
        boxShadow: 'var(--sh-inset)',
      }}
      className="h-1.5 overflow-hidden"
    >
      <div
        style={{
          background: 'var(--brand)',
          width: `${pct}%`,
          borderRadius: 'var(--r-pill)',
        }}
        className="h-full"
      />
    </div>
    <p className="text-[10px] font-mono text-[var(--canvas-dark-ink-muted)] mt-1.5">
      {currentWords.toLocaleString()} / {targetWords.toLocaleString()}
    </p>
  </Link>
)}
```

- [ ] **Step 7: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `/hive/{hiveId}/word-goals`. Confirm: outer panel + brand-yellow heading; goal cards show brand-yellow progress fill on inset track; three sub-panels each with brand-yellow sub-heading; New Goal modal opens with recessed inputs + brand-yellow CTA. Sidebar badge: brand-yellow title + progress fill.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/word-goals/" "app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx"
git commit -m "style(hive): T9 — word goals page + modals + sidebar badge aesthetic refresh"
```

**Acceptance criteria:**
- Page: outer panel + brand-yellow heading + brand-yellow CTA.
- Goal cards: tile gradient + brand-yellow progress fill on inset track.
- Contributors / Recent Activity / History sub-panels: tile gradient + brand-yellow sub-headings.
- New/Edit modals inherit Dialog cascade; inputs recessed; CTA brand-yellow.
- Sidebar progress badge: tile gradient + brand-yellow title + brand-yellow fill.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 9 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the 9 word-goals files + the sidebar badge (which lives in `_components/hive-sidebar.tsx` — already touched in T1 for nav, now also for the badge). Progress bars use brand-yellow fill on inset track. New/Edit modals inherit Dialog cascade. Run tsc + tests + visual check on the page and on the sidebar (which must show the badge whenever the hive has an active goal), then commit.

---

### Task 10: Buzz Board — feed + compose/edit modals + like button

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-feed.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-post-card.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-empty-state.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/compose-buzz-modal.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/edit-buzz-modal.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/like-button.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/link-card.tsx`

**Surfaces changed:**
- Page → outer panel + brand-yellow heading "Buzz Board" + "+ New Post" brand-yellow CTA
- Buzz feed → flat list of buzz post cards
- Buzz post card → tile gradient + `--sh-tile` + `--r-card` (slightly bigger than `--r-row` because these are full posts), avatar + `@username` + relTime header, body in `--canvas-dark-ink` font-prose, image attachment preserved as-is, like button + reply count footer
- Link card (when post embeds a URL) → tile-within-tile, smaller inset card with link preview
- Empty state → centered EmptyState + brand-yellow CTA
- Compose / Edit modals → Dialog cascade; body textarea recessed; image attach affordance preserved; Post / Save brand-yellow CTA
- Like button → idle: muted heart icon; active: brand-yellow heart fill + count in brand-yellow

- [ ] **Step 1: Page outer panel + header**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <div className="flex items-center justify-between mb-6">
    <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl">
      Buzz Board
    </h1>
    <button
      onClick={() => setComposeOpen(true)}
      style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
      className="font-geist font-semibold text-sm px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
    >
      + New Post
    </button>
  </div>
  <BuzzFeed ... />
</div>
```

- [ ] **Step 2: Buzz post card**

In `buzz-post-card.tsx`:

```tsx
<article
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="p-5 mb-4"
>
  <header className="flex items-center gap-2 mb-3">
    <Avatar src={post.author.avatarUrl} />
    <span className="text-sm font-comfortaa font-semibold text-[var(--canvas-dark-ink-strong)]">
      @{post.author.username}
    </span>
    <span className="ml-auto text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
      {relTime(post.createdAt)}
    </span>
  </header>
  <div className="text-sm font-prose text-[var(--canvas-dark-ink)] whitespace-pre-wrap">
    {post.body}
  </div>
  {post.imageUrl && <img src={post.imageUrl} className="mt-3 rounded-lg max-w-full" />}
  {post.linkUrl && <LinkCard url={post.linkUrl} />}
  <footer className="flex items-center gap-3 mt-3">
    <LikeButton postId={post.id} liked={post.viewerLiked} count={post.likeCount} />
    {/* edit / delete kebab if author */}
  </footer>
</article>
```

- [ ] **Step 3: Link card (inset within post card)**

```tsx
<a
  href={url}
  target="_blank"
  rel="noopener noreferrer"
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-inset)',
    border: 'var(--br-card)',
  }}
  className="block p-3 mt-3 hover:translate-y-[-1px] transition-transform"
>
  {/* favicon + title + url + description preserved */}
</a>
```

- [ ] **Step 4: Like button**

In `like-button.tsx`:

```tsx
<button
  onClick={toggleLike}
  style={{
    color: liked ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
    borderRadius: 'var(--r-pill)',
  }}
  className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]"
  aria-label={liked ? 'Unlike' : 'Like'}
  aria-pressed={liked}
>
  <Heart className="w-4 h-4" fill={liked ? 'var(--brand)' : 'none'} />
  <span>{count}</span>
</button>
```

- [ ] **Step 5: Compose / Edit modals**

Both compose the Dialog primitive — already styled. Inside: body textarea uses recessed treatment + image attach button (the small camera icon + filename preview, preserved structure); Post / Save brand-yellow CTA. Link-preview-on-paste preserved.

- [ ] **Step 6: Empty state**

```tsx
<EmptyState
  icon={<MessageSquare className="w-8 h-8 text-[var(--canvas-dark-ink-muted)]" />}
  title="No buzz yet"
  body="Be the first to share something with the hive."
  cta={
    <button
      onClick={() => setComposeOpen(true)}
      style={{ background: 'var(--brand)', color: 'var(--brand-ink)', borderRadius: 'var(--r-btn)', boxShadow: 'var(--sh-tile)' }}
      className="font-geist font-semibold text-sm px-4 py-2"
    >
      Start the buzz
    </button>
  }
/>
```

- [ ] **Step 7: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `/hive/{hiveId}/buzz`. Confirm: outer panel + brand-yellow heading + "+ New Post" brand-yellow. Post cards render with tile gradient, avatar header, body, optional image, optional link card, like button + count. Like a post → heart fills brand-yellow. Compose a new post → modal opens (Dialog cascade) → submit → new card appears at top. Edit a post → edit modal opens → save.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/buzz/"
git commit -m "style(hive): T10 — buzz board feed + compose/edit + like aesthetic refresh"
```

**Acceptance criteria:**
- Page: outer panel + brand-yellow heading + brand-yellow CTA.
- Post cards: tile gradient + avatar header + body + image attach + link card + like footer.
- Link card: inset within post card.
- Like button: muted idle, brand-yellow active heart + count.
- Compose/Edit modals: Dialog cascade + recessed body + brand-yellow CTA.
- Empty state with brand-yellow CTA.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 10 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the 8 buzz files. DO NOT re-skin the Dialog primitive — both modals inherit. Like button: muted idle, brand-yellow active (heart fills + count colors). Image attachment + link-preview-on-paste structures preserved. Run tsc + tests + visual check covering compose → like → edit, then commit.

---

### Task 11: Members page — table + invite UI

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/members/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-members.tsx`

**Surfaces changed:**
- Page → outer panel + brand-yellow heading "Members"
- Member row → tile gradient + `--r-row` + `--sh-tile`, avatar + `@username` + display name + joinedAt mono muted + role dropdown
- Role dropdown (OWNER-only) → recessed Select; options: OWNER / MODERATOR / CONTRIBUTOR / BETA_READER
- Remove member kebab → muted icon, opens ConfirmDialog (already styled)
- Invite link section → sub-panel with the shareable link displayed as recessed-input text + "Copy link" brand-yellow CTA + member-count progress against `FREE_HIVE_MEMBER_LIMIT`

- [ ] **Step 1: Page outer panel + header**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-6">
    Members
  </h1>
  <HiveMembers ... />
</div>
```

- [ ] **Step 2: Invite link sub-panel**

In `hive-members.tsx`, above the members list:

```tsx
<section
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="p-4 mb-6"
>
  <h2 style={{ color: 'var(--brand)' }} className="font-comfortaa font-semibold text-sm mb-3">
    Invite link
  </h2>
  <div className="flex gap-2">
    <input
      readOnly
      value={inviteLink}
      style={{
        background: 'var(--canvas-dark-100)',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-inset)',
        border: 'var(--br-card)',
        color: 'var(--canvas-dark-ink)',
      }}
      className="flex-1 px-3 py-2 text-xs font-mono focus:outline-none"
      onClick={(e) => e.currentTarget.select()}
    />
    <button
      onClick={copyLink}
      style={{
        background: 'var(--brand)',
        color: 'var(--brand-ink)',
        borderRadius: 'var(--r-btn)',
        boxShadow: 'var(--sh-tile)',
      }}
      className="font-geist font-semibold text-sm px-3 py-2"
    >
      Copy
    </button>
  </div>
  <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-2">
    {memberCount} / {FREE_HIVE_MEMBER_LIMIT} members
  </p>
</section>
```

(The pre-existing `/en/...` hardcode bug in `inviteLink` is documented in AGENTS.md as deferred; do not fix in this presentational task.)

- [ ] **Step 3: Member row**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="flex items-center gap-3 px-4 py-3 mb-2"
>
  <Avatar src={member.avatarUrl} />
  <div className="flex-1 min-w-0">
    <p className="font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)]">
      @{member.username}
    </p>
    <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
      Joined {relTime(member.joinedAt)}
    </p>
  </div>
  {viewerIsOwner ? (
    <RoleSelect
      value={member.role}
      onChange={(role) => updateRole(member.userId, role)}
    />
  ) : (
    <span className="text-xs font-mono text-[var(--canvas-dark-ink-muted)]">{member.role}</span>
  )}
  {viewerIsOwner && member.role !== 'OWNER' && (
    <button onClick={() => confirmRemove(member.userId)} aria-label="Remove member">
      <X className="w-4 h-4 text-[var(--canvas-dark-ink-muted)] hover:text-[var(--destructive)]" />
    </button>
  )}
</div>
```

`RoleSelect` is a recessed `<select>`:

```tsx
<select
  value={value}
  onChange={(e) => onChange(e.target.value as HiveRole)}
  style={{
    background: 'var(--canvas-dark-100)',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-inset)',
    border: 'var(--br-card)',
    color: 'var(--canvas-dark-ink)',
  }}
  className="text-xs font-mono px-2 py-1 focus:outline-none"
>
  <option value="MODERATOR">Moderator</option>
  <option value="CONTRIBUTOR">Contributor</option>
  <option value="BETA_READER">Beta Reader</option>
</select>
```

OWNER role is non-editable.

- [ ] **Step 4: Remove member confirm**

Uses `ConfirmDialog` from `components/ui/confirm-dialog.tsx` — already styled via Dialog cascade. No changes.

- [ ] **Step 5: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `/hive/{hiveId}/members` as OWNER: invite link sub-panel + member rows with role dropdown + remove buttons. As non-OWNER: role is plain text, no remove buttons. Change a role → optimistic update + toast. Remove a member → confirm dialog → row disappears.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/members/page.tsx" "app/[locale]/(app)/hive/[hiveId]/_components/hive-members.tsx"
git commit -m "style(hive): T11 — members page + invite UI aesthetic refresh"
```

**Acceptance criteria:**
- Page: outer panel + brand-yellow heading.
- Invite link sub-panel: brand-yellow sub-heading + recessed link input + brand-yellow Copy CTA + member-count badge.
- Member rows: tile gradient + avatar + role dropdown (OWNER only) or plain text role (non-OWNER).
- Remove confirm inherits Dialog cascade.
- OWNER role non-editable.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 11 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the 2 members files. The pre-existing `/en/...` hardcode bug in `inviteLink` is documented in AGENTS.md as deferred — do NOT fix it in this presentational task. Remove confirm uses ConfirmDialog (already styled). Role dropdown only for OWNER. Run tsc + tests + visual check covering OWNER and non-OWNER views, then commit.

---

### Task 12: Settings page + Danger Zone + Coming Soon stubs

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/settings/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-settings-form.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/coming-soon.tsx`

**Surfaces changed:**
- Settings page → outer panel + brand-yellow heading "Settings"
- Settings form sections (name / description / visibility / discoverable) → each as a sub-panel (tile gradient + `--r-card` + `--sh-tile`), section labels in brand-yellow Comfortaa
- Name + description inputs → recessed (`var(--sh-inset)`)
- Visibility radio cards (Private / Friends / Public — already a 3-card picker from H1 T15) → tile gradient idle; active card gets `border: 2px solid var(--brand)` + brand-yellow icon + brand-yellow label
- Discoverable checkbox → custom checkbox; checked uses solid brand-yellow square + brand-ink check
- Save button → solid brand-yellow CTA
- Danger Zone section → sub-panel with `border: 1px solid color-mix(in oklch, var(--destructive) 30%, transparent)`, brand-destructive heading "Danger Zone", outline destructive Delete button. Delete uses ConfirmDialog (already styled).
- Non-OWNER inline message ("Only the owner can edit settings") → muted text on inset bg
- ComingSoon stub → outer panel with centered icon + brand-yellow "Coming in HX" label + muted body text

- [ ] **Step 1: Settings page outer panel**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-6"
>
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-6">
    Settings
  </h1>
  {viewerIsOwner ? <HiveSettingsForm ... /> : <NonOwnerMessage />}
</div>
```

- [ ] **Step 2: Form sections (sub-panels)**

In `hive-settings-form.tsx`, each section:

```tsx
<section
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }}
  className="p-5 mb-6"
>
  <h2 style={{ color: 'var(--brand)' }} className="font-comfortaa font-semibold text-sm mb-3">
    Name
  </h2>
  <input
    value={name}
    onChange={(e) => setName(e.target.value)}
    style={{
      background: 'var(--canvas-dark-100)',
      borderRadius: 'var(--r-row)',
      boxShadow: 'var(--sh-inset)',
      border: 'var(--br-card)',
      color: 'var(--canvas-dark-ink)',
    }}
    className="w-full px-3 py-2 text-sm font-geist focus:outline-none"
  />
</section>
```

Repeat for "Description" (textarea), "Visibility" (3-card picker), "Discoverable" (checkbox + helper text).

- [ ] **Step 3: Visibility 3-card picker**

```tsx
{(['PRIVATE', 'FRIENDS', 'PUBLIC'] as const).map((v) => {
  const isActive = visibility === v
  const Icon = v === 'PRIVATE' ? Lock : v === 'FRIENDS' ? Users : Globe
  return (
    <label
      key={v}
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
        border: isActive ? '2px solid var(--brand)' : 'var(--br-card)',
      }}
      className="flex flex-col items-start gap-2 p-4 cursor-pointer"
    >
      <input type="radio" name="visibility" value={v} checked={isActive} onChange={() => setVisibility(v)} className="sr-only" />
      <Icon className="w-5 h-5" style={{ color: isActive ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }} />
      <span style={{ color: isActive ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)' }} className="font-comfortaa font-semibold text-sm">
        {v[0] + v.slice(1).toLowerCase()}
      </span>
      <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
        {/* per-visibility blurb preserved */}
      </span>
    </label>
  )
})}
```

- [ ] **Step 4: Save button**

```tsx
<button
  type="submit"
  style={{
    background: 'var(--brand)',
    color: 'var(--brand-ink)',
    borderRadius: 'var(--r-btn)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="font-geist font-semibold text-sm px-4 py-2"
>
  Save changes
</button>
```

- [ ] **Step 5: Danger Zone**

```tsx
<section
  style={{
    background: 'color-mix(in oklch, var(--destructive) 5%, transparent)',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-tile)',
    border: '1px solid color-mix(in oklch, var(--destructive) 30%, transparent)',
  }}
  className="p-5 mt-8"
>
  <h2 style={{ color: 'var(--destructive)' }} className="font-comfortaa font-semibold text-sm mb-2">
    Danger Zone
  </h2>
  <p className="text-xs text-[var(--canvas-dark-ink-muted)] mb-4">
    Deleting this hive cannot be undone. All discussions, annotations, submissions, and word goals are permanently removed.
  </p>
  <button
    onClick={() => setDeleteOpen(true)}
    style={{
      color: 'var(--destructive)',
      borderRadius: 'var(--r-btn)',
      border: '1px solid color-mix(in oklch, var(--destructive) 40%, transparent)',
    }}
    className="font-geist font-semibold text-sm px-3 py-2 hover:bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)]"
  >
    Delete hive
  </button>
</section>
```

The `ConfirmDialog` for delete is already styled via Dialog cascade.

- [ ] **Step 6: Non-OWNER inline message**

```tsx
<p
  style={{
    background: 'var(--canvas-dark-100)',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-inset)',
  }}
  className="px-4 py-3 text-sm text-[var(--canvas-dark-ink-muted)]"
>
  Only the owner can edit hive settings.
</p>
```

- [ ] **Step 7: ComingSoon stub**

In `_components/coming-soon.tsx`:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="p-12 text-center"
>
  {Icon && <Icon className="w-10 h-10 mx-auto mb-4 text-[var(--canvas-dark-ink-muted)]" />}
  <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-xl mb-2">
    Coming in {phase}
  </h1>
  <p className="text-sm text-[var(--canvas-dark-ink-muted)] max-w-md mx-auto">
    {body}
  </p>
</div>
```

- [ ] **Step 8: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `/hive/{hiveId}/settings` as OWNER: form sections render as sub-panels with brand-yellow labels; visibility 3-card picker active card has brand-yellow border; Save brand-yellow CTA; Danger Zone destructive-tinted with outline Delete; ConfirmDialog opens cleanly. Non-OWNER: muted inline message on inset bg. If any future-deferred subroute is still using ComingSoon: confirm panel + brand-yellow heading.

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/settings/" "app/[locale]/(app)/hive/[hiveId]/_components/hive-settings-form.tsx" "app/[locale]/(app)/hive/[hiveId]/_components/coming-soon.tsx"
git commit -m "style(hive): T12 — settings + danger zone + coming-soon stub aesthetic refresh"
```

**Acceptance criteria:**
- Settings page outer panel + brand-yellow heading.
- Form sections as sub-panels with brand-yellow labels + recessed inputs.
- Visibility 3-card picker: active card brand-yellow border + brand-yellow icon/label.
- Discoverable checkbox: brand-yellow when checked.
- Save brand-yellow CTA.
- Danger Zone destructive-tinted with outline Delete + ConfirmDialog cascade.
- Non-OWNER inline message on inset.
- ComingSoon stub panel-styled with brand-yellow heading.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 12 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the 3 files. ConfirmDialog (delete) inherits Dialog cascade — no changes. Danger Zone uses `color-mix(in oklch, var(--destructive) ...)` for tinting. Visibility 3-card picker: active card has 2px brand-yellow border. Coming-Soon stub may still be referenced by any future-deferred subroute — re-skin it once. Run tsc + tests + visual check on OWNER + non-OWNER settings view + ComingSoon, then commit.

---

### Task 13: Hive invite accept page

**Files:**
- Modify: `app/[locale]/(app)/hive/invite/[token]/page.tsx`

**Surfaces changed:**
- Page → centered card on app backdrop, outer panel treatment
- Hive name → brand-yellow Comfortaa heading
- Inviter info ("Invited by @{username}") → mono muted
- Member-count progress (against `FREE_HIVE_MEMBER_LIMIT`) → recessed bar with brand-yellow fill
- Accept invite button → solid brand-yellow CTA
- Decline / Cancel link → muted text
- Invalid-token / expired-token / over-limit error states → each a panel variant (destructive-tinted for invalid; muted for over-limit) with appropriate copy and a "Back to studio" link

- [ ] **Step 1: Centered card**

```tsx
<main
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-150), var(--canvas-dark-100))',
  }}
  className="min-h-screen flex items-center justify-center p-4"
>
  <div
    style={{
      background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      borderRadius: 'var(--r-card)',
      boxShadow: 'var(--sh-card)',
      border: 'var(--br-card)',
    }}
    className="max-w-md w-full p-8 text-center"
  >
    {/* status-branch content */}
  </div>
</main>
```

- [ ] **Step 2: Happy-path content (valid token)**

```tsx
<HiveCrest /* unchanged */ />
<h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mt-4 mb-1">
  {hive.name}
</h1>
<p className="text-sm font-mono text-[var(--canvas-dark-ink-muted)] mb-6">
  Invited by @{inviter.username}
</p>
<div
  style={{
    background: 'var(--canvas-dark-100)',
    borderRadius: 'var(--r-pill)',
    boxShadow: 'var(--sh-inset)',
  }}
  className="h-2 mb-1 overflow-hidden"
>
  <div
    style={{ background: 'var(--brand)', width: `${(memberCount / limit) * 100}%`, borderRadius: 'var(--r-pill)' }}
    className="h-full"
  />
</div>
<p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mb-6">
  {memberCount} / {limit} members
</p>
<form action={acceptInvite}>
  <button
    type="submit"
    style={{
      background: 'var(--brand)',
      color: 'var(--brand-ink)',
      borderRadius: 'var(--r-btn)',
      boxShadow: 'var(--sh-tile)',
    }}
    className="w-full font-geist font-semibold text-sm py-2.5"
  >
    Accept invite
  </button>
</form>
<Link
  href={`/${locale}/studio`}
  className="block mt-3 text-xs font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]"
>
  Not now
</Link>
```

- [ ] **Step 3: Error states**

Invalid / expired token:

```tsx
<Lock className="w-10 h-10 mx-auto mb-4 text-[var(--destructive)]" />
<h1 style={{ color: 'var(--destructive)' }} className="font-comfortaa font-bold text-xl mb-2">
  Invite expired
</h1>
<p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-6">
  This invite link is no longer valid. Ask the owner for a fresh link.
</p>
<Link
  href={`/${locale}/studio`}
  style={{ color: 'var(--brand)' }}
  className="font-geist font-semibold text-sm"
>
  Back to studio →
</Link>
```

Over-limit (hive at `FREE_HIVE_MEMBER_LIMIT`):

```tsx
<Users className="w-10 h-10 mx-auto mb-4 text-[var(--canvas-dark-ink-muted)]" />
<h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-xl mb-2">
  Hive is full
</h1>
<p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-6">
  This hive has reached the free-tier member limit. Ask the owner to upgrade to Premium.
</p>
<Link
  href={`/${locale}/studio`}
  style={{ color: 'var(--brand)' }}
  className="font-geist font-semibold text-sm"
>
  Back to studio →
</Link>
```

- [ ] **Step 4: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Generate an invite link in `/hive/{hiveId}/members` (T11), open incognito, paste link, sign in, land on `/hive/invite/{token}`. Confirm: centered card on dark backdrop, brand-yellow hive name, recessed progress bar with brand-yellow fill, brand-yellow Accept CTA, muted "Not now" link. Manually craft an invalid token URL → invalid state renders.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/hive/invite/[token]/page.tsx"
git commit -m "style(hive): T13 — invite accept page aesthetic refresh"
```

**Acceptance criteria:**
- Centered card on app backdrop with outer panel treatment.
- Hive name brand-yellow Comfortaa.
- Inviter info mono muted.
- Member-count progress bar: brand-yellow fill on recessed track.
- Accept invite: solid brand-yellow CTA.
- "Not now" link muted with brand-yellow hover.
- Invalid / expired / over-limit error states each panel-styled with appropriate iconography and copy.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 13 of `docs/superpowers/plans/2026-06-01-hive-aesthetic-refresh.md`. Re-skin the single invite-accept file. Three state branches: happy-path (with accept CTA + progress bar), invalid/expired (destructive-tinted), over-limit (muted Users icon). All three live inside a centered card on the app backdrop. Run tsc + tests + visual check covering all three states, then commit.

---

### Task 14: Feature-integrity sweep

**Files:**
- None modified; this is a verification task.

**Surfaces verified:** every existing hive affordance per the H1-H4 design.

- [ ] **Step 1: Manual smoke walkthrough**

Open `/hive/{hiveId}/...` for a hive where the viewer is OWNER, and a separate hive where the viewer is BETA_READER. Walk through every item below — confirm each renders correctly AND is operable (click/type/drag actually does the thing):

- **Layout:** sidebar renders for every subroute; the 11 nav entries all clickable; active highlight switches as you navigate.
- **Dashboard:** welcome card + book card (or standalone fallback) render; book cover paper-warm preserved.
- **Wiki:** 3-tab view switch (By Category / By Folder / Notes). By Category: 14 categories visible (including CHARACTER as its own first-class type — appears via UNION per H2 T9). Expand a category, click an entry → entry editor opens; edit title → autosave fires; edit tags → tag chip strip works; edit body → ProseMirror saves on debounce. As BETA_READER: editor is read-only; footer message shown. By Folder: tree renders recursively; clicking a folder opens its renderer. Notes: flat grid; "+ New Note" creates a note.
- **Wiki entry creation:** "+ New Entry" → category picker modal opens (Dialog cascade); pick a non-CHARACTER category → new entry created with template content; lands in editor.
- **Outline:** acts render in groups; per-act and ungrouped "+ Add a beat" gated by role; drag beat between acts (CONTRIBUTOR+); rename act inline; "+ New Act" creates placeholder; chapter-link popover opens, search, pick chapter, save; standalone-hive variant shows correct popover message. BETA_READER: read-only footer + all controls disabled.
- **Chapters:** index lists chapters with status dot + word count; click → chapter view; cream paper sheet renders Newsreader prose unchanged byte-for-byte; collab gutter on the right side renders annotations + suggestions; back link returns to chapters.
- **Annotations bulk view:** grouped by chapter; "Jump →" link works; annotation card from editor T11 unchanged.
- **Suggestions bulk view:** grouped by chapter; suggestion card from editor T11 unchanged; accept / reject (MODERATOR+) work.
- **Submissions:** list shows PENDING/APPROVED/REJECTED rows; "+ New Submission" → composer; pick a chapter, diff renders, submit; row appears as PENDING; MODERATOR opens review → Approve / Reject; row transitions.
- **Discussions:** list shows posts; "+ New Discussion" → compose modal (Dialog cascade); submit → row appears; open thread → body card + reply list + reply composer; post a reply.
- **Word Goals:** active goals strip renders cards with brand-yellow progress; sub-panels Contributors / Recent Activity / History each show their data; "+ New Goal" modal opens (Dialog cascade); create goal; sidebar badge updates with new active goal.
- **Buzz Board:** feed of posts; like a post → heart fills brand-yellow + count increments; "+ New Post" → compose modal; submit text post → renders; submit with image → image embeds; submit with link → link card embeds; edit own post → edit modal.
- **Members:** OWNER sees invite link sub-panel + role dropdowns + remove buttons; non-OWNER sees plain text roles. Change a role → optimistic update + sonner toast. Remove a member → ConfirmDialog (Dialog cascade) → row disappears. Copy invite link → clipboard contains the URL.
- **Settings:** OWNER sees form sections + visibility 3-card picker (active card brand-yellow border) + discoverable checkbox + Save CTA. Toggle visibility ≠ PUBLIC → discoverable force-clears. Save → sonner toast. Danger Zone Delete → ConfirmDialog → on confirm, redirect to /studio.
- **Invite accept:** valid token shows happy-path card; over-limit shows full state; invalid token shows expired state.

- [ ] **Step 2: tsc + tests final pass**

```bash
npx tsc --noEmit
npm test
```

Expected: tsc clean, all tests passing.

- [ ] **Step 3: Performance eyeball**

Open the hive at large window size. Scroll the Buzz feed fast. Open the chapters index for a hive linked to a long book. If GPU paint jank is visible, drop the secondary shadow layer of `--sh-card` (the `0 2px 4px` line) globally — this is a token-level fallback per the editor refresh T14 precedent.

- [ ] **Step 4: No commit (verification task)**

This task produces no commit. If any issue is found, file it as a sub-task fix on the offending file from T1-T13 and commit there with `style(hive): T14 fix — <surface>`.

**Acceptance criteria:**
- Every affordance in the walkthrough works.
- Cream paper sheet inside hive chapter view unchanged byte-for-byte.
- Collab gutter (editor T9) integrates without visual collision inside the new hive chapter panel.
- tsc clean, all tests passing.

**Subagent dispatch:**
> Implement Task 14. Open a hive in `/hive/{hiveId}` in a dev server, walk the entire checklist from the plan. For every item, confirm both visual correctness AND functional behavior. Run tsc + tests. If any affordance is missing or broken, fix it by editing the offending file from T1-T13 (commit message `style(hive): T14 fix — <surface>`). Otherwise no commit.

---

### Task 15: AGENTS.md write-up + ship commit

**Files:**
- Modify: `AGENTS.md` (add a "What Has Been Built" entry for the hive aesthetic refresh; bump the Resume Here block).

**Surfaces changed:** none — docs only.

- [ ] **Step 1: AGENTS.md "What Has Been Built" entry**

Add after the "Editor Aesthetic Refresh" entry (chronological order). Structure (concrete content — engineer fills in commit SHAs from `git log`):

```markdown
### Hive Aesthetic Refresh ✅ COMPLETE (2026-06-01)

Sister pass to the Editor Aesthetic Refresh. Re-skins every hive chrome surface to the same warmer, cool-gray, iOS-modern stacked-depth aesthetic. Presentation-only — no DB, no feature changes, no IA changes, no new tokens. All existing tests stay green; tsc clean. Inherits the entire spec at `docs/superpowers/specs/2026-06-01-editor-aesthetic-refresh-design.md`.

- **Tokens unchanged:** the editor refresh's T1 already landed `--canvas-dark-150/250/350/400`, `--r-card/-row/-btn/-pill/-nav`, `--sh-card/-tile/-inset`, `--br-card`. This pass consumes them; no new globals.css edits.
- **Dialog primitive unchanged:** the editor refresh's T8 already re-skinned `components/ui/dialog.tsx` — every hive modal (CreateHiveModal, ConfirmDialog uses, DiscussionComposeModal, ComposeBuzzModal, EditBuzzModal, NewGoalModal, EditGoalModal, WikiCategoryPicker, plus delete confirms) inherits automatically.
- **Hive layout + sidebar** (`hive/[hiveId]/layout.tsx` + `_components/hive-sidebar.tsx`): app-backdrop gradient + sidebar panel + 11-entry nav (Dashboard / Outline / Wiki / Annotations / Discussions / Submit Chapter / Edit Suggestions / Word Goals / Buzz Board / Members / Settings). Active entry: gradient + tile shadow + brand-yellow icon — no left-stripe (per Chris's clarification; matches studio binder rule).
- **Dashboard** (`hive/[hiveId]/page.tsx`): welcome card + linked-book card (paper-warm cover preserved) + standalone fallback.
- **Wiki** (`hive/[hiveId]/wiki/*`): shell + 3-tab view switch + entry editor + folder renderer + entry card + category picker. Per-category `--wiki-{CATEGORY}` accents preserved as left-stripe / pill / tag accent. Scoped `[data-slot="wiki-entry-pane"] .ProseMirror` color rule preserved.
- **Outline** (`hive/[hiveId]/outline/*`): beat sheet surface with act groups + chapter-link popover (hive-cloned variant) + standalone-hive variant + BETA_READER read-only footer.
- **Chapters** (`hive/[hiveId]/chapters/*`): index + chapter view. Cream paper sheet inside chapter view preserved byte-for-byte; only the surrounding dark frame changes. Collab gutter (editor T9 styling) integrates cleanly.
- **Annotations + Suggestions bulk views** (`hive/[hiveId]/annotations/*` + `suggestions/*`): outer panel + per-chapter group headers + cards reused from editor T11 unchanged.
- **Submissions** (`hive/[hiveId]/submissions/*`): list + composer + review + read + shared diff renderer. Status pills preserved with `--status-{state}` tokens. Approve = solid brand-yellow; Reject = outline destructive.
- **Discussions** (`hive/[hiveId]/discussions/*`): list + thread + reply composer + compose modal (Dialog cascade).
- **Word Goals** (`hive/[hiveId]/word-goals/*` + sidebar badge): page + active goals strip + 3 sub-panels (Contributors / Recent Activity / History) + new/edit modals (Dialog cascade) + sidebar progress badge (re-skinned in T1 nav pass, completed in T9). Progress bars use brand-yellow fill on inset track.
- **Buzz Board** (`hive/[hiveId]/buzz/*`): feed + post card + link card + like button (muted idle, brand-yellow active) + compose/edit modals (Dialog cascade) + empty state.
- **Members** (`hive/[hiveId]/members/page.tsx` + `_components/hive-members.tsx`): invite link sub-panel (brand-yellow Copy CTA + recessed link input + member-count badge) + member rows with role dropdown (OWNER) or plain-text role (non-OWNER) + remove button (ConfirmDialog cascade).
- **Settings** (`hive/[hiveId]/settings/page.tsx` + `_components/hive-settings-form.tsx` + `_components/coming-soon.tsx`): form sections as sub-panels with brand-yellow labels + recessed inputs + 3-card visibility picker + discoverable checkbox + Save brand-yellow + Danger Zone (destructive-tinted) + ComingSoon stub re-skinned for any future-deferred subroute.
- **Invite accept** (`hive/invite/[token]/page.tsx`): centered card on backdrop with three state branches (valid → accept; invalid/expired → destructive; over-limit → muted Users).

**Pattern note for future hive surfaces:** every hive page is one of three shells — list / detail / form. All three use the outer-panel treatment from the editor refresh's spec: `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))` + `--r-card` + `--sh-card` + `--br-card`. Inset tiles inside (rows, cards, sub-panels) use `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `--r-row` (or `--r-card` for sub-panels) + `--sh-tile`. Inputs use `var(--canvas-dark-100)` + `--sh-inset`. Headings in chrome use `color: var(--brand)`. The cream paper sheet inside the hive chapter view is the only place cream paper appears in hive routes; it is never restyled by chrome rules.

**Brand-yellow usage map in hive (sanctioned uses):** chrome headings, active sidebar nav entry icon, active wiki view-switch tab, active visibility picker card border, "+ New Entry" / "+ New Submission" / "+ New Discussion" / "+ New Goal" / "+ New Post" triggers, "Go to Hive" footer text in studio binder, Approve submission CTA, Save settings CTA, Accept invite CTA, Post Reply / Post Buzz CTA, Copy invite link CTA, like-button active heart + count, word-goals progress fill, sidebar word-goals badge title + fill, BACK-link hover, error-state "Back to studio" link, invite-accept member-count progress fill.

**Out of scope (deferred):** Light-mode chrome variant. Auth pages, landing page, /community, /discover, /settings (untouched unless they share a re-skinned primitive like `dialog.tsx`).
```

- [ ] **Step 2: Bump the Resume Here block**

Update the top of AGENTS.md `Resume Here`:
- `Last updated:` → `2026-06-01`
- `Current focus:` → mention the hive aesthetic refresh complete; both editor + hive routes now share the new aesthetic. Next: TBD (pick from existing candidates).
- `Last commit:` → `style(hive): T15 — hive aesthetic refresh ship`
- `Next concrete step:` → "Both the editor and hive aesthetic refreshes have shipped — the cool-gray stacked-depth aesthetic is now app-wide for the writing + collaboration surfaces. Pick the next priority from the existing candidate list (H3 follow-up if any, H4 polish, Phase 9 monetization polish, Stripe dashboard webhook config, /settings index page, SP-B Friendships, etc.)."

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "style(hive): T15 — hive aesthetic refresh ship + AGENTS.md write-up"
```

- [ ] **Step 4: Optional push**

If Chris asked to push to GitHub:

```bash
git push origin main
```

**Acceptance criteria:**
- AGENTS.md gains a "What Has Been Built" entry with token-reuse note, file list, pattern note, brand-yellow usage map.
- Resume Here block bumped.
- Final ship commit landed on `main`.

**Subagent dispatch:**
> Implement Task 15. Update AGENTS.md with the "What Has Been Built" entry (use the structure in the plan) and bump the Resume Here block. Commit. Do not push unless Chris explicitly asks.

---

## Self-Review Notes

**Spec coverage:** Every spec section maps to a task in this hive plan:
- Tokens / radius / depth / shadows → inherited from editor T1 (no new tokens, called out in Pre-flight A and T15 docs).
- App nav → already done in editor T2 (the app nav is shared across (app) routes).
- Hive layout shell + sidebar → T1.
- Dashboard → T2.
- Wiki shell + entry editor + folder renderer + category picker → T3.
- Outline → T4.
- Chapter view (with preserved cream prose) → T5.
- Annotations / Suggestions bulk views → T6.
- Submissions list + composer + review + read → T7.
- Discussions list + thread + compose → T8.
- Word Goals page + sidebar badge + modals → T9.
- Buzz Board feed + compose + like → T10.
- Members + invite link → T11.
- Settings + Danger Zone + Coming Soon → T12.
- Invite accept page → T13.
- Feature-integrity sweep → T14.
- Docs + ship → T15.

**Placeholder scan:** every task has concrete CSS values, exact file paths, runnable commands, commit messages. No "TBD", "etc.", "and so on" left as load-bearing.

**Type / token consistency:** All gradient pairs reference declared tokens; all radii reference `--r-card / -row / -btn / -pill / -nav`; all shadows reference `--sh-card / -tile / -inset`; all hairline borders reference `--br-card`; all brand-yellow uses match the spec's restraint map.

**Cream paper preservation:** Explicitly re-stated in T5 (hive chapter view) — the only cream paper surface in the hive route tree. No other task touches cream paper.

**Dialog primitive cascade:** Explicitly re-stated in T3 (WikiCategoryPicker), T8 (DiscussionComposeModal), T9 (NewGoalModal / EditGoalModal), T10 (ComposeBuzzModal / EditBuzzModal), T11 (remove member ConfirmDialog), T12 (delete hive ConfirmDialog). Six tasks call out the same "Dialog already styled — do not re-skin" rule.

**Collab gutter reuse:** Explicitly re-stated in T5 (chapter view) and T6 (annotations / suggestions cards). Editor T9 / T11 already handled these — this plan only verifies integration.

**Feature preservation:** T14 walks the full feature checklist. T1 enumerates all 11 sidebar nav entries. T3 enumerates the 14 wiki categories. T9 documents the goal-page sub-panels. T11 documents both OWNER and non-OWNER member-row variants. T12 documents the 3-card visibility picker and Danger Zone.
