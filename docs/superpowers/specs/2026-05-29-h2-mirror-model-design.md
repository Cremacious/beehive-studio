# H2 — Mirror Model: Binder ↔ Hive Wiki / Outline / Notes

**Status:** Draft
**Date:** 2026-05-29
**Sub-project:** H2 of 5 (Hives redesign)
**Predecessors:** H1 (foundation — must ship first)
**Successors:** H3 (collaboration core), H4 (motivation), H5 (dashboard)

---

## Context

H1 establishes that hives are book-centric collaboration spaces. H2 makes the wiki, outline, and notes inside a hive be **the same data** as the wiki, outline, and notes in the book editor's binder — not two copies kept in sync.

The reference implementation at `beehive-books-online` has its own wiki tables (14 categories with tags), hierarchical outline items, etc. Studio currently has separate `hive_wiki_pages` and `hive_outlines` tables that don't connect to the editor binder at all. This spec makes one canonical home (`binderItems`) and reshapes both surfaces to be views over the same rows.

The editor side also gains the 13 new wiki categories (CHARACTER already exists as its own binder type), per-category templates, tags, and act-grouping on outline beats.

## Goals

- Wiki entries, outline beats, and research notes live in **one place**: `binderItems`. The hive wiki page is a view, the editor binder is a view, and edits from either side write to the same row.
- The editor's "+ Add" menu can create wiki entries in all 14 categories (existing `character` type preserved; 13 new categories under one `wiki_entry` type with a `category` field).
- Wiki entries support tags (max 10) and per-category template body seeding.
- Outline beats gain an optional `act` field for grouping; existing flat beat sheet UI extends to render groups.
- Standalone hives work via an invisible shadow `books` row, so the single-source-of-truth model holds without exceptions.
- Permissions: BETA_READER read-only on wiki/outline/notes; CONTRIBUTOR+ writable; chapters / parts / front-matter / back-matter remain author-only writes (chapter changes go through H3's submission/suggestion flow).
- The Hive Wiki page offers two organizational lenses (By Category / By Folder) plus a Notes view; folder lens mirrors the author's binder organization.

## Non-goals

- Live multi-user editing (cursors, OT, CRDTs). Last-write-wins; snapshot/restore is the recovery path.
- Inline annotations / submissions / suggestions on chapters → H3.
- Discussions, milestones, word goals, buzz board → H3/H4.
- A specialized timeline visualization for the TIMELINE category. Ships as a templated wiki entry like the others; richer UI is a future-state idea.
- Removing the existing `character` binder type. It stays as its own first-class type because of its specialized renderer (avatar, relationships). It appears in the Hive Wiki under the CHARACTER category via UNION at query time.

---

## Data Model

### `binder_item_type` enum gains two values

```sql
ALTER TYPE binder_item_type ADD VALUE 'wiki_entry';
ALTER TYPE binder_item_type ADD VALUE 'wiki_folder';
```

### `binderItems.content` shapes

```ts
// New: wiki_entry
type WikiEntryContent = {
  category: 'CHARACTER' | 'LOCATION' | 'LORE' | 'PLOT' | 'ARTIFACT'
          | 'FACTION' | 'CULTURE' | 'LANGUAGE' | 'BIOLOGY' | 'THEME'
          | 'ECONOMY' | 'TERMINOLOGY' | 'TIMELINE' | 'OTHER'
  body: TipTapJSON          // rich text; per-category template seeded at create
  tags: string[]            // max 10, lowercase, deduped
}

// New: wiki_folder
type WikiFolderContent = {
  description?: string
}

// Existing: outline (extended)
type OutlineContent = {
  beats: Array<{
    id: string
    title: string
    synopsis?: string
    status?: 'idea' | 'drafting' | 'done'
    linkedChapterId?: string
    act?: string            // NEW; freeform string, null/undefined = ungrouped
  }>
}

// Existing: character (extended)
type CharacterContent = {
  // ... existing fields ...
  tags?: string[]           // NEW; same constraints as WikiEntryContent.tags
}
```

### Per-category templates

Pure constants in **`lib/wiki/category-templates.ts`**:

```ts
type CategoryTemplate = {
  category: WikiEntryContent['category']
  label: string             // "Location", "Lore", etc.
  blurb: string             // one-line description shown in category picker
  icon: LucideIcon
  accentColor: string       // CSS variable name, e.g. '--wiki-location'
  defaultBody: TipTapJSON   // seeded into body on create
}
```

Categories ported from beehive-books-online's `hive-wiki.tsx` (lines 51–86). One template per category. The icon, accent color, and blurb drive both the editor's category picker UI and the Hive Wiki page's section headers.

### Drop tables (no longer used)

- `hive_wiki_pages` — content moves to `binderItems` of type `wiki_entry`
- `hive_outlines` — content moves to the existing `outline` `binderItems` row

### Shadow books for standalone hives

H1 introduced standalone hives with `hives.bookId` nullable + partial UNIQUE. H2 tightens this:

```sql
ALTER TYPE book_status ADD VALUE 'STANDALONE_HIVE_SHADOW';
-- (data backfill, see Migration Plan)
ALTER TABLE hives ALTER COLUMN book_id SET NOT NULL;
DROP INDEX hives_book_id_unique;     -- partial index from H1
ALTER TABLE hives ADD CONSTRAINT hives_book_id_unique UNIQUE (book_id);
```

Standalone-hive creation in H1's `createHiveAction` is reshaped: when `bookId` is omitted, the action first creates a `books` row with `status = 'STANDALONE_HIVE_SHADOW'`, `userId = ownerId`, `title = hive.name`, `visibility = 'PRIVATE'`, `discoverable = false`, then creates the hive pointed at that shadow.

**New helper `scopedBooksForUser(userId)`** in `lib/books/scoped.ts` — replaces every raw `books WHERE userId =` query in /studio surfaces. Always adds `AND status != 'STANDALONE_HIVE_SHADOW'`. Codemod audit: book-actions, library-actions, studio-stats-action, continue-writing query, by-series clustering, profile-page books query. Expected ~12 call sites.

### Permission helper (extends H1's `lib/hive/permissions.ts`)

```ts
requireBinderWritePermission(bookId, binderItemId, userId): Promise<void>
// Author of book → always passes.
// Else: look up hives.bookId, find hiveMembers row, branch on item type:
//   chapter | part | front_matter | back_matter           → throw NOT_AUTHORIZED
//   wiki_entry | wiki_folder | character                  → require canEditWiki(role)
//   outline                                               → require canEditOutline(role)
//   research_note | research_folder                       → require canEditWiki(role)
// Both fail → throw NOT_AUTHORIZED.
```

Truth table tested in unit (5 actor types × 10 item types = 50 cases).

### Indexes

```sql
-- Hive views need to query by (bookId, type) frequently
CREATE INDEX binder_items_book_type_idx ON binder_items(book_id, type);
```

---

## Editor Changes

### Binder "+ Add" menu — grouped layout

`binder-add-menu.tsx` restructured:

```
─────── MANUSCRIPT ───────
  Chapter
  Part (collection)
  Front Matter
  Back Matter

─────── WORLDBUILDING ────
  Character          (existing)
  Wiki Entry         ▸
  Wiki Folder

─────── PLANNING ─────────
  Outline
  Research Note
  Research Folder
```

### "Wiki Entry ▸" → 14-card category picker

Click "Wiki Entry" → opens a modal (not a flyout — too much content for a popover) with a 4-column grid of category cards (3 full rows + 1 row of 2):

- Each card: category icon + name + one-line blurb (from `lib/wiki/category-templates.ts`)
- Hover: brand-yellow ring
- Click: creates a new `wiki_entry` binderItem with the category's template body pre-seeded; modal closes; new entry opens in the editor

### `WikiEntryEditor` (new) — `_components/editor/wiki-entry-editor.tsx`

- Sheet-style layout matching the redesigned Character profile's chrome (theme-aware paper-ink)
- Header card: title (contenteditable) · category pill (template accent color) · tag chips with Plus button → inline tag input (max 10)
- Body: TipTap mini-editor (StarterKit + bold/italic/heading2/bulletList/blockquote) — same dependency surface used by FM/BM specialized editors
- Save-status badge in breadcrumb head (matches Character pattern)
- Renders in the same `chapter-editor.tsx` render-branch slot as Character/Outline/Notes

### Wiki Folder renderer

- Editable title + optional description + a "What's inside" list of child entries (linked previews jumping to the entry)
- Structurally equivalent to `research_folder`

### Outline editor — act grouping addition

The DP3 vertical sortable beat-sheet gains:

- A header strip above the beat list: per-act header (`<input placeholder="Act 1">`) plus a "+ New Act" button at the end
- Beats sortable within and across acts (drag a beat between act headers)
- Ungrouped beats (`act === null | undefined`) appear in a collapsible "No Act" group at the top, only rendered if any exist
- `act` field is a freeform string; auto-completes from existing act values on the same outline
- Existing beat status pills + chapter linking unchanged
- Render-time grouping (`groupBeatsByAct(beats)` pure helper) — no schema change beyond the new field

### Character page

- Renderer unchanged in structure
- Gains a tag chip strip under the name header, using the same tag system + UI as wiki_entry

### Research Note / Research Folder

- Unchanged shapes
- Surfaced on the hive side under the "Notes" tab of the Hive Wiki page

---

## Hive Surfaces

### `/hive/[hiveId]/wiki`

**Page chrome:**
- Header: "Wiki" title · search input (filters across all entries by title / tag / body text) · "+ New Entry" button (opens the 14-card category picker; hidden if `!canEditWiki(role)`)
- View-mode toggle: **By Category** (default) · **By Folder** · **Notes**

**By Category view:**
- 14 collapsible sections (template-map order)
- Section header: category icon + name + entry count + collapse caret
- Empty categories: muted "+ Add a {category}" link inline (hidden if read-only)
- Entry card: title · first-line excerpt · tag chips · author avatar · last-edited relative time
- Click → opens entry in `HiveWikiEntryEditor` (wraps the editor's `WikiEntryEditor` with hive chrome: hive-side save status, role-gated read/write mode, "Last edited by @user 5m ago" line)
- Folder structure **not shown** in this view

**By Folder view:**
- Mirrors the binder tree: `wiki_folder` → collapsible group, `wiki_entry` → card underneath
- Character entries appear wherever the author placed them
- Same card → editor pattern as By Category
- Folder-only nodes show entry count

**Notes view:**
- Flat grid of all `research_note` items; pinned first, then by last-edited
- Pin/color/favorite metadata preserved
- Same card → editor pattern
- "+ New Note" button shown when `canEditWiki(role)`

**Read-only mode (BETA_READER):**
- All "+ New" buttons hidden
- Card hover doesn't show edit affordance
- Opened entries: TipTap `editable={false}`, no save badge, footer "Read-only — your role is Beta Reader"

### `/hive/[hiveId]/outline`

- Single render of the book's `outline`-type binderItem
- Same `OutlineBeatSheet` component the editor uses, wrapped in `HiveOutlineSurface` for chrome + save-status + role gate
- Act grouping, beat sortable, status pill, chapter linking work identically to the editor
- Gated for writes by `canEditOutline(role)` — BETA_READER read-only, CONTRIBUTOR+ can edit
- "Last edited by @user 12m ago" header line
- Standalone hive's shadow book → outline still works, just has no chapters to link beats to (chapter picker empty state: "Standalone hive — no chapters")

### Runtime mirror semantics

- Both the editor and the hive UI hit the same `binderItems` row via the same `saveBinderItemAction`
- Last write wins; no operational transform or CRDTs
- Save badges on both surfaces reflect latest server state on their next auto-save tick
- Snapshot/restore (premium feature) is the recovery path for accidental overwrites

### New server actions

| Action                          | File                                       | Purpose                                                |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `getHiveWikiView(hiveId)`       | `lib/actions/hive-content.actions.ts`      | Joins hive → book → binderItems; returns category-grouped + folder-tree views in one shot |
| `getHiveOutlineView(hiveId)`    | same                                       | Returns the single `outline` binderItem + book metadata |
| `getHiveNotesView(hiveId)`      | same                                       | Returns all `research_note` binderItems for the book   |

### Deleted server actions

- `getWikiPagesAction` / `createWikiPageAction` / `getWikiPageAction` / `saveWikiPageAction` / `deleteWikiPageAction` (hive_wiki_pages CRUD)
- `getHiveOutlineAction` / `saveHiveOutlineAction` (hive_outlines CRUD)

Callers use `createBinderItemAction` / `updateBinderItemAction` / `deleteBinderItemAction` with the appropriate `type` value.

### Modified server actions

- `createBinderItemAction`, `updateBinderItemAction`, `deleteBinderItemAction`, `reorderBinderItemsAction`: permission check `assertBookOwner` → `requireBinderWritePermission`
- `getBinderTreeAction`: projection extended with `category`, `tags`, `authorId` for hive-view callers
- `createHiveAction` (from H1): reshaped — standalone path creates the shadow book first

---

## Migration Plan

Single migration file: `db/migrations/0xxx_h2_mirror_model.sql` + runner `scripts/db/apply-h2-migration.ts` (drizzle-kit push requires TTY per AGENTS.md).

**Steps the runner performs in order:**

1. **Add enum values:** `wiki_entry`, `wiki_folder` on `binder_item_type`; `STANDALONE_HIVE_SHADOW` on `book_status`.
2. **Backfill shadow books for pre-H2 standalone hives:** for every `hives` row WHERE `book_id IS NULL`, create a `books` row (shadow), then update the hive's `book_id` to point at it. (Expected: zero rows in dev; defensive.)
3. **Tighten hive FK:** `hives.book_id` → `NOT NULL`; drop partial unique index from H1; add plain UNIQUE constraint.
4. **Port `hive_wiki_pages` → `binder_items`:** for each row, create a `wiki_entry` binderItem (`category = 'OTHER'`, body = TipTap wrap of existing text, `tags = []`), parented under a new auto-created `wiki_folder` named "Imported from old wiki" at the binder root. Carry over `createdBy` / `updatedBy` / timestamps.
5. **Port `hive_outlines` → `binder_items`:** for each row, find the book's `outline` binderItem (create if missing), append the legacy text as a single synopsis-bearing beat under a "Imported" act.
6. **Drop replaced tables:** `hive_wiki_pages`, `hive_outlines`.
7. **Add `binder_items(book_id, type)` index.**
8. **Log counts:** new wiki_entries, new shadow books, hive_wiki_pages ported, hive_outlines ported.

**Codemod required:** every `/studio` query that filters books by user → `scopedBooksForUser(userId)`. Expected ~12 call sites.

---

## Test Plan

**Unit (vitest):**
- `requireBinderWritePermission` truth-table (5 actor types × 10 item types) = 50 cases
- Category template seed: creating a wiki_entry pre-seeds the right TipTap body for each of 14 categories
- Tag handling: dedupe, lowercase, cap at 10
- Act-grouping: `groupBeatsByAct(beats)` pure helper

**Action:**
- `createBinderItemAction` with new types (wiki_entry, wiki_folder)
- Permission denied paths for each role × disallowed item type
- `createHiveAction` standalone path: creates shadow book first, then hive points at it

**Manual smoke (per Chris's per-task verification preference):**
1. Create a wiki entry of category LOCATION in the editor → appears in the hive's By Category view under Location.
2. CONTRIBUTOR edits a wiki entry from the hive → reflects in the editor on next refresh.
3. BETA_READER opens any wiki entry from the hive → read-only mode visible (no save badge, footer message).
4. Create a standalone hive → shadow book exists in DB but does NOT appear in /studio.
5. By Folder view renders the binder tree faithfully (folder + entries the author placed in folders).
6. Outline beats can be grouped into Acts; drag-reorder across acts persists.
7. Delete the book → cascades the hive AND all its wiki entries (via FK).
8. Search bar in Hive Wiki finds entries by title, tag, and body text.

---

## Risks & Trade-offs

- **No live collab.** Two writers stomping each other → last write wins. Snapshot/restore is the recovery. Accepted for v1.
- **Shadow books are invisible but real.** Future devs need to know about the `scopedBooksForUser` rule. Documented in AGENTS.md Key Patterns after H2 ships.
- **Enum additions are irreversible** (`wiki_entry`, `wiki_folder`, `STANDALONE_HIVE_SHADOW`). Accepted.
- **`binder_items` table grows wider in usage.** Read patterns now include the hive side. The new `(book_id, type)` index keeps hive wiki queries cheap.
- **Existing `character` type stays its own thing.** Slight asymmetry — Character has a specialized renderer; the other 13 categories share `WikiEntryEditor`. Keeps the Character UX that already shipped; future work can absorb Character into the generic renderer if desired.

---

## Out of Scope (Explicit)

- Inline annotations on chapters → H3
- Submit Chapter / Edit Suggestions → H3
- Discussions → H3
- Word Goals / Per-user word logs → H4
- Bee-themed milestones → H4
- Buzz Board → H4
- Dashboard aggregation → H5
- Real-time multi-user editing (cursors / OT / CRDTs) → not in scope for the redesign cycle
- A specialized TIMELINE category visualization → future state; ships as templated text in H2
- Merging Character into the generic wiki_entry type → future state
