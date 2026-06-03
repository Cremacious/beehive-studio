# Hive Routes — Unified UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every hive route render the same panel anatomy, max-width, list chrome, sub-panel rule, pill convention, and CTA shape per the locked spec at [docs/superpowers/specs/2026-06-03-hive-routes-unified-ui-design.md](../specs/2026-06-03-hive-routes-unified-ui-design.md). Pure visual + structural refactor; no feature add/remove; no DB, no server actions, no schema.

**Architecture:** Add 3 missing status tokens + 2 new token families (`--role-*`, `--goal-*`) in `globals.css`. Ship 3 shared client components (`<HivePageShell>`, `<HivePill>`, `<HiveSectionDivider>`) that every hive page consumes. Apply page-by-page in 8 tasks. End with a modal-bug sweep + smoke + AGENTS.md update. Subagent-driven execution with per-task verification.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 with inline styles for token consumption (existing codebase pattern), lucide-react icons.

---

## File Structure

**Create (3 shared components + 0 new pages):**
- `app/[locale]/(app)/hive/[hiveId]/_components/hive-page-shell.tsx` — universal page wrapper (back link + panel + h1 + subtitle + CTA slot)
- `app/[locale]/(app)/hive/[hiveId]/_components/hive-pill.tsx` — alpha-tint pill with token-prop API
- `app/[locale]/(app)/hive/[hiveId]/_components/hive-section-divider.tsx` — hairline + mono uppercase label

**Modify (1 global stylesheet + 22 page/component files):**
- `app/globals.css` (T1: tokens)
- Dashboard, Members, Settings (T5–T6)
- Buzz feed + card + empty-state + compose-modal + edit-modal (T7)
- Word Goals page + goal-card + new-goal-modal + edit-goal-modal (T7)
- Submissions list + composer + review + read (T8)
- Suggestions page + per-chapter component (T9)
- Chapters index + chapter view (T10)
- Discussions list + thread + compose modal (T11)
- Outline index + detail + Wiki shell + entry editor + folder renderer (T12)
- `new-goal-modal.tsx` always-false bug (T13)
- `AGENTS.md` Resume Here (T14)

**No deletions.** All affordances preserved per spec §6.

**Test posture per project convention:** manual smoke after each task per the spec §8 18-page checklist. No new unit tests required — the existing 438/438 test suite must stay green throughout (token additions and presentation refactors don't touch any code with tests).

---

### Task 1: Token additions in `app/globals.css`

**Files:**
- Modify: `app/globals.css` (`:root` block, after the existing `--status-*` block at line ~118)

**Why:** Spec §5 introduces 2 new token families. Audit also caught 3 existing token references that have no definition (`--status-warning`, `--status-success`, `--status-error` are read by `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-shared.tsx` line 8–11 but fall back to `--color-brand`, so every submission status pill renders brand-yellow today — silent bug).

- [ ] **Step 1: Read `globals.css` to confirm the line directly after the existing `--status-final` row.**

Run: open the file, locate the block `--status-idea / outline / first-draft / revised / final` starting around line 114. The block ends at the `--status-final` row. Insert the new tokens directly after this row.

- [ ] **Step 2: Add 3 missing status tokens + 8 new token families.**

Insert this block immediately after the `--status-final:` line (the comment header gives future readers the rationale):

```css
  /* Submission status (read by hive/submissions/_components/submission-shared.tsx) */
  --status-warning: oklch(0.78 0.13 70);   /* warm gold — pending review */
  --status-success: oklch(0.74 0.12 145);  /* mint — approved */
  --status-error:   oklch(0.66 0.18 25);   /* coral — rejected */

  /* Hive member role (replaces --status-* misuse in hive/_components/hive-members.tsx) */
  --role-owner:       oklch(0.78 0.13 70);   /* warm gold — owner authority */
  --role-moderator:   oklch(0.72 0.11 250);  /* slate blue — review-y */
  --role-contributor: oklch(0.74 0.12 145);  /* mint — productive */
  --role-reader:      oklch(0.66 0.04 240);  /* cool gray — passive */

  /* Word goal type (replaces --status-* misuse in hive/word-goals/_components/goal-card.tsx) */
  --goal-daily:   oklch(0.78 0.13 70);   /* warm gold — daily energy */
  --goal-weekly:  oklch(0.74 0.12 145);  /* mint — rhythm */
  --goal-monthly: oklch(0.72 0.11 280);  /* lilac — long horizon */
  --goal-custom:  oklch(0.66 0.04 240);  /* cool gray — bespoke */
```

- [ ] **Step 3: Verify tsc still clean.**

Run: `npx tsc --noEmit`
Expected: clean (token additions don't affect TypeScript).

- [ ] **Step 4: Verify Tailwind v4 picks up the new tokens.**

Tailwind v4 uses CSS-first config — these are CSS variables read via `var(--token)` in inline styles. No `@theme` registration needed unless used as Tailwind utility classes. Verify by grepping for any existing utility-class consumption (`text-status-warning`, etc.):

Run: `grep -r "text-status-warning\|text-status-success\|text-status-error\|text-role-\|text-goal-" "C:/Code/personal/beehive-studio/app" "C:/Code/personal/beehive-studio/components"`
Expected: no matches (all consumption is via inline `style={{ color: 'var(--token)' }}`).

- [ ] **Step 5: Commit.**

```bash
cd "C:/Code/personal/beehive-studio"
git add app/globals.css
git commit -m "feat(tokens): add --status-warning/success/error + --role-* + --goal-*"
```

---

### Task 2: Shared `<HivePageShell>` component

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-page-shell.tsx`

**Why:** Spec §1 locks the universal page anatomy. Every hive page wraps its content in this shell. Drop-in replacement for the ad-hoc `<div className="max-w-X p-Y">` + bare `<h1>` patterns sprinkled across the codebase.

- [ ] **Step 1: Create the component file.**

```tsx
'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export type HivePageShellProps = {
  /** Outer max-width tier per spec §2. */
  width: 'standard' | 'wide'
  /** Page title — Comfortaa bold 28px brand-yellow. */
  title: string
  /** Subtitle under title — plain Geist 13px muted. Optional. */
  subtitle?: string
  /** Back-link config. Renders mono uppercase link ABOVE the panel. Omit on top-level pages. */
  back?: { href: string; label: string }
  /**
   * Top-right slot of the panel header. Holds ONE OF:
   *  - a single primary CTA (brand pill <button>),
   *  - a 2-button group (gap-2 flex of two action buttons),
   *  - a status/role pill (<HivePill> instance).
   * The caller is responsible for the exact shape; the shell only renders the slot.
   */
  headerSlot?: ReactNode
  /** Page body — rendered directly inside the panel under the header. */
  children: ReactNode
}

const WIDTH_CLASS: Record<HivePageShellProps['width'], string> = {
  standard: 'max-w-3xl',
  wide: 'max-w-5xl',
}

export function HivePageShell({
  width,
  title,
  subtitle,
  back,
  headerSlot,
  children,
}: HivePageShellProps) {
  return (
    <div className={`mx-auto w-full ${WIDTH_CLASS[width]} p-6`}>
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)] transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to {back.label}
        </Link>
      )}

      <section
        className="rounded-[var(--r-card)] overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderTop: 'var(--br-card)',
          boxShadow: 'var(--sh-card)',
        }}
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <h1
              className="font-comfortaa text-[28px] font-bold leading-tight"
              style={{ color: 'var(--brand)' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="mt-1 text-[13px]"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {headerSlot && <div className="shrink-0">{headerSlot}</div>}
        </header>
        {children}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify tsc clean.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/_components/hive-page-shell.tsx"
git commit -m "feat(hive/ui): add shared HivePageShell"
```

---

### Task 3: Shared `<HivePill>` component

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-pill.tsx`

**Why:** Spec §5 locks the unified pill shape. Every categorical tag (status, role, topic, goal, layer) renders through this component with a `--token-name` prop.

- [ ] **Step 1: Create the component file.**

```tsx
import type { ReactNode } from 'react'

export type HivePillProps = {
  /**
   * CSS custom-property name (without `var()` wrapping) whose value drives
   * the pill's tint, ink, and border. Examples: `--status-idea`,
   * `--role-owner`, `--goal-daily`, `--topic-general`, `--layer-grammar`.
   *
   * The component composes `oklch(from var(<token>) l c h / 0.14)` for the
   * background and `oklch(from var(<token>) l c h / 0.3)` for the border,
   * with the token itself as the text color.
   */
  token: string
  /** Pill label — typically uppercase, but caller decides. */
  children: ReactNode
  /** Optional extra classes (e.g. positioning, gap). */
  className?: string
}

export function HivePill({ token, children, className }: HivePillProps) {
  const accent = `var(${token})`
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${className ?? ''}`}
      style={{
        background: `oklch(from ${accent} l c h / 0.14)`,
        color: accent,
        border: `1px solid oklch(from ${accent} l c h / 0.3)`,
      }}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 2: Verify tsc clean.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/_components/hive-pill.tsx"
git commit -m "feat(hive/ui): add shared HivePill"
```

---

### Task 4: Shared `<HiveSectionDivider>` component

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-section-divider.tsx`

**Why:** Spec §4 locks the no-sub-panel rule: internal sections divided by hairline + mono label. This component is the canonical implementation.

- [ ] **Step 1: Create the component file.**

```tsx
import type { ReactNode } from 'react'

export type HiveSectionDividerProps = {
  /** Uppercase mono label rendered above the section content. */
  label: string
  /** Optional ID for jump-anchor or aria use. */
  id?: string
  /** Tone — defaults to muted; `danger` swaps to destructive ink (used by Settings' Danger Zone). */
  tone?: 'muted' | 'danger'
  /** Section body. */
  children: ReactNode
  /** Optional extra classes on the inner content wrapper. */
  className?: string
}

const LABEL_TONE: Record<NonNullable<HiveSectionDividerProps['tone']>, string> = {
  muted: 'text-[var(--canvas-dark-ink-muted)]',
  danger: 'text-[color:oklch(0.66_0.18_25)]', /* matches --status-error */
}

export function HiveSectionDivider({
  label,
  id,
  tone = 'muted',
  children,
  className,
}: HiveSectionDividerProps) {
  return (
    <section
      id={id}
      className="px-6 py-5"
      style={{ borderTop: '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)' }}
    >
      <p
        className={`mb-3 font-mono text-[10px] uppercase tracking-wider ${LABEL_TONE[tone]}`}
      >
        {label}
      </p>
      <div className={className}>{children}</div>
    </section>
  )
}
```

- [ ] **Step 2: Verify tsc clean.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/_components/hive-section-divider.tsx"
git commit -m "feat(hive/ui): add shared HiveSectionDivider"
```

---

### Task 5: Apply shell to Dashboard

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/page.tsx`

**Spec refs:** §1 page anatomy, §2 standard width, §6 Hive dashboard ("HIVE eyebrow REMOVED").

**Do not regress:** linked-book card with paper-warm cover preserved; standalone fallback preserved; "Read the book" CTA visible to all members; "Open in studio" CTA gated to book author; 4-tile stat row consolidated into welcome panel meta line per current implementation.

- [ ] **Step 1: Read the current dashboard page to understand its data shape.**

Run: open `app/[locale]/(app)/hive/[hiveId]/page.tsx` and note: `requireHiveMember` call, `getHiveAction` projection, viewer/owner branches, the "HIVE" mono eyebrow string, and the existing `max-w-2xl` wrapper.

- [ ] **Step 2: Rewrite as `<HivePageShell>` consumer.**

Wrap the page in `<HivePageShell width="standard" title={hive.name} subtitle={hive.description ?? undefined}>`. Remove the "HIVE" mono eyebrow line per spec §6. Move the welcome paragraph, linked-book card, stats meta line, and CTAs into the children — each separated by `<HiveSectionDivider label="…">` per spec §4 (suggested section labels: `OVERVIEW`, `LINKED BOOK`, `READ`).

Apply the title sub-rule: when the hive has no linked book (standalone), the `LINKED BOOK` section becomes `STANDALONE HIVE` with the existing standalone copy. The "Open in studio" CTA hides when `viewer.userId !== book.userId`.

- [ ] **Step 3: Verify tsc clean.**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/page.tsx"
git commit -m "refactor(hive/dashboard): adopt unified page shell"
```

---

### Task 6: Apply shell to Members + Settings

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/members/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-members.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/settings/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-settings-form.tsx`

**Spec refs:** §1 anatomy, §2 standard width, §3 forum-table for member rows, §4 hairline sections, §5 `--role-*` tokens, §6 Members + Settings.

**Do not regress:** invite link copy flow (sonner toast on copy), member-count progress bar vs `FREE_HIVE_MEMBER_LIMIT`, OWNER-only role dropdown with optimistic-with-rollback + sonner toasts, remove button with rollback, pre-existing username-invite form, hive-info form fields (name + description + 3-card visibility picker + discoverable checkbox with 3-layer defense), Danger Zone delete via `ConfirmDialog` with redirect to `/{locale}/studio`, OWNER-guard inline message for non-OWNER on settings.

- [ ] **Step 1: Refactor Members.**

In `members/page.tsx`, wrap return in `<HivePageShell width="standard" title="Members" subtitle="..." headerSlot={inviteCta}>`. The `inviteCta` is a button that scrolls to the `INVITE LINK` section (or opens an existing flow if one exists today).

In `hive-members.tsx`:
- Restructure into `<HiveSectionDivider label="INVITE LINK">` (existing invite link UI inside), `<HiveSectionDivider label="USERNAME INVITE">` (existing form inside), `<HiveSectionDivider label="MEMBERS">` (forum-table list inside).
- Member rows: `grid grid-cols-[1fr_120px_60px] items-center gap-3 px-6 py-3` with column header strip per spec §3 (`Member | Role | Actions`).
- Role pill uses `<HivePill token={ROLE_TOKEN[member.role]}>` where `ROLE_TOKEN: Record<HiveMemberRole, string> = { OWNER: '--role-owner', MODERATOR: '--role-moderator', CONTRIBUTOR: '--role-contributor', BETA_READER: '--role-reader' }`. (Keep `BETA_READER` mapping since live enum value is BETA_READER — documented AGENTS.md follow-up.)
- Hover state: `hover:bg-[var(--canvas-dark-300)]` only. No translate.

- [ ] **Step 2: Refactor Settings.**

In `settings/page.tsx`, the OWNER guard stays (non-OWNER inline message); the OWNER branch wraps `<HiveSettingsForm>` in `<HivePageShell width="standard" title="Settings" subtitle="Manage your hive." headerSlot={saveButton}>`. The `saveButton` is the form's save trigger relocated into the header slot per spec §6.

In `hive-settings-form.tsx`:
- Restructure into 4 `<HiveSectionDivider>` sections: `BASICS` (name + description), `VISIBILITY` (3-card picker), `DISCOVERABILITY` (checkbox + 3-layer defense), `DANGER ZONE` (`tone="danger"`, delete button inside).
- Save button moved out of the form into a `headerSlot` callback. Form retains its onSubmit; the relocated button just sets `form="hive-settings-form"` and `type="submit"`.

- [ ] **Step 3: Verify tsc clean + manual smoke.**

Run: `npx tsc --noEmit`. Manually verify: invite link copy still works, role dropdown rollback still works, save still saves, delete still deletes.

- [ ] **Step 4: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/members" "app/[locale]/(app)/hive/[hiveId]/settings" "app/[locale]/(app)/hive/[hiveId]/_components/hive-members.tsx" "app/[locale]/(app)/hive/[hiveId]/_components/hive-settings-form.tsx"
git commit -m "refactor(hive/members,settings): adopt unified page shell"
```

---

### Task 7: Apply shell to Buzz + Word Goals

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-feed.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-post-card.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-empty-state.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/*` (page-shell wrapper, goal-card, contributors panel, activity panel, history accordion)

**Spec refs:** §1 anatomy, §2 standard width, §3 card-stack shape, §4 hairline sections, §5 `--goal-*` tokens, §6 Buzz + Word Goals.

**Do not regress (Buzz):** TEXT + LINK post types preserved; like flow optimistic-with-rollback (`useTransition` disables button briefly); compose modal (Dialog primitive) + edit modal preserved; kebab Edit/Delete gated by `canEditBuzz`; `(edited)` indicator when `updatedAt > createdAt`; LinkCard URL line + icon; `BuzzEmptyState` shape (just re-skinned chrome); CTA omitted when `!canPostBuzz`.

**Do not regress (Word Goals):** all 4 sections (Active Goals / Contributors / Recent Activity / History) preserved; new-goal modal (DAILY/WEEKLY/MONTHLY/CUSTOM picker with auto-derived endDate) preserved; edit-goal modal (type + startDate locked) preserved; archive via ConfirmDialog preserved; sidebar progress badge unchanged (separate concern, layout-level); `getActiveWordGoalSummaryAction` consumption preserved; lazy-archive sweep on list preserved.

- [ ] **Step 1: Refactor Buzz.**

In `buzz/page.tsx`, wrap the `<BuzzBoardShell>` in `<HivePageShell width="standard" title="Buzz Board" subtitle="Inspiration, links, and vibes from your hive." headerSlot={canPostBuzz ? newBuzzCta : undefined}>`.

In `buzz-feed.tsx` (the inner shell): remove its own h1 + subtitle + outer wrapper. Render the post list directly. Wrap the list in `<div className="px-6 pb-6 flex flex-col gap-3">` (card-stack body per spec §3). Empty state mounts in the same body via `<BuzzEmptyState>`.

In `buzz-post-card.tsx`:
- Add `deriveTitleAndExcerpt(body: string): { title: string; excerpt: string | null }` helper at module scope that splits on first `\n` (or returns the whole body as title when <= 80 chars + no newline). Title is `body.split('\n')[0].slice(0, 80)`. Excerpt is the remainder, `line-clamp-2`. If the remainder is empty after trim, excerpt is `null` (and the card omits the excerpt block).
- Layout: avatar (32px, top-left) + flex-1 column with author@handle · relTime (mono small muted) + title (Comfortaa bold 16px brand-yellow) + excerpt (text-sm line-clamp-2) + LinkCard (if LINK type) + likes/kebab row at bottom.
- Card chrome: tile-gradient + `--r-row` + `--sh-tile`.

- [ ] **Step 2: Refactor Word Goals.**

In `word-goals/page.tsx`, wrap `<WordGoalsPageShell>` in `<HivePageShell width="standard" title="Word Goals" subtitle="Set a shared writing target with your hive." headerSlot={canSetWordGoal ? newGoalCta : undefined}>`. The `newGoalCta` opens `NewGoalModal` (state owned by a small client wrapper if needed).

In `WordGoalsPageShell`:
- Remove its own h1 + subtitle + sub-panel chrome from all 4 sections.
- Render 4 `<HiveSectionDivider>` sections: `ACTIVE GOALS` (current `GoalCard` strip), `CONTRIBUTORS` (existing per-contributor breakdown), `RECENT ACTIVITY` (existing log feed with Load older), `HISTORY` (NO accordion — render inline per spec §6 Q4 = A).
- The first section's hairline is suppressed by using `border-t-0` on the first `<HiveSectionDivider>` via a `hideTopBorder` prop, OR by placing the first section inside the panel header's body and using the section divider only for sections 2–4. **Recommendation:** add `hideTopBorder?: boolean` prop to `<HiveSectionDivider>` and use it for the first section.

Update `<HiveSectionDivider>` (Task 4) to accept `hideTopBorder` — modify it in this task as a 2-line addition:
```tsx
style={{
  borderTop: hideTopBorder
    ? undefined
    : '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
}}
```

In `goal-card.tsx`:
- Replace the `--status-revised/drafting/final` accent map (semantic misuse) with a `GOAL_TOKEN: Record<WordGoalType, string>` map pointing at `--goal-daily/weekly/monthly/custom`.
- Goal-type pill uses `<HivePill token={GOAL_TOKEN[goal.type]}>{goal.type}</HivePill>`.
- Card retains progress bar with brand-yellow fill on inset track.

- [ ] **Step 3: Verify tsc clean + manual smoke (Buzz + Word Goals).**

Run: `npx tsc --noEmit`. Manually verify: post like/edit/delete still works; goal create/edit/archive still works; lazy-archive sweep still fires on list.

- [ ] **Step 4: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/buzz" "app/[locale]/(app)/hive/[hiveId]/word-goals" "app/[locale]/(app)/hive/[hiveId]/_components/hive-section-divider.tsx"
git commit -m "refactor(hive/buzz,word-goals): adopt unified shell + new tokens"
```

---

### Task 8: Apply shell to Submissions (list + composer + review + read)

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submissions-list.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/new/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/[submissionId]/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-composer.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-review.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-read.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-shared.tsx`

**Spec refs:** §1 anatomy (CTA replaces disabled+tooltip; composer back link "Back to submissions"; review has 2-button Approve+Reject group; read has status pill in header slot), §2 standard width, §3 forum-table sections per role-scoped group, §4 hairline section labels, §5 `--status-warning/success/error` (now defined in T1), §6 Submissions list + composer + review + read.

**Do not regress:** auto-save → router.replace dance in composer's 'new' mode (first save returns id → stash via `submissionIdRef` → `router.replace` to canonical URL); 800ms debounced `saveSubmissionDraftAction`; submit button flushes pending save → `submitSubmissionAction({id})` → toast + push to canonical URL; BETA_READER server-redirect on `/new`; review mode's Approve/Reject (Reject opens ConfirmDialog with required reviewNote textarea); read mode's status-aware metadata + APPROVED link to public reader via `createdChapterId` + REJECTED review-note display; `getSubmissionAction` positional signature unchanged.

- [ ] **Step 1: Refactor Submissions list.**

In `submissions/page.tsx`, wrap `<SubmissionsList>` in `<HivePageShell width="standard" title="Submissions" subtitle="Chapter drafts submitted for review." headerSlot={canSubmitChapter ? newSubmissionCta : undefined}>`. The `newSubmissionCta` is a brand pill `<Link href={`/${locale}/hive/${hiveId}/submissions/new`}>` styled per spec §1.

In `submissions-list.tsx`:
- Render 3 `<HiveSectionDivider>` sections (first with `hideTopBorder`): `MY DRAFTS`, `MY SUBMISSIONS`, `ALL IN THIS HIVE` (last gated on `canReviewSubmissions`).
- Each section's content is a forum-table per spec §3 (`Submission | Status | Submitted`).
- Status pill uses `<HivePill token={STATUS_TOKEN[submission.draftStatus]}>` — replace the existing `StatusPill` import path via the unified component. **Keep** the existing `STATUS_META` label map; just swap the rendering primitive.

- [ ] **Step 2: Refactor Submission composer.**

In `submissions/new/page.tsx`, the BETA_READER server-redirect stays. Wrap the `<SubmissionComposer mode="new">` in `<HivePageShell width="standard" title="New submission" subtitle="Auto-saves as you type." back={{ href: `/${locale}/hive/${hiveId}/submissions`, label: 'submissions' }} headerSlot={<SaveStatusBadge />}>`. The `SaveStatusBadge` is the composer's existing save-status indicator relocated to header slot (its state lives in the composer; pass via prop or render-prop).

For existing-submission mode (`/submissions/[id]` when DRAFT+owner), the dynamic page does the same wrap; `back` label is "submissions".

In `submission-composer.tsx`:
- Remove its own outer panel + h1 + breadcrumb. Render only title input + target-order select + TipTap editor (with their own internal hairline if structurally useful, but no inner panel chrome).
- Auto-save → router.replace dance preserved verbatim (do NOT touch the submissionIdRef logic).

- [ ] **Step 3: Refactor Submission review.**

In `submissions/[submissionId]/page.tsx`'s `canReview` branch, wrap `<SubmissionReview>` in `<HivePageShell width="standard" title={submission.title} subtitle={`Pending review from @${submitter.username}`} back={{ href: `/${locale}/hive/${hiveId}/submissions`, label: 'submissions' }} headerSlot={<ApproveRejectGroup ... />}>`.

`ApproveRejectGroup` is a 2-button flex group per spec §1: `<button>Approve</button>` (solid brand pill) + `<button>Reject</button>` (tile-gradient with destructive-tinted text using `var(--status-error)`). Reject opens the existing inline `ConfirmDialog` with the required reviewNote textarea.

In `submission-review.tsx`:
- Remove its own outer panel + back link + Approve/Reject duplicated at bottom. Body is just the metadata + read-only prose + Reject ConfirmDialog mount point.
- Keep `SubmissionMetaHeader` rendered as the first hairline section inside the page body, OR collapse its content into the panel subtitle. **Recommendation:** keep `SubmissionMetaHeader` but strip its own panel chrome; render its content as a `<HiveSectionDivider label="SUBMISSION">` section.

- [ ] **Step 4: Refactor Submission read.**

In `submissions/[submissionId]/page.tsx`'s default branch (non-DRAFT, non-PENDING-canReview), wrap `<SubmissionRead>` in `<HivePageShell width="standard" title={submission.title} subtitle={`Submitted by @${submitter.username}`} back={{ ... }} headerSlot={<HivePill token={STATUS_TOKEN[submission.draftStatus]}>{label}</HivePill>}>`.

In `submission-read.tsx`:
- Remove its own outer panel + back link.
- Render hairline-divided sections: `BODY` (read-only prose), `REVIEW NOTE` (when REJECTED with reviewNote present), `LINK` (when APPROVED with createdChapterId — the existing `ApprovedChapterLink` content).

In `submission-shared.tsx`:
- Replace the inline `StatusPill` body with `<HivePill token={'--status-' + tokenSuffix}>` mapping. Keep export so existing callers still resolve.

- [ ] **Step 5: Verify tsc clean + manual smoke (4 submission states).**

Run: `npx tsc --noEmit`. Manually verify: composer auto-save still rewrites URL on first save; submit still redirects; approve still creates the chapter; reject still requires note; read mode link to public reader still works.

- [ ] **Step 6: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/submissions"
git commit -m "refactor(hive/submissions): adopt unified shell across all 4 modes"
```

---

### Task 9: Apply shell to Suggestions

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/suggestions/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/suggestions/_components/suggestions-by-chapter.tsx`

**Spec refs:** §1 anatomy, §2 standard width, §3 card-stack inside hairline section per chapter group, §4 hairline section labels, §6 Suggestions (outer `p-6` fixes `px-2 py-2` outlier).

**Do not regress:** non-reviewer sees ComingSoon (`phase` prop); reviewer Accept calls `acceptSuggestionAction` with orphan-vs-rejected toast distinction; Reject opens inline custom Dialog (NOT shared ConfirmDialog — has no body slot) with optional reviewNote textarea; Open button deep-links to `/hive/[hiveId]/chapters/[chapterId]#sug-{id}`; "Has replies" badge preserved.

- [ ] **Step 1: Refactor page wrapper.**

In `suggestions/page.tsx`:
- Reviewer branch wraps `<SuggestionsByChapter>` in `<HivePageShell width="standard" title="Edit Suggestions" subtitle={`${totalPending} pending across ${chapterCount} chapters`}>`. No CTA in headerSlot.
- Non-reviewer branch is unchanged (`ComingSoon`).

In `suggestions-by-chapter.tsx`:
- Remove its own h1 + subtitle + `px-2 py-2` outer.
- Render each chapter group as `<HiveSectionDivider label={`CHAPTER ${num}: ${title}`}>` (first group with `hideTopBorder`).
- Inside each section, suggestions render as a card-stack (`flex flex-col gap-3`); each suggestion card uses tile-gradient chrome per spec §3.

- [ ] **Step 2: Verify tsc clean + manual smoke.**

Run: `npx tsc --noEmit`. Verify: accept/reject/open flows still fire correctly.

- [ ] **Step 3: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/suggestions"
git commit -m "refactor(hive/suggestions): adopt unified shell"
```

---

### Task 10: Apply shell to Chapters index + chapter view

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/_components/hive-chapter-index.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/hive-chapter-surface.tsx`

**Spec refs:** §1 anatomy, §2 standard width (index) + wide width (chapter view), §3 forum-table with constant-height rows, §5 `--role-*` token for viewer role pill, §6 Chapters index + chapter view.

**Do not regress (index):** server component calls `requireHiveMember` to get role + computes `canReview`; existing `Chapter` type widening + count fields; `ChapterActivityBadges` brand-yellow accent when `canReview === true`; per-row link to `/hive/[hiveId]/chapters/[chapterId]`; `isChapterReaderVisible(status)` gate for non-author; "Unavailable" defensive branch.

**Do not regress (chapter view):** read-only TipTap (`editable={false}`) with both H3 marks registered; scoped `[data-slot="hive-chapter-pane"] .ProseMirror` styling; `<SelectionPopover>` + `<CollaborationGutter>` mounted; "Written by @submitter" byline variant when chapter has non-null `authorUserId` distinct from `book.userId`; `ChapterMetadataHeader` (status + synopsis + scene planner) rendered between byline and prose; `getHiveChapterView` cross-hive escape guard.

- [ ] **Step 1: Refactor Chapters index.**

In `chapters/page.tsx`, wrap `<HiveChapterIndex>` in `<HivePageShell width="standard" title="Chapters" subtitle={`${count} chapters · ${book.title}`}>`. No CTA.

In `hive-chapter-index.tsx`:
- Remove its own h1 + subtitle + outer wrapper.
- Add a column-header strip (mono uppercase) directly inside the panel: `grid grid-cols-[40px_1fr_180px_120px] gap-3 px-6 py-2.5 bg-[var(--canvas-dark-100)]` with `border-y` `--br-card` and labels `#`, `Chapter`, `Activity`, `Updated`.
- List rows: `grid grid-cols-[40px_1fr_180px_120px] items-center gap-3 px-6 py-3 hover:bg-[var(--canvas-dark-300)]` (drop `translate-y-[-1px]`).
- Title cell holds chapter title + inline `<HivePill token={STATUS_TOKEN[chapter.status]}>` for status.
- Activity cell ALWAYS renders the `<ChapterActivityBadges>` container at fixed width; when both counts are 0, render `<span className="invisible" aria-hidden>—</span>` placeholder so row height stays constant.
- Updated cell: relative time (`relTime`).
- "Unavailable" defensive branch: keep `opacity-60`, ADD inline text `(no longer accessible)` in the Activity column slot.

- [ ] **Step 2: Refactor chapter view.**

In `chapters/[chapterId]/page.tsx`, wrap `<HiveChapterSurface>` in `<HivePageShell width="wide" title={chapter.title} subtitle={byline} back={{ href: `/${locale}/hive/${hiveId}/chapters`, label: 'chapters' }} headerSlot={<HivePill token={ROLE_TOKEN[viewerRole]}>{viewerRole}</HivePill>}>`. The `byline` is the existing variant logic from H3 T13 ("Written by @submitter — chapter contribution to {book} by @owner" when contributor differs, else default).

In `hive-chapter-surface.tsx`:
- Remove its own outer panel + back link + role pill + byline header (moved up to shell).
- First section is `<HiveSectionDivider label="METADATA" hideTopBorder>` containing `ChapterMetadataHeader` (status pill + synopsis + scene planner) — but ONLY if at least one of those three is present; else omit the section.
- Second section is the read-only TipTap canvas mounted at `px-6 pb-6` with the existing scoped `[data-slot="hive-chapter-pane"]` styling. NO `<HiveSectionDivider>` wrapper — render the canvas directly under the metadata section's bottom border.
- `<SelectionPopover>` and `<CollaborationGutter>` mounts unchanged.

- [ ] **Step 3: Verify tsc clean + manual smoke.**

Run: `npx tsc --noEmit`. Verify: row heights uniform across chapters with/without badges; click-through still works; chapter view still shows metadata + prose + popover + gutter; byline variant still fires when chapter contributor differs from book owner.

- [ ] **Step 4: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/chapters"
git commit -m "refactor(hive/chapters): adopt unified shell + constant-height rows"
```

---

### Task 11: Apply shell to Discussions (list + thread + compose modal trigger)

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussions-list.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/[postId]/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussion-thread.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussion-row.tsx`

**Spec refs:** §1 anatomy, §2 wide width, §3 forum-table for list + topic-filter chips as hairline section, §4 hairline label `FILTER`, §6 Discussions list (h1 moves INSIDE panel).

**Do not regress:** topic-pill multi-select filter; reverse-chron feed; `body.split('\n')[0].slice(0, 80)` title derivation; reply count + last-activity; `DiscussionComposeModal` (Dialog primitive); `@username ` prepend on reply button; `canEditDiscussionPost` gates edit/delete kebab; `(edited)` indicator; reply input below replies; topic CHECK constraint requires `topic` on top-level posts only.

- [ ] **Step 1: Refactor Discussions list.**

In `discussions/page.tsx`, wrap `<DiscussionsList>` in `<HivePageShell width="wide" title="Discussions" subtitle="Talk shop with your hive." headerSlot={canPostDiscussion ? newDiscussionCta : undefined}>`. The `newDiscussionCta` opens `DiscussionComposeModal`.

In `discussions-list.tsx`:
- Remove its own h1 + subtitle + outer wrapper.
- Render topic-filter chips inside `<HiveSectionDivider label="FILTER" hideTopBorder>`.
- Render the discussion list directly under as a forum-table per spec §3 (`Thread | Replies | Last activity`) inside a hairline-divided section with no label (or use a `THREADS` label for symmetry).

In `discussion-row.tsx`: layout becomes `grid grid-cols-[1fr_90px_130px] gap-3 px-6 py-3 hover:bg-[var(--canvas-dark-300)]`. Thread column: topic pill (`<HivePill token={TOPIC_TOKEN[topic]}>`) inline + title (derived) + body excerpt (`line-clamp-1 text-sm muted`). Right columns: reply count, last-activity time.

- [ ] **Step 2: Refactor Discussion thread.**

In `discussions/[postId]/page.tsx`, wrap `<DiscussionThread>` in `<HivePageShell width="wide" title={derivedTitle} subtitle={`Started by @${author.username}`} back={{ href: `/${locale}/hive/${hiveId}/discussions`, label: 'discussions' }} headerSlot={canEdit ? kebabMenu : undefined}>`. `derivedTitle` is `post.body.split('\n')[0].slice(0, 80)` per existing logic.

In `discussion-thread.tsx`:
- Remove its own outer panel + back link + title.
- First section: `<HiveSectionDivider label="ORIGINAL POST" hideTopBorder>` with the post body + author meta.
- Second section: `<HiveSectionDivider label={`${replyCount} REPLIES`}>` with the flat reply list inside.
- Third section: `<HiveSectionDivider label="REPLY">` with the reply input.

- [ ] **Step 3: Verify tsc clean + manual smoke.**

Run: `npx tsc --noEmit`. Verify: topic filter still filters; new post still creates; reply still appends; edit/delete kebab still works.

- [ ] **Step 4: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/discussions"
git commit -m "refactor(hive/discussions): adopt unified shell"
```

---

### Task 12: Apply shell to Outline index + detail + Wiki shell + entry editor + folder renderer

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/_components/outline-index.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/[outlineId]/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/_components/hive-outline-surface.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-shell.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-entry-editor.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/by-category-view.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/by-folder-view.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/notes-view.tsx`

**Spec refs:** §1 anatomy (h1 moves INSIDE panel on Outline index — was the outlier), §2 wide width for all, §3 forum-table (Outline index, Wiki folder + category drill-down lists), §4 hairline VIEW + SEARCH sections (Wiki), §6 Outline + Wiki.

**Do not regress (Outline index):** title search + 3-way sort (Recent default / A→Z / Most beats); forum-table with up to 6 deduplicated color dots in first-appearance order; beat count; relTime; empty-state branches; cross-hive escape via `getHiveOutlineByIdAction`.

**Do not regress (Outline detail):** beat sheet surface with act groups + chapter-link popover (hive-cloned variant); standalone-hive variant; BETA_READER read-only mode; drag-between-acts; per-act and ungrouped "+ Add a beat" affordances; BeatDialog flow (title + description + color palette + label) with auto-focus + Enter/Esc; legacy `status` derived migration at read time; BeatLabelBadge between title and meta; cross-hive escape guard.

**Do not regress (Wiki shell):** 3-tab view switch (By Category / By Folder / Notes); search filter; entry editor swap-in via `selectedEntryId`; back-to-list button; `+ New Entry` opens `WikiCategoryPicker`; on category pick, calls `createBinderItemAction` and lands directly in the new entry's editor; level-1 → level-2 drill-down in By Category; recursive folder tree in By Folder; flat sorted Notes grid; per-category `--wiki-*` accents preserved on all surfaces; character entry CATEGORY coercion.

- [ ] **Step 1: Refactor Outline index.**

In `outline/page.tsx`, wrap `<OutlineIndex>` in `<HivePageShell width="wide" title="Outlines" subtitle={`${count} outlines in this hive`}>`. No CTA in header (outlines are created from the studio editor side per current model).

In `outline-index.tsx`:
- Remove its own header (move h1 INSIDE panel via shell — kills the audit's "outline index outlier").
- Subtitle becomes plain Geist (not mono) — handled by shell.
- Search + sort move into a `<HiveSectionDivider label="FILTER" hideTopBorder>` section.
- List below as forum-table per existing layout (already correct shape).

- [ ] **Step 2: Refactor Outline detail.**

In `outline/[outlineId]/page.tsx`, wrap `<HiveOutlineSurface>` in `<HivePageShell width="wide" title={outline.title} subtitle={`Last edited by @${lastEditedByUsername} · ${relTime}`} back={{ href: `/${locale}/hive/${hiveId}/outline`, label: 'outlines' }} headerSlot={canEditOutline(viewerRole) ? newActCta : undefined}>`. The `newActCta` is the existing "+ New Act" trigger relocated to header slot.

In `hive-outline-surface.tsx`:
- Remove its own outer panel + back link + header (already separate file from the studio version per H2 T17 clone-not-extract).
- Render act groups directly inside the panel body.

- [ ] **Step 3: Refactor Wiki shell.**

In `wiki/page.tsx`, wrap `<HiveWikiShell>` in `<HivePageShell width="wide" title="Wiki" subtitle={`${entryCount} entries across ${folderCount} folders`} headerSlot={canEditWiki(viewerRole) ? newEntryCta : undefined}>`. The `newEntryCta` opens the existing `WikiCategoryPicker`.

In `hive-wiki-shell.tsx`:
- Remove its own h1 + subtitle + outer wrapper.
- 3-tab view switch becomes `<HiveSectionDivider label="VIEW" hideTopBorder>` with the existing tab-list inside.
- Search input becomes `<HiveSectionDivider label="SEARCH">` (omit when no entries exist).
- Active view content renders inside a third section (no label).
- When `selectedEntryId !== null`, the shell swaps in `<HiveWikiEntryEditor>` instead — keep this state-machine intact.

In `hive-wiki-entry-editor.tsx`:
- Remove its own outer wrapper + back link.
- Re-mount inside the panel body. Above the editor body, render the existing category breadcrumb + tag chips as a `<HiveSectionDivider label="META" hideTopBorder>` section.
- The shell's back link uses the `back` prop of `<HivePageShell>` when this view is mounted — pass `back={{ href: ..., label: 'wiki' }}` at the wiki page level conditioned on `selectedEntryId`.

By-category-view, by-folder-view, notes-view: drop their own wrappers; render as the active view's content per spec §3 (card-stack inside the panel body).

- [ ] **Step 4: Verify tsc clean + manual smoke.**

Run: `npx tsc --noEmit`. Verify: outline index search + sort; outline detail drag + BeatDialog + chapter link; wiki tab switch + search + category drill-down + entry editor + notes view; back-to-wiki from entry editor.

- [ ] **Step 5: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/outline" "app/[locale]/(app)/hive/[hiveId]/wiki"
git commit -m "refactor(hive/outline,wiki): adopt unified shell"
```

---

### Task 13: Modal bug sweep — `new-goal-modal.tsx`

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/new-goal-modal.tsx`

**Why:** Spec §6 Word Goals + AGENTS.md long-known follow-up: `disabled={type !== 'TOTAL' && false}` is always false (compound boolean with literal `false` short-circuits). The intent was almost certainly "disable the start-date input when type is something specific." Investigate the intent and fix.

- [ ] **Step 1: Read the modal to confirm the bug location and intent.**

Run: open `new-goal-modal.tsx`. Find the `disabled={type !== 'TOTAL' && false}` expression. Read 20 lines of surrounding context to figure out which input the prop is on and what the author likely meant.

- [ ] **Step 2: Determine the fix.**

Two likely intents:
- **Option A:** The author meant `disabled={type === 'TOTAL'}` (disable start-date for TOTAL goals — but the codebase's `WordGoalType` is `DAILY | WEEKLY | MONTHLY | CUSTOM` per H4 T1; there is no TOTAL type, so this is a dead branch from an abandoned design).
- **Option B:** Remove the `disabled` prop entirely since the dead branch never fires.

**Recommendation:** Option B. Remove the prop. Add an explanatory comment if the surrounding code suggests intent.

- [ ] **Step 3: Apply the fix.**

Remove the `disabled={type !== 'TOTAL' && false}` prop. If the surrounding code references `'TOTAL'` elsewhere, sweep those references too.

- [ ] **Step 4: Verify tsc clean + manual smoke.**

Run: `npx tsc --noEmit`. Open the modal, confirm the start-date input still behaves correctly (it should always be enabled).

- [ ] **Step 5: Commit.**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/word-goals/_components/new-goal-modal.tsx"
git commit -m "fix(hive/word-goals): remove always-false disabled expression"
```

---

### Task 14: Manual smoke + AGENTS.md update + ship

**Files:**
- Modify: `AGENTS.md` (Resume Here block)

**Why:** Spec §8 18-page smoke checklist gets walked here; AGENTS.md captures the ship for future sessions.

- [ ] **Step 1: Run the 18-page smoke checklist from spec §8.**

For each of the 18 pages, verify the 8 criteria from spec §8: (a) back link presence; (b) h1 inside panel as Comfortaa brand-yellow; (c) subtitle plain Geist muted; (d) primary CTA is solid brand pill iff present; (e) max-width matches the §2 tier; (f) outer padding is `p-6`; (g) sub-panels eliminated; (h) pills are alpha-tint shape with correct token family.

If any item fails, file a `fix(hive/ui): ...` follow-up commit before continuing.

- [ ] **Step 2: Run the full test suite + tsc.**

```bash
npm test
npx tsc --noEmit
```

Expected: 438/438 tests green; tsc clean. (Token additions and presentation refactors shouldn't touch any tested code.)

- [ ] **Step 3: Update AGENTS.md "Resume Here" block.**

Bump `Last updated` to today (2026-06-03 or current). Add a "Current focus" paragraph describing the ship: "Hive routes unified UI fix pass shipped — every hive page now wears the locked anatomy from [spec link]. 14 task SHAs: T1 [sha] tokens, T2 [sha] HivePageShell, T3 [sha] HivePill, T4 [sha] HiveSectionDivider, T5–T12 per-page apply commits, T13 modal bug sweep, T14 ship. Phase 2 (Claude Design handoff prompt) is now unblocked — fill Appendix A's `[insert §2 + §6 specifics]` placeholder with the page-by-page table verbatim from the spec." Move the prior focus paragraph into a `LEGACY-HIVE-UI-FOCUS-END -->` block per the file's convention.

Set `Next concrete step` to: "Chris reviews the smoke result. If pass, generate the Claude Design handoff prompt by filling Appendix A. If smoke surfaces issues, file fix(hive/ui) follow-ups."

- [ ] **Step 4: Commit.**

```bash
git add AGENTS.md
git commit -m "docs(agents): record hive routes unified UI fix pass ship"
```

- [ ] **Step 5: Push to GitHub.**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Implementing task(s) |
|---|---|
| §1 Page anatomy | T2 (HivePageShell), applied in T5–T12 |
| §2 Max-width tiers | T2 (width prop), applied in T5–T12 |
| §3 List chrome (forum-table) | T6 (Members), T8 (Submissions), T10 (Chapters), T11 (Discussions), T12 (Outline index) |
| §3 List chrome (card-stack) | T7 (Buzz, Word Goals), T9 (Suggestions), T12 (Wiki views) |
| §4 No sub-panels | T4 (HiveSectionDivider), applied in T5–T12 |
| §5 Pill convention | T3 (HivePill), applied in T6 (roles), T7 (goals), T8 (statuses), T10 (status + role), T11 (topics) |
| §5 New tokens | T1 (`--status-warning/success/error` + `--role-*` + `--goal-*`) |
| §6 Chapters index row layout | T10 step 1 (fixed-width activity slot + invisible placeholder) |
| §6 Chapter view metadata | T10 step 2 (metadata section inline) |
| §6 Buzz derived title | T7 step 1 (`deriveTitleAndExcerpt` helper) |
| §6 Suggestions p-6 padding | T9 step 1 |
| §6 Word Goals --goal-* tokens | T7 step 2 (GOAL_TOKEN map) |
| §6 Submissions composer auto-save preserved | T8 step 2 "do not regress" + auto-save dance verbatim |
| §6 new-goal-modal disabled bug | T13 |
| §7 Implementation phasing | This plan IS §7's expansion |
| §8 Smoke checklist | T14 step 1 |

No gaps.

**Placeholder scan:** No "TBD"/"TODO"/"similar to" patterns. Code shown for shared primitives (T1–T4); per-page tasks reference the spec sections + show concrete maps + flag specific do-not-regress affordances. The smoke checklist is verbal (per spec §8) — that's the test posture per project convention (manual smoke, no new unit tests).

**Type consistency check:**
- `HivePillProps.token: string` accepts any CSS custom-property name; all callers pass `--status-*` / `--role-*` / `--goal-*` / `--topic-*` / `--layer-*` — all valid CSS values.
- `HivePageShellProps.width: 'standard' | 'wide'` consumed everywhere via `width="standard"` or `width="wide"` — matches.
- `HiveSectionDividerProps.tone: 'muted' | 'danger'` only consumed by T6 Settings danger zone — matches.
- `hideTopBorder` prop is added to `<HiveSectionDivider>` in T7 step 2 (as an additive change to T4's component). All callers using `hideTopBorder` (T7, T8, T9, T10, T11, T12) reference the prop after T7 adds it — sequential-task ordering is correct.
- `STATUS_TOKEN`, `ROLE_TOKEN`, `GOAL_TOKEN`, `TOPIC_TOKEN` maps are defined per consuming file; no cross-file type sharing required.

Fixed inline: T7 step 2 adds the `hideTopBorder` prop to the T4 component file. Sequential task ordering means tasks executed in order won't trip on the prop being undefined.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-03-hive-routes-unified-ui.md`.**
