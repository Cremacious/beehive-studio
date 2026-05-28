# Character Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the character profile editor's 2-column section grid into a single continuous "specimen sheet" with sections separated by thin rules. Eliminates the Appearance↔Personality row-stretch bug, removes per-section card chrome, applies small typography refinements.

**Architecture:** Single-file presentational rewrite. All logic preserved (legacy migration, debounce, save badge, theme tokens, identity header card, MetaPill/MetaText). Only the section grid + SectionCard component change. No DB / schema / test changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, paper-token CSS vars.

**Spec:** [docs/superpowers/specs/2026-05-28-character-profile-redesign-design.md](../specs/2026-05-28-character-profile-redesign-design.md)

---

### Task 1: Rewrite the body region — single column + divider rules + chrome removal + typography refinements

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/character-profile.tsx`

- [ ] **Step 1: Read the current file in full**

Read the file end-to-end before editing. Identify:
- The `[data-slot="character-sections"]` div (the outer grid container — currently `grid` + `gridTemplateColumns: '1fr 1fr'`).
- The six section invocations (Appearance, Personality, Backstory, Arc, Relationships, Notes). Five use `<SectionCard>`; Relationships is inline JSX.
- The `SectionCard` function definition near the bottom of the file.

The identity header card (`[data-slot="character-header"]`), the breadcrumb head, the `<style>` block with theme tokens, MetaPill, MetaText, and all logic (CharacterContent, readContent, scheduleSave, setField, removeRelationship, commitTitle) are out of scope — do NOT touch.

- [ ] **Step 2: Convert the outer grid to a flex stack**

Locate the JSX block for `[data-slot="character-sections"]` (around line 297-302 today):

```tsx
<div
  data-slot="character-sections"
  className="mt-[22px] grid gap-[18px]"
  style={{ gridTemplateColumns: '1fr 1fr' }}
>
```

Replace with:

```tsx
<div
  data-slot="character-sections"
  className="mt-[22px] flex flex-col"
>
```

Drop the inline `style={{ gridTemplateColumns: ... }}` entirely. Drop `gap-[18px]` — the per-section top-padding (Step 3) provides spacing. Add no replacement gap class.

- [ ] **Step 3: Rewrite `SectionCard` to remove chrome + add divider + apply typography refinements**

Locate the `SectionCard` function near the bottom of the file. Current shape (paraphrased):

```tsx
function SectionCard({ indexLabel, title, value, placeholder, onCommit, full }: {...}) {
  return (
    <div
      data-slot="character-section"
      className="relative px-6 pt-[22px] pb-6"
      style={{
        gridColumn: full ? '1 / -1' : undefined,
        background: 'var(--sheet-bg)',
        color: 'var(--sheet-ink)',
        borderRadius: 8,
        boxShadow: '0 1px 0 var(--paper-50) inset, 0 2px 4px rgba(0,0,0,0.25), 0 12px 24px -8px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono, ...)', fontSize: 10.5, ... }}>{indexLabel}</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, ... }}>{title}</h3>
      <div contentEditable ... style={{ fontFamily: 'var(--font-prose)', fontSize: 15, lineHeight: 1.65, ... }}>{value}</div>
    </div>
  )
}
```

Replace with:

```tsx
function SectionCard({ indexLabel, title, value, placeholder, onCommit }: {
  indexLabel: string
  title: string
  value: string
  placeholder: string
  onCommit: (next: string) => void
}) {
  return (
    <section
      data-slot="character-section"
      className="pt-8 first:pt-2 border-t border-[var(--sheet-rule)] first:border-t-0"
    >
      <div
        style={{
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 10.5,
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color: 'var(--sheet-ink-muted)',
          marginBottom: 4,
        }}
      >
        {indexLabel}
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--sheet-ink-strong)',
          margin: '0 0 12px',
        }}
      >
        {title}
      </h3>
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={e => {
          const next = (e.currentTarget.textContent ?? '').trim()
          if (next !== value.trim()) onCommit(next)
        }}
        className="outline-none"
        style={{
          fontFamily: 'var(--font-prose)',
          fontSize: 15,
          lineHeight: 1.7,
          color: 'var(--sheet-ink)',
          minHeight: '2.4em',
        }}
        data-placeholder={placeholder}
      >
        {value}
      </div>
    </section>
  )
}
```

Key diffs:
- `<div>` → `<section>` (semantic; matches the redesign's "section flow" model).
- Removed: `relative px-6 pt-[22px] pb-6` className; `background`, `borderRadius`, `boxShadow`, `gridColumn` inline styles.
- Added: `pt-8 first:pt-2 border-t border-[var(--sheet-rule)] first:border-t-0` className. Uses Tailwind's `first:` variant to omit the top border + reduce top padding for the first section.
- Removed: `full?: boolean` from Props (no longer needed — every section is full-width).
- Typography: heading `fontSize: 17 → 16`, body `lineHeight: 1.65 → 1.7`.

- [ ] **Step 4: Remove `full` prop from all SectionCard call sites**

Locate the five `<SectionCard ... full />` and `<SectionCard ... />` invocations inside `[data-slot="character-sections"]`. Remove the `full` prop from all of them. The five SectionCard calls become:

```tsx
<SectionCard indexLabel="01 · Description" title="Appearance" value={c.appearance ?? ''} placeholder="What do they look like?" onCommit={v => setField('appearance', v || null)} />
<SectionCard indexLabel="02 · Inner" title="Personality" value={c.personality ?? ''} placeholder="How do they act, think, feel?" onCommit={v => setField('personality', v || null)} />
<SectionCard indexLabel="03 · Before" title="Backstory" value={c.backstory ?? ''} placeholder="What shaped them before the story began?" onCommit={v => setField('backstory', v || null)} />
<SectionCard indexLabel="04 · Change" title="Character arc" value={c.arc ?? ''} placeholder="How do they change across the story?" onCommit={v => setField('arc', v || null)} />
{/* Relationships — inline JSX, see Step 5 */}
<SectionCard indexLabel="06 · Loose" title="Notes" value={c.notes ?? ''} placeholder="Anything else worth remembering…" onCommit={v => setField('notes', v || null)} />
```

- [ ] **Step 5: Rewrite the Relationships section — drop card chrome, match new section flow**

The Relationships section is inline JSX (not via SectionCard). Currently the outer wrapper has card chrome:

```tsx
<div
  data-slot="character-section"
  className="relative px-6 pt-[22px] pb-6"
  style={{
    gridColumn: '1 / -1',
    background: 'var(--sheet-bg)',
    color: 'var(--sheet-ink)',
    borderRadius: 8,
    boxShadow: '0 1px 0 var(--paper-50) inset, 0 2px 4px rgba(0,0,0,0.25), 0 12px 24px -8px rgba(0,0,0,0.35)',
  }}
>
```

Replace with the same divider-style wrapper as SectionCard:

```tsx
<section
  data-slot="character-section"
  className="pt-8 border-t border-[var(--sheet-rule)]"
>
```

(No `first:` here because Relationships is the 5th section — never first.)

The inner index label, heading, list rows, and the disabled "+ Link a character" button stay verbatim except: the heading's `fontSize: 17` becomes `fontSize: 16` (matching SectionCard's refinement).

Preserve all relationship-row pill styling — the inset row backgrounds (`oklch(0.78 0.04 60 / 0.10)`) provide their own visual structure, which is desired (the spec called this out — row pills are the structure).

- [ ] **Step 6: Tighten the outer padding (small breathing-room adjustment)**

The outermost body container (`<div className="mx-auto max-w-[720px] px-8 pt-7 pb-14">`) is fine — leave it alone.

The `[data-slot="character-sections"]` div previously used `mt-[22px]` to separate from the header card. That still works — keep it.

- [ ] **Step 7: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Run tests**

Run: `npm test`
Expected: 137/137 pass (no test changes — this is presentational).

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/character-profile.tsx"
git commit -m "feat(character): single-column specimen-sheet redesign"
```

---

### Task 2: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a What Has Been Built entry**

Open `AGENTS.md`. Find the "What Has Been Built" section. After the most recent entry (currently the SP-A epic + Delete Book), add:

```markdown
### Character Profile Redesign ✅ COMPLETE (2026-05-28)

Single-file presentational rewrite of `character-profile.tsx`. The body region's 2-column section grid (which caused an Appearance↔Personality row-stretch bug) collapsed into a single continuous "specimen sheet" — sections separated by thin `var(--sheet-rule)` horizontal lines instead of individual paper cards. Per-section background / shadow / border-radius removed; the dossier feel now comes from the sheet's own paper tone + the mono index labels (`01 · Description`, etc.) + the display headings.

- **Layout:** outer container switched from `grid` + `gridTemplateColumns: '1fr 1fr'` to `flex flex-col`. `SectionCard`'s `full` prop removed (every section is full-width now). `<section>` semantic tag replaces `<div>`.
- **Dividers:** `pt-8 first:pt-2 border-t border-[var(--sheet-rule)] first:border-t-0` provides the divider rule + top padding pattern. Tailwind's `first:` variant handles the first-section exception cleanly.
- **Typography refinements:** section heading 17→16px, body line-height 1.65→1.7.
- **Relationships:** drops outer card chrome, joins the divider flow. Inline row pills (avatar + name + arrow + relation chip + remove) provide their own structure.
- **Identity header card, breadcrumb head, theme tokens, MetaPill, MetaText, save-status badge, all logic (legacy migration, debounce, etc.)** preserved untouched.

No DB / schema / test changes. 137/137 tests, tsc clean.
```

- [ ] **Step 2: Update Resume Here**

Bump `Last updated`, refresh `Current focus` to summarize the character redesign as shipped, update `Last commit`, refresh `Next concrete step when resuming`.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync Resume Here + What Has Been Built — character profile redesign shipped"
```

---

## Self-Review

**Spec coverage:**
- §1 Layout architecture (single specimen sheet) → Task 1 Steps 2 + 3 ✅
- §2 Section structure (index + heading + body, divider, typography) → Task 1 Step 3 ✅
- §3 Relationships section (drop card chrome) → Task 1 Step 5 ✅
- §4 Implementation notes (file path, preservations) → Task 1 Steps 1, 3-6 ✅
- §5 Testing strategy (no new tests, tsc + npm test clean, manual checklist) → Task 1 Steps 7-8 + Chris runs manual after ✅
- §6 Out of scope → respected ✅

**Placeholder scan:** none. Every step has the exact JSX or className change to apply.

**Type consistency:** `SectionCard` Props shape simplified — `full?: boolean` removed. All five call sites in Step 4 match. Relationships heading typography matches SectionCard in Step 5.

**Manual verification (Chris runs after Task 1 + before Task 2):**
1. Open an existing character → renders as single column with section dividers, no row-stretch.
2. Type a long Personality → only Personality grows.
3. Empty sections still show italic placeholder.
4. Identity header (avatar + name + meta) unchanged.
5. Save badge still flashes on edit.
6. Relationships rows render inline (no surrounding card chrome); add button still disabled.
7. Light editor theme: dividers visible against paper.
8. Dark editor theme: dividers visible against canvas-dark.
