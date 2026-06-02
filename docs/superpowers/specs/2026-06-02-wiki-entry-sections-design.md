# Wiki Entry Sections — Design Spec

**Date:** 2026-06-02
**Scope:** Restructure the wiki entry body from a single TipTap doc → an ordered list of labeled sections. Per-section editable label + per-section text area, plus add/remove. Applies to both the studio wiki entry editor and the hive wiki entry editor (mirror). Pure UI-level change; downstream consumers (excerpt, search, card render) bridge old and new shapes transparently. No DB schema change.

## Why

The current single-TipTap-doc body uses H2 headings as visual section dividers (`Geography`, `Notable features`, `Inhabitants` etc., seeded by the category template). Chris found this confusing because the H2 prompts read like static labels but they're actually editable prose — there's no way for the user to tell they're "fields" they should fill in below. A user types directly underneath them and ends up with one giant text blob.

Reframing: turn each H2 into an **explicit editable label** and each between-headings region into its own **distinct text-area card**. Users get an obvious "fill in this section" affordance, plus the ability to rename labels, delete sections, and add new ones.

Approved mockup: `.superpowers/brainstorm/36328-1780415224/content/sections.html`.

## Data shape

### Old (current)

```ts
content = {
  category: WikiCategory,
  body: TipTapDoc,   // single doc with H2s + paragraphs
  tags: string[],
}
```

### New

```ts
content = {
  category: WikiCategory,
  sections: Array<{
    id: string,      // stable id for React keys + reorder safety
    label: string,   // plain text, user-editable
    body: TipTapDoc, // per-section TipTap doc (no headings inside — paragraphs / strong / em / lists / blockquote only)
  }>,
  tags: string[],
}
```

Stored under the same `binderItems.content` jsonb column. No DB migration. The `category` and `tags` fields are unchanged.

## Migration (lazy, on read)

Existing entries on disk have `content.body` (TipTap doc). The editor's `readContent` helper migrates to `sections` in-memory on mount:

```
readContent(raw) -> { category, sections, tags }
```

Algorithm for `body → sections`:

1. If `content.sections` already present (non-empty array), use it directly.
2. Else walk `content.body.content` (top-level nodes of the TipTap doc):
   - Maintain a `current` section (initially `null`).
   - When a `heading` node with `level === 2` is seen, flush `current` into the result and start a fresh `current` with `label = text-of-heading`, `body = empty-doc`.
   - All other top-level nodes (paragraph, bulletList, orderedList, blockquote, horizontalRule) get appended into `current.body.content`. If `current` is still `null` (no leading H2), create a section with `label = 'Notes'` and append into it.
3. If after the walk the doc was empty OR had no nodes, return one default section `{ label: 'Notes', body: empty }`.
4. Drop H3+ headings (rare — turn into bold paragraphs at the same level so prose isn't lost).

Migration is in-memory only. The new `sections` shape is written back to disk on the first save (debounced 800ms after a user edit). Old `body` is dropped from the saved content. Entries the user never opens stay as `body` on disk indefinitely — the excerpt helper handles both shapes.

## Category templates (seed)

`lib/wiki/category-templates.ts` keeps its existing structure but adds a `defaultSectionLabels: string[]` alongside `defaultBody`. The 14 templates each get the H2 strings extracted into the array (e.g., Character → `['Appearance', 'Personality', 'Role in story']`; Location → `['Geography', 'Notable features', 'Inhabitants']`).

Create-new-entry flow (in `binder-add-menu.tsx` + `hive-wiki-shell.tsx`) seeds the new entry with:

```ts
content: {
  category,
  sections: defaultSectionLabels.map((label, i) => ({
    id: `s_${createId()}_${i}`,
    label,
    body: { type: 'doc', content: [{ type: 'paragraph' }] },
  })),
  tags: [],
}
```

Empty per-section body so the section's placeholder shows on first render.

`defaultBody` stays on the template type for back-compat (any code outside this surface that depends on it) but the create flow no longer uses it.

## UI

### Studio surface — `wiki-entry-editor.tsx`

Re-uses the existing pane chrome and the iOS-Settings-detail hero (centered title + chips). The body region drops the single `wiki-body` card and renders an array of `<WikiSection>` components below the `Body` label row, followed by a dashed `+ Add section` button.

```
┌─ pane (gradient, --canvas-dark-250 → -200) ──────────────────┐
│  Wiki ▸ Location                    ○ Saved · 9:47 AM        │
│                                                              │
│                       New Location                           │ ← title
│                  [◐ Location]  [+ tag]                       │ ← chips
│                                                              │
│   BODY                                                       │ ← label row
│                                                              │
│   GEOGRAPHY (label, brand-yellow, hover-edit)        × remove│
│   ┌────────────────────────────────────────────────────────┐ │
│   │ A river city built on three concentric stone walls…    │ │ ← section body card
│   └────────────────────────────────────────────────────────┘ │
│                                                              │
│   NOTABLE FEATURES                                   × remove│
│   ┌────────────────────────────────────────────────────────┐ │
│   │ What makes it visually or culturally distinct…         │ │ ← italic muted placeholder
│   └────────────────────────────────────────────────────────┘ │
│                                                              │
│   INHABITANTS                                        × remove│
│   ┌────────────────────────────────────────────────────────┐ │
│   │ Who lives here and why it matters…                     │ │
│   └────────────────────────────────────────────────────────┘ │
│                                                              │
│   ┌── + Add section ────────────────────────────────────────┐│
│   └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### `<WikiSection>` child component (new)

Owns its own TipTap editor instance. Props:

```ts
{
  section: { id, label, body },
  readOnly: boolean,
  onChange: (next: { id, label, body }) => void,
  onRemove: () => void,
}
```

Internals:
- `useEditor` keyed on `section.id`, single-line StarterKit minus headings (heading level config: `[]` to disable H1/H2/H3 inside a section), plus Placeholder extension with a per-section placeholder `"What makes it visually or culturally distinct…"` (or whatever the template provided — see "Per-section placeholder copy" below).
- Label is a contenteditable `<span>` styled brand-yellow mono uppercase tracking-wider; hover background + 1px subtle border to signal editability. On `onBlur`, calls `onChange` with new label.
- Body card uses the same raised-tile chrome shipped in the prior round (`--canvas-dark-350 → -300` gradient, `oklch(1 0 0 / 0.40)` border, `--sh-tile`, `--r-row`-ish 14px radius). Inline `style={{}}` props for the border + bg so they survive any cascade quirks.
- `× remove` button in the section's head row, opacity 0 by default, opacity 1 on `:hover` of the section root. Click → `onRemove()`.
- onUpdate handler debounces upward — parent collects all section changes and saves the whole `content` 800ms after the last edit.

### Per-section placeholder copy

For sections created from the category template, the placeholder text mirrors the prompt that used to live in the H2 hint paragraph (e.g., for Location → Geography, the hint was "Where it sits in the world." — becomes the placeholder).

Each `CategoryTemplate` gains a parallel `defaultSectionHints: string[]` aligned with `defaultSectionLabels`. Hints are passed into the seeded sections' Placeholder extension config.

For new user-added sections (via + Add section), the placeholder is the generic `"Add some notes…"`.

For migrated old entries, the placeholder is `"Add some notes…"` (we don't know the original intent).

### + Add section

Dashed-border button at the bottom. Click:
- Append `{ id: createId(), label: 'New section', body: empty-doc }` to the sections array.
- Auto-focus the new section's label (contenteditable) and select all for immediate rename.

### × Remove section

Visible on hover. Click → no confirm dialog (the user can re-add). If only one section remains, hide the remove button (entries can't be empty — the body card still needs to exist).

### Save flow

- `scheduleSave` is unchanged shape-wise. The whole `content` object (including the sections array) is sent to `updateBinderItemAction` 800ms after the last edit.
- `setStatus('unsaved')` immediately on any change (label edit, body edit, section add, section remove).
- `setStatus('saving')` while the action is in flight.
- `setStatus('saved')` on success.

### Read-only mode (BETA_READER)

- Labels render as plain text (no contenteditable).
- Each section's TipTap editor is `editable: false`.
- `+ Add section` and `× remove` are hidden.
- Empty sections render their body card with the placeholder visible — fine, signals "this section was never filled in."

## Hive mirror — `hive-wiki-entry-editor.tsx`

Identical visual structure to the studio. Same `<WikiSection>` component (live in the studio components folder, imported from the hive editor — that's the existing cross-import pattern for `TagChipStrip` and `SaveStatusBadge`).

Hive variant keeps the top bar's back button + "Edited by @x · 5m ago" line + save badge. No other differences.

## Downstream consumers (bridge old + new shape)

### Excerpt — `lib/actions/hive-content.actions.ts`

The current line is:
```ts
excerpt: tipTapToPlain(content.body, 120),
```

Change to:
```ts
excerpt: extractWikiExcerpt(content, 120),
```

New helper in `lib/wiki/excerpt.ts`:

```ts
import { tipTapToPlain } from '@/lib/tiptap-utils'

export function extractWikiExcerpt(content: unknown, maxLen: number): string {
  if (!content || typeof content !== 'object') return ''
  const c = content as { sections?: Array<{ label: string; body: unknown }>; body?: unknown }
  if (Array.isArray(c.sections)) {
    // New shape — join "label: body-plain-text" for each non-empty section
    const parts: string[] = []
    for (const s of c.sections) {
      const text = tipTapToPlain(s.body, maxLen).trim()
      if (!text) continue
      parts.push(`${s.label}: ${text}`)
      if (parts.join(' · ').length >= maxLen) break
    }
    const joined = parts.join(' · ')
    return joined.length <= maxLen ? joined : joined.slice(0, maxLen).trimEnd() + '…'
  }
  // Legacy shape — fall through to the old behavior
  return tipTapToPlain(c.body, maxLen)
}
```

Net effect: cards show "Geography: A river city built on three concentric stone walls…" instead of just "A river city built on three concentric stone walls…". Slightly more informative, search-friendly (section name matches).

### Search — `hive-wiki-shell.tsx` `matchesSearch`

Already matches on `entry.excerpt`. With the new helper folding labels into the excerpt, "geography" search hits any entry that has a Geography section. No code change needed in the matcher.

### Public reader

Wiki entries don't have a public reader surface (they're internal/hive-only). Not affected.

### Word count

Wiki entries don't drive word goals or chapter-status word counts. Not affected.

## Files to touch

1. **`lib/wiki/category-templates.ts`** — add `defaultSectionLabels: string[]` + `defaultSectionHints: string[]` to each of 14 templates. Keep `defaultBody` for back-compat.
2. **`lib/wiki/excerpt.ts`** *(new)* — `extractWikiExcerpt(content, maxLen)` helper.
3. **`lib/actions/hive-content.actions.ts`** — swap the `tipTapToPlain(content.body, 120)` call to `extractWikiExcerpt(content, 120)`.
4. **`app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-section.tsx`** *(new)* — the `<WikiSection>` component (label + body card + remove).
5. **`app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-entry-editor.tsx`** — rebuild around sections. Drop the single TipTap doc + EditorContent body card.
6. **`app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-entry-editor.tsx`** — mirror.
7. **`app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx`** — seed new entries with sections-shape content.
8. **`app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-shell.tsx`** — same seeding change.

No DB / schema / migration script. No public reader / serializer change.

## Risk + verification

- **Migration robustness:** the `body → sections` walker must handle weird shapes (no H2s, only H2s no paragraphs, nested marks, empty doc, missing content array). Unit tests in `lib/wiki/__tests__/migrate-body-to-sections.test.ts` cover these cases.
- **Excerpt back-compat:** existing entries display correctly via the legacy branch of `extractWikiExcerpt`. Tested via `lib/wiki/__tests__/excerpt.test.ts`.
- **No DB schema change** so deploy is purely a frontend roll-forward. Roll-back is safe (any sections-shape data on disk is forward-compatible: `readContent` keeps reading it; the legacy branch only kicks in if `sections` is absent).
- `tsc --noEmit` must stay clean.
- 424/424 vitest suite green + new tests for the helpers.
- Manual smoke: create a new wiki entry → see 3 seeded labeled sections with placeholders → fill the first → reload → confirm persisted → rename a label → confirm persisted → add a section → confirm → remove the new section → confirm → switch editor theme light → confirm cream paper variant still works. Then open an old entry created before this change → confirm migration shows it as a single "Notes" section (or split-by-H2 if it had headings) with all the prose intact.

## Out of scope

- Drag-to-reorder sections — could be added later via dnd-kit (sections array already has stable ids, so this is a 1-task follow-up). For v1, sections render in insertion order; users can delete + re-add to reorder.
- Per-section H3 / lists / blockquote / link toolbar — for v1 sections support StarterKit minus headings (no H1/H2/H3 inside a section); user can still use Markdown shortcuts (`**bold**`, `*italic*`, `- list`, `> quote`).
- Section collapse / expand toggle — would be useful for long entries but not v1.
- Hive activity feed / public reader / search highlighting — already addressed via excerpt helper.
