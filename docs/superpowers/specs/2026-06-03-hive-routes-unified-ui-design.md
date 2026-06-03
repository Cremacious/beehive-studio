# Hive Routes — Unified UI Design (2026-06-03)

## Why

Audit of the hive routes (Resume Here, prior message) found five back-button patterns, six outer max-widths, an h1-inside-vs-outside-panel split, Buzz feed with no panel chrome while Outline index is a forum-table, Word Goals misusing chapter-status tokens for goal types, Chapters index rows with variable heights, and Suggestions page with `p-2` outer padding while everything else is `p-6`/`p-8`. Chris flagged the result as "they don't look like they belong in the same app."

This spec locks the unified pattern for every hive route. Two-phase delivery:

1. **Fix pass** — apply the locked pattern to existing components in code (mechanical, no feature add/remove).
2. **Claude Design handoff** — produce a visual recreation prompt that takes the locked pattern as input and emits HTML/CSS mockups for any future Claude Design + Claude Code import cycle.

Inherits the locked design system at [docs/superpowers/specs/2026-06-01-editor-aesthetic-refresh-design.md](2026-06-01-editor-aesthetic-refresh-design.md). No new chrome tokens (`--canvas-*`, `--r-*`, `--sh-*`, `--br-card`). Two new token families are added: `--role-*` (4 values) and `--goal-*` (4 values).

## Out of scope

- New features. Mechanical recreation only.
- Hive layout shell + sidebar (already correct per H1).
- Light-mode chrome variant (hive routes are dark-only).
- Studio editor surfaces. Cream paper stays studio-only.
- Mobile / tablet responsive layout. Desktop only.
- Real-time updates, animations beyond existing fade/hover.

---

## 1. Page anatomy (load-bearing — applies to every hive page)

Every hive page renders this exact outer structure:

```tsx
<div className="mx-auto w-full max-w-{tier} p-6">
  {hasParent && (
    <Link
      href={parentHref}
      className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]"
    >
      <ArrowLeft className="h-3 w-3" />
      Back to {parentLabel}
    </Link>
  )}

  <section
    className="rounded-[var(--r-card)] border-t border-[var(--br-card)] shadow-[var(--sh-card)]"
    style={{ background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))' }}
  >
    <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
      <div className="min-w-0 flex-1">
        <h1 className="font-[var(--font-comfortaa)] text-[28px] font-bold leading-tight text-[var(--brand)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-[var(--canvas-dark-ink-muted)]">{subtitle}</p>
        )}
      </div>
      {primaryCta && (
        <button
          className="shrink-0 rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-semibold"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)', boxShadow: 'var(--sh-tile)' }}
        >
          {primaryCta}
        </button>
      )}
    </header>

    {/* page body lives here — direct child of <section> */}
  </section>
</div>
```

Locked decisions:

- **Back link** is `lucide ArrowLeft size={12}` + mono uppercase tracking-wider label "Back to {parent}". Sits ABOVE the panel as its own element (never inside the panel header). Skipped entirely on top-level pages. ONLY hive route with a non-`ArrowLeft` icon today is the wiki entry — convert.
- **h1** is Comfortaa bold 28px brand-yellow, inside the panel header. Always.
- **Subtitle** sits directly under h1 as `text-[13px]` muted. Plain Geist, NO `font-mono`. (Kills the Chapters/Outline/Discussions mono-subtitle inconsistency.)
- **Primary CTA** is solid brand-yellow pill (`--brand` bg + `--brand-ink` text + `--r-pill` + `--sh-tile`), top-right of panel header. When the action is gated (e.g. `canPostBuzz === false`), the button is omitted entirely — no disabled+tooltip variant. The top-right slot may also hold (a) a button group of two CTAs in a `gap-2 flex` (Submission review's Approve + Reject), or (b) a single status/role pill in place of a CTA when the page has no primary action (Chapter view's role pill). It never holds more than one of {CTA, button group, pill}.
- **Eyebrow** (mono uppercase "HIVE" line above h1 on the dashboard) is REMOVED. The hive sidebar already names the surface.

## 2. Max-width tiers (2 tiers)

- `max-w-3xl` (768px) — **Standard**. Dashboard, Buzz, Word Goals, Chapters index, Members, Settings, Submissions list, Suggestions, Submission read/compose/review, Word Goals page.
- `max-w-5xl` (1024px) — **Wide**. Outline index, Outline detail, Discussions list, Discussion thread, Wiki shell, Hive chapter view.

Outer padding is `p-6` everywhere. (Kills Suggestions `px-2 py-2` outlier.)

## 3. List chrome (2 shapes inside universal panel wrapper)

**Both shapes** live inside the page's outer `<section>` panel. The page header is the panel's `<header>`. The list itself sits directly under the header, with NO inner panel. Top hairline `border-t border-[var(--br-card)]` separates header from list when the list isn't another header strip.

### Forum-table shape

For pages where each row has parallel meta columns. Used on:
- Outline index (`Outline | Beats | Last edit`)
- Discussions list (`Thread | Replies | Last activity`)
- Members (`Member | Role | Actions`)
- Submissions list (`Submission | Status | Submitted`)
- Chapters index (`Chapter | Activity | Updated`) ← **fixed in this pass**
- Suggestions per-chapter sub-groups (`Excerpt | Status | Submitted by`)

Layout: column-header strip (`bg`: `--canvas-dark-100`, `border-y`: `--br-card`, `--font-mono` `text-[10px]` uppercase tracking-wider muted, `grid-template-columns` defined per page) followed by `<ul className="divide-y divide-[var(--br-card)]/40">` of rows. Each row uses the same grid template. Hover state: `hover:bg-[var(--canvas-dark-300)]` only. (Kills `hover:translate-y-[-1px]` jitter on Chapters.)

### Card-stack shape

For pages where each row is a self-contained post or card with no parallel meta columns. Used on:
- Buzz feed
- Word Goals active strip / contributors / activity / history
- Suggestions card pile (within each chapter sub-group, the suggestion cards stack)

Layout: vertical stack inside `<div className="px-6 pb-6 flex flex-col gap-3">`. Each card is a tile-gradient (`linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `var(--sh-tile)` + `var(--r-row)`) with flex internal layout. NO panel chrome on individual cards.

## 4. Sub-panel rules (NO nesting)

A page renders exactly ONE panel. Internal sections inside the panel are separated by `border-t border-[var(--br-card)]/50` + uppercase mono section label (`text-[10px] tracking-wider text-[var(--canvas-dark-ink-muted)]`).

Word Goals before: panel > 4 sub-panels (active strip / contributors / activity / history) > tile rows.
Word Goals after: panel > 4 sections divided by hairlines + mono labels > tile rows.

Settings form before: panel > sub-panels per section > inputs.
Settings form after: panel > sections divided by hairlines + mono labels > inputs. Danger Zone stays distinguishable via destructive-tinted label + button only.

Word Goals **History** stays inline as the bottom-most hairline section. No collapsible `<details>` accordion.

## 5. Pill convention

Visual shape (universal):

```tsx
<span
  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
  style={{
    background: 'oklch(from var(--accent-token) l c h / 0.14)',
    color: 'var(--accent-token)',
    border: '1px solid oklch(from var(--accent-token) l c h / 0.3)',
  }}
>
  {label}
</span>
```

Token mapping (which `--accent-token` to use):

| Pill kind | Token family | Values |
|---|---|---|
| Chapter status | `--status-*` (existing) | `--status-idea` `--status-drafting` `--status-revised` `--status-final` `--status-published` |
| Submission status | `--status-*` (existing) | `--status-idea` (DRAFT) `--status-warning` (PENDING) `--status-success` (APPROVED) `--status-error` (REJECTED) |
| Discussion topic | `TOPIC_META` (existing) | per-topic accent already defined |
| Annotation layer | `LAYER_META` (existing) | per-layer accent already defined |
| Hive role | `--role-*` (NEW) | `--role-owner` `--role-moderator` `--role-contributor` `--role-reader` |
| Goal type | `--goal-*` (NEW) | `--goal-daily` `--goal-weekly` `--goal-monthly` `--goal-custom` |

New tokens land in `app/globals.css` `:root` as oklch values. Suggested values (light-mode override not needed since hive routes are dark-only):

```css
--role-owner: oklch(0.78 0.13 70);       /* warm gold — owner authority */
--role-moderator: oklch(0.72 0.11 250);  /* slate blue — review-y */
--role-contributor: oklch(0.74 0.12 145); /* mint — productive */
--role-reader: oklch(0.66 0.04 240);     /* cool gray — passive */

--goal-daily: oklch(0.78 0.13 70);       /* warm gold — daily energy */
--goal-weekly: oklch(0.74 0.12 145);     /* mint — rhythm */
--goal-monthly: oklch(0.72 0.11 280);    /* lilac — long horizon */
--goal-custom: oklch(0.66 0.04 240);     /* cool gray — bespoke */
```

(Final hue picks happen during implementation; values above are starting points the implementer can adjust if any conflict with existing surface tokens. Constraint: every value renders legibly on `--canvas-dark-300` tile background at the 0.14 alpha tint + full-opacity ink.)

## 6. Specific page-level fixes

### Chapters index

- Row layout: `grid grid-cols-[40px_1fr_180px_120px] items-center gap-3 px-6 py-3`. Columns: chapter number / title + status pill inline / activity badge slot / updated time.
- Activity badge slot has fixed width (180px) and renders both badges in a `flex gap-1.5` row. When count = 0, renders `<span className="invisible" aria-hidden>—</span>` placeholder so row height stays constant.
- Drop `hover:translate-y-[-1px]`. Replace with `hover:bg-[var(--canvas-dark-300)]`.
- "Unavailable" defensive branch keeps `opacity-60` but adds inline text `(no longer accessible)` so it's not silently confusing.
- Status pill (chapter status) shows inline with title (right of title text, before activity column) using the unified pill convention with `--status-*` token.

### Chapter view (`hive/[hiveId]/chapters/[chapterId]`)

- Back link moves OUT of panel header to above-panel position per §1.
- Role pill occupies the top-right slot of panel header per §1 (chapter view has no CTA). Same alpha-tint shape per §5 with `--role-*` token.
- Byline becomes the panel subtitle (`<p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">Chapter from {book} by @{author}</p>`).
- Chapter status pill renders inline with byline, separated by `·`.
- `ChapterMetadataHeader` (status + synopsis + scene planner) renders BELOW the panel header, separated by hairline. NOT another panel.
- Prose canvas (TipTap read-only) sits directly under the metadata hairline with `px-8 py-6` and respects the dark walnut chrome (scoped `[data-slot="hive-chapter-pane"] .ProseMirror` overrides — already correct).

### Buzz feed

- Wraps in the universal panel per §1.
- Body is card-stack shape per §3. Each card renders: avatar (32px) + author handle + relTime + derived title (first line of body, max 80 chars, Comfortaa bold 16px) + body excerpt (`line-clamp-2 text-sm` of remaining text after first line). Likes button + count to the right of the card body.
- Link-type cards render the link card BELOW the title/excerpt block, not replacing it.
- If post body is a single line under 80 chars, render as title only (no excerpt).
- Edit/delete kebab top-right of card, same as today.

### Discussions list

- h1 moves INSIDE panel per §1.
- Topic filter chips become a hairline-divided section directly under panel header, NOT a `<header>` above the list. Mono `FILTER` label above the chip row.
- List body is forum-table shape per §3 with columns `Thread | Replies | Last activity`. Each row: derived title (first line of body) + body excerpt (line-clamp-1) in the Thread column, reply count + last-activity time in the right columns.

### Outline index

- h1 moves INSIDE panel per §1. Subtitle becomes plain Geist, NOT mono.
- Existing column-header strip stays (already correct shape).
- Hover state stays `hover:bg-[var(--canvas-dark-300)]` (already correct).

### Word Goals

- Sub-panels collapse to hairline-divided sections per §4. Section labels: `ACTIVE GOALS`, `CONTRIBUTORS`, `RECENT ACTIVITY`, `HISTORY`.
- Goal cards keep tile chrome but switch goal-type accent from `--status-*` (semantic misuse) to `--goal-*` (new tokens per §5).
- "+ New Goal" CTA in panel header per §1 (replaces modal-trigger-inside-section pattern).
- `disabled={type !== 'TOTAL' && false}` always-false bug in `new-goal-modal.tsx` fixed as a sweep item — actual gating logic per the modal's intent.

### Submissions list

- "+ New Submission" CTA becomes solid brand pill per §1 (was text link).
- 3 role-scoped sections (My drafts / My submissions / All in hive) become hairline-divided sections per §4 with mono section labels.
- Each section is forum-table shape per §3.
- Disabled+tooltip CTA when `canSubmitChapter === false` becomes omitted CTA per §1.

### Submission composer / review / read

- All three modes wear the universal page shell per §1.
- Composer: back link "Back to submissions" above panel; panel header has "New submission" title + "Auto-saved" badge top-right; body is title input + target-order select + TipTap composer inline (no inner panels).
- Review: back link above panel; panel header has submission title + Approve/Reject CTA pair top-right (Approve = brand pill; Reject = tile-gradient with destructive tint).
- Read: back link above panel; panel header has submission title + status pill top-right (no CTA); body is read-only prose + review-note section divided by hairline.

### Suggestions

- Outer padding fix: `p-6` (was `px-2 py-2`).
- h1 + subtitle inside panel header per §1.
- Per-chapter groups become hairline-divided sections per §4 with mono label "CHAPTER {N}: {TITLE}". Each section's suggestion cards stack inside (card-stack shape per §3).
- Accept = brand pill; Reject = tile-gradient destructive-tint; Open = text-link brand color.

### Members

- "+ Invite" CTA in panel header per §1 (existing invite link sub-section stays inside the panel but as a hairline-divided section with mono label "INVITE LINK").
- Member rows are forum-table shape per §3 with columns `Member | Role | Actions`. Role column uses unified pill convention with `--role-*` tokens per §5.

### Settings

- Form sections collapse to hairline-divided sections per §4 with mono labels (`BASICS`, `VISIBILITY`, `DISCOVERABILITY`, `DANGER ZONE`).
- Save CTA in panel header per §1 (replaces inline-form submit button).
- Danger Zone keeps destructive-tinted label and destructive button.

### Wiki shell

- h1 + subtitle inside panel header per §1.
- "+ New Entry" CTA in panel header (already correct).
- 3-tab view switch (By Category / By Folder / Notes) becomes a hairline-divided section directly under panel header with mono label "VIEW".
- Search input becomes a hairline-divided section above the active view's content, mono label "SEARCH".

### Hive dashboard

- Eyebrow ("HIVE" mono line above h1) is REMOVED per §1. Page reads top-down as: panel header (h1 = hive name, subtitle = description) → body sections divided by hairlines (linked book card / member count meta line / "Read the book" CTA / "Open in studio" CTA gated by author).

## 7. Implementation phasing

Single fix pass, subagent-driven, per-task verification with Chris before next task. Suggested decomposition:

1. **T1** — Token additions (`--role-*` + `--goal-*` in `globals.css`).
2. **T2** — Shared `<HivePageShell>` client component (outer panel wrapper with back-link + h1 + subtitle + CTA props). Drop-in for every hive route page.
3. **T3** — Shared `<HivePill>` component (unified pill shape with token-prop API).
4. **T4** — Shared `<HiveSectionDivider>` component (hairline + mono label).
5. **T5** — Apply T2/T3/T4 to Dashboard.
6. **T6** — Apply to Members + Settings (smallest forms).
7. **T7** — Apply to Buzz + Word Goals (card-stack pages with derived-title work).
8. **T8** — Apply to Submissions list + composer + review + read.
9. **T9** — Apply to Suggestions.
10. **T10** — Apply to Chapters index + chapter view.
11. **T11** — Apply to Discussions list + thread + composer modal.
12. **T12** — Apply to Outline index + detail + Wiki shell + entry editor.
13. **T13** — `disabled={type !== 'TOTAL' && false}` bug fix sweep.
14. **T14** — Manual smoke against the 14-page checklist.

## 8. Carry-forward smoke checklist for Chris

For every hive page below, confirm: (a) back link present iff page has a parent; (b) h1 inside panel as Comfortaa brand-yellow; (c) subtitle plain Geist muted; (d) primary CTA is solid brand pill iff present; (e) max-width matches the §2 tier; (f) outer padding is `p-6`; (g) sub-panels eliminated; (h) pills are alpha-tint shape with correct token family.

1. Dashboard
2. Outline index
3. Outline detail
4. Wiki shell (Category / Folder / Notes views)
5. Wiki entry editor
6. Chapters index — rows are constant height regardless of activity badges
7. Chapter view — role pill top-right, byline as subtitle, metadata header inline (not nested)
8. Discussions list
9. Discussion thread
10. Submissions list — 3 sections divided by hairlines, CTA is brand pill
11. Submission composer
12. Submission review
13. Submission read
14. Suggestions — outer padding is `p-6`, per-chapter groups as hairline sections
15. Word Goals — no sub-panels, goal-type pills use `--goal-*` tokens, History inline
16. Buzz — panel-wrapped, posts have derived titles
17. Members — role pills use `--role-*` tokens
18. Settings — sections as hairlines, Save in panel header

---

## Appendix A: Claude Design handoff prompt scaffold

After the fix pass ships and the codebase is internally consistent, future visual refresh cycles can hand off to Claude Design via the prompt scaffold below. The prompt locks the structural decisions from §1–§6 so Claude Design can iterate on PURE visual treatment (color, hierarchy, density) without drifting on layout.

```text
Recreate the following hive routes as a single coherent dark-mode app surface.
Background: oklch(0.255 0.003 256) (`#262728`). Center every page within `max-w-{3xl|5xl}` per the table below.

UNIVERSAL PAGE SHELL — every page renders exactly this DOM:
  - optional back link above panel (lucide ArrowLeft 12px + mono uppercase tracking-wider muted)
  - one panel wrapper (gradient bg `--canvas-dark-250 → -200`, `--r-card` 20px, `--sh-card` shadow, `--br-card` top hairline)
  - panel header: h1 Comfortaa bold 28px brand-yellow `#ffc300` + subtitle plain Geist 13px muted (left), solid brand pill CTA (right)
  - body content directly under header (no inner panels)

PAGE LIST AND TIERS:
  [insert §2 + §6 specifics]

PILLS: alpha-tint bg (`oklch(from <token> l c h / 0.14)`), accent-color text, 1px border at 0.3 alpha, 999px radius, uppercase tracking-wider 11px. Token sources per kind: chapter status `--status-*`, submission status `--status-idea/warning/success/error`, role `--role-*` (NEW: warm gold owner, slate blue moderator, mint contributor, cool gray reader), goal type `--goal-*` (NEW: gold daily, mint weekly, lilac monthly, gray custom), discussion topic existing TOPIC_META, annotation layer existing LAYER_META.

LISTS:
  - Forum-table: column-header strip (mono uppercase muted on `--canvas-dark-100` bg, `--br-card` borders) + `divide-y` `<ul>` rows; row hover `--canvas-dark-300`.
  - Card-stack: tile-gradient cards (`--canvas-dark-350 → -300` + `--sh-tile` + `--r-row`) stacked with `gap-3` inside `px-6 pb-6` body.

SECTIONS INSIDE A PANEL: divided by hairline (`border-t border-[var(--br-card)]/50`) + mono uppercase tracking-wider 10px muted label. NEVER nest panel chrome inside a panel.

CONSTRAINTS:
  - No new features. Every affordance present today must remain.
  - No pure black. Darkest legitimate surface is `--canvas-dark-100`.
  - Brand yellow restraint per the 12-place usage map.
  - Cream paper is studio-editor-only and does NOT appear on any hive route.
  - Dark mode only.
  - Desktop layout only.
```

The full Claude Design prompt gets generated by the handoff step (after the fix pass ships) using the locked §6 page table verbatim.
