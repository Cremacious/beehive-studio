# Book Creation Wizard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Draft
**Date:** 2026-06-01
**Scope:** The 4-step new-book wizard at `/[locale]/studio/new` — chrome, copy, layout, and the cover-image field. The shared `<SharingControls>` component used by both the wizard's Step 4 AND `/studio/[bookId]/details` is re-skinned once; both consumers inherit.

**Goal:** Re-skin every wizard surface (stage panel, progress bar, step header, fields, footer, cover dropzone, Sharing controls) to the aesthetic established by the editor refresh, add multi-sentence helper text + clickable example chips per the spec, and replace the URL-only cover field with a file-drop + URL hybrid — without removing any existing affordance or changing the 4-step structure.

**Architecture:** The existing `BookCreationForm` orchestrator stays — internal state, `update()`, `goNext()`, `goBack()`, `jumpTo()`, `step-enter-forward` / `step-enter-back` animations are all preserved. T1 reshapes the orchestrator's stage chrome + progress bar in place. T2 lands a shared `<StepHeader>` presentational helper. T3 lands shared field components (`<WizardField>`, `<HelperText>`, `<ExampleChips>`) all driven by editor-refresh tokens. T4-T8 re-skin one step (or the shared cover picker) per task. T9 cleans up the footer + per-step Next-button copy. T10 walks the feature-integrity + a11y checklist. T11 lands the AGENTS.md write-up + ship commit. **Presentation-first** with three small structural additions: cover dropzone, helper-text blocks, and example chips.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (CSS variables), shadcn/ui primitives, lucide-react (existing icons + `UploadCloud`), `useCloudinaryUpload` hook (existing). Tests: vitest (424+ existing; must stay green).

**Reference precedents (tone, granularity, code-block density):**
- [`docs/superpowers/plans/2026-06-01-editor-aesthetic-refresh.md`](2026-06-01-editor-aesthetic-refresh.md) — 1764-line presentation-refresh plan; closest tonal precedent for this work.
- [`docs/superpowers/plans/2026-05-29-h2-mirror-model.md`](2026-05-29-h2-mirror-model.md) — multi-task per-step refactor precedent.

**Spec:** [`docs/superpowers/specs/2026-06-01-book-creation-wizard-redesign-design.md`](../specs/2026-06-01-book-creation-wizard-redesign-design.md)
**Design-system spec it inherits:** [`docs/superpowers/specs/2026-06-01-editor-aesthetic-refresh-design.md`](../specs/2026-06-01-editor-aesthetic-refresh-design.md)
**Mockup (Step 1 visual target; Steps 2-4 inherit chrome):** [`.superpowers/brainstorm/33950-1780351986/content/wizard-step1-v2.html`](../../../.superpowers/brainstorm/33950-1780351986/content/wizard-step1-v2.html)

---

## Approach

Presentation refresh + three small structural additions. No new database columns. No new server actions. No new design tokens — every value comes from the editor-refresh tokens shipped in `app/globals.css` (`--canvas-dark-100/150/200/250/300/350`, `--canvas-dark-ink/-ink-muted/-ink-strong`, `--brand`, `--brand-ink`, `--brand-soft`, `--brand-hover`, `--r-card`, `--r-row`, `--r-btn`, `--r-pill`, `--sh-card`, `--sh-tile`, `--sh-inset`, `--br-card`, `--font-display`, `--font-mono`, `--font-prose`).

The three structural additions:

1. **Cover dropzone** — replaces the URL-only cover field. Drag-and-drop OR click-to-browse, wired to the existing `useCloudinaryUpload('covers')` hook (same hook the `/studio/[bookId]/details` page already uses). URL input remains below the dropzone.
2. **Helper text** — every field gains a 1-3-sentence explanation per the spec.
3. **Example chips** — clickable serif-italic chips that fill the input on click. New `<ExampleChips>` component.

The `<SharingControls>` re-skin is the one shared-component change — `components/book/sharing-controls.tsx` is consumed by both the wizard's Step 4 AND `/studio/[bookId]/details`. Re-skinning the file once cascades to both surfaces; T8 explicitly verifies the Details page still renders correctly after the re-skin.

Existing animation classes (`step-enter-forward`, `step-enter-back`) are preserved verbatim — they live in the `<style>` block at the bottom of `book-creation-form.tsx` and stay untouched.

---

## Pre-flight Findings

Verified by direct reads against `main` at HEAD = `0d216f8`.

### A. Design system tokens are already shipped

The editor refresh plan (commit landed earlier in the same epic) added all required tokens to `app/globals.css` `:root`: the canvas-dark mid-stops (`-150`/`-250`/`-350`/`-400`), the radius scale (`--r-card` 20px, `--r-row` 14px, `--r-btn` 12px, `--r-pill` 999px), and the depth system (`--sh-card`, `--sh-tile`, `--sh-inset`, `--br-card`). This plan **adds no tokens** — every value comes from that existing set. The spec calls out one derived value scoped to textareas only: `oklch(0.245 0.003 256)` (one stop lighter than `--canvas-dark-100`). This stays inline in the wizard for now; if a second consumer needs it, promote to `--textarea-bg` in `globals.css` as a follow-up (noted in T4).

### B. Live progress bar lives INSIDE `book-creation-form.tsx` — `wizard-progress.tsx` is stale

The brainstorm pre-flight assumed `wizard-progress.tsx` was the live component. It isn't. `app/[locale]/(app)/studio/_components/create-book-wizard/wizard-progress.tsx` is a stale 3-step component (lines 1-36) with zero callers in the live codebase. The live 4-step progress bar is inlined in `book-creation-form.tsx` lines 154-259 (header + pill row + Close X). T1 re-skins the inline header in place. **The stale `wizard-progress.tsx` file is deleted in T1's commit as cleanup** (no callers — verified via grep `WizardProgress` returning only its own definition file).

### C. Existing `useCloudinaryUpload('covers')` hook is fully client-wirable

The hook at `hooks/use-cloudinary-upload.ts` (lines 1-43) POSTs directly to the Cloudinary unsigned upload endpoint (`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`) using the `beehive_covers` upload preset. It's already used by `app/[locale]/(app)/studio/[bookId]/details/_components/book-details-form.tsx` (line 235) and by the *current* `step-one.tsx` URL-only field (line 23). No server action is needed for the cover dropzone — T5 just calls `upload(file)`. Free-tier quota / premium gating is **not** currently exposed by the hook; the spec defers premium-gating on uploads ("if there's a free-tier image quota, surface the limit copy inline … if none, defer"). T5 defers per spec.

### D. The `<SharingControls>` component is shared between the wizard and the Details page

`components/book/sharing-controls.tsx` is consumed by:
1. `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` (wizard Step 4, lines 376-389).
2. `app/[locale]/(app)/studio/[bookId]/details/_components/book-details-form.tsx` (Sharing section).

Re-skinning the file once in T8 updates BOTH surfaces. T8 acceptance explicitly verifies the Details page Sharing section still renders correctly after the re-skin (manual smoke on `/studio/[bookId]/details`).

### E. Existing animations are preserved verbatim

`step-enter-forward` / `step-enter-back` keyframes + classes live in a `<style>` block at the bottom of `book-creation-form.tsx` (lines 434-448). The orchestrator already keys the step viewport with `key={step}` so each step swap triggers a fresh animation. T1 keeps the `<style>` block untouched; the per-step direction state (`'forward' | 'back'`) and the `animClass` variable are preserved.

### F. The wizard imports `StepOne`/`StepTwo`/`StepThree` from `studio/_components/create-book-wizard/`

The wizard orchestrator at `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` imports its 3 step components from `app/[locale]/(app)/studio/_components/create-book-wizard/`. Step 4 is rendered inline inside the orchestrator (no separate `step-four.tsx` file) — it renders `<SharingControls>` directly. T8 re-skins this inline block in place; no new file added unless the orchestrator gets too large (judgment call deferred to T8's subagent).

---

## Tasks (T1-T11)

No database changes. No new server actions. No new tests beyond a visual smoke. The plan is small files, presentation-heavy.

---

### Task 1: Stage shell + progress bar refresh

**Files:**
- Modify: `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` (outer shell + header + step viewport wrapper + footer wrapper).
- Delete: `app/[locale]/(app)/studio/_components/create-book-wizard/wizard-progress.tsx` (stale 3-step component, zero callers — verified in pre-flight B).

**Surfaces changed:**
- Page background → unchanged (`#262728` via `--canvas-dark-50` shipped earlier).
- Stage panel (new wrapper around step header + form body + footer) → `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))` + `border-radius: var(--r-card)` (20px) + `box-shadow: var(--sh-card)` + `border: var(--br-card)`.
- Stage max-width → **1040px**, centered, page padding 28px.
- Progress bar → 4 pills in a row, each with the new pill chrome:
  - Idle: `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `var(--sh-tile)` + `color: var(--canvas-dark-ink-muted)` + 18px tile-style number circle.
  - Active: `background: var(--brand)` + `color: var(--brand-ink)` + brand-ink number circle.
  - Done (step > n): `background: var(--brand)` + `color: var(--brand-ink)` + check icon (lucide `Check`) instead of the number.
- 1px hairline separators between pills.
- Each pill is a `<button>` with `aria-current="step"` on the active one, `aria-label="Step N: {LABEL}"`, and forward-jump gated by step-1 title validation.
- Close X button → top-right of stage, `border-radius: var(--r-pill)`, `box-shadow: var(--sh-tile)`.

- [ ] **Step 1: Replace the outer `<div>` and `<header>` chrome**

Replace the orchestrator's outer flex container + the inline header with a stage panel. The `<style>` block at the bottom of the file stays untouched (preserves `step-enter-forward` / `step-enter-back`).

```tsx
return (
  <div
    className="min-h-screen w-full flex flex-col"
    style={{
      background: 'var(--canvas-dark-50, #141414)',
      color: 'var(--canvas-dark-ink-strong)',
      padding: '28px',
    }}
  >
    <div
      className="mx-auto w-full flex flex-col"
      style={{
        maxWidth: '1040px',
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
    >
      {/* progress bar (Step 2) */}
      {/* step viewport (Step 3) */}
      {/* footer reassurance (existing) */}
    </div>

    <style>{/* existing keyframes untouched */}</style>
  </div>
)
```

- [ ] **Step 2: Re-skin the progress bar in place**

Replace the existing pill row (current file lines ~163-242) with the new pill pattern. Use lucide `Check` for the done state.

```tsx
<div
  className="flex items-center gap-2 px-6 py-[18px]"
  style={{ borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}
>
  {([1, 2, 3, 4] as const).map((n, i) => {
    const isActive = step === n
    const isDone = step > n
    const isReached = step >= n
    return (
      <div key={n} className="flex items-center gap-2 flex-1">
        {i > 0 && (
          <div
            style={{
              height: '1px',
              flex: 1,
              background: isReached ? 'var(--brand)' : 'oklch(1 0 0 / 0.06)',
              transition: 'background 0.25s',
            }}
          />
        )}
        <button
          type="button"
          onClick={() => isReached && jumpTo(n)}
          disabled={!isReached}
          aria-current={isActive ? 'step' : undefined}
          aria-label={`Step ${n}: ${STEP_LABELS[n - 1]}`}
          className="inline-flex items-center gap-2 px-3 py-1.5"
          style={{
            borderRadius: 'var(--r-pill)',
            background: isActive || isDone
              ? 'var(--brand)'
              : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            color: isActive || isDone
              ? 'var(--brand-ink)'
              : 'var(--canvas-dark-ink-muted)',
            boxShadow: isActive || isDone ? 'none' : 'var(--sh-tile)',
            cursor: isReached ? 'pointer' : 'default',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: '18px',
              height: '18px',
              borderRadius: 'var(--r-pill)',
              background: isActive || isDone
                ? 'var(--brand-ink)'
                : 'var(--canvas-dark-100)',
              color: isActive || isDone ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '10px',
            }}
          >
            {isDone ? <Check size={11} strokeWidth={3} /> : n}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {STEP_LABELS[n - 1]}
          </span>
        </button>
      </div>
    )
  })}

  <Link
    href={`/${locale}/studio`}
    aria-label="Cancel and return to studio"
    className="inline-flex items-center justify-center ml-3"
    style={{
      width: '32px',
      height: '32px',
      borderRadius: 'var(--r-pill)',
      boxShadow: 'var(--sh-tile)',
      background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
      color: 'var(--canvas-dark-ink-muted)',
    }}
  >
    <X size={14} />
  </Link>
</div>
```

`STEP_LABELS` becomes `['Basics', 'Discovery', 'Structure', 'Sharing'] as const` per the spec (was "The Basics" — minor copy refresh).

- [ ] **Step 3: Re-wrap the step viewport + footer reassurance**

The step viewport (`<div className="flex-1 relative overflow-hidden">`) and the bottom reassurance line stay structurally — they get padding adjustments to match the spec (36px sides, 26px top, 18px bottom for the form area). Inner `mx-auto` max-width container stays but widens to 1040px-minus-padding-effective.

The per-step `<div style={{ background: ..., border: ..., borderRadius: 16px ... }}>` wrapper at lines ~320-326 is REMOVED — the stage panel itself is now the chrome, so the inner step content sits flush.

- [ ] **Step 4: Delete stale `wizard-progress.tsx`**

```bash
git rm "app/[locale]/(app)/studio/_components/create-book-wizard/wizard-progress.tsx"
```

Verify no callers first via Grep on `WizardProgress`; expected single match in the file itself.

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T1 — stage shell + progress bar refresh"
```

**Acceptance criteria:**
- Page is centered 1040px stage panel on a `#262728` background with 28px outer padding.
- Stage panel uses `--canvas-dark-250` → `-200` vertical gradient, `--r-card` radius, `--sh-card` shadow, `--br-card` hairline border.
- Progress bar has 4 pills with idle/active/done states matching the spec. Active pill has `aria-current="step"`.
- Done pills show a lucide `Check` icon instead of the number.
- Each pill is clickable to jump back; forward jumps still gated by step-1 title validation.
- Close X is top-right inside the stage, pill-radius, tile shadow.
- Step labels read `Basics / Discovery / Structure / Sharing`.
- `step-enter-forward` / `step-enter-back` animations still fire on step swap.
- `wizard-progress.tsx` is deleted.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 1 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Re-skin the stage shell and progress bar inside `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx`. The orchestrator's state (step, direction, form, submit logic) and the bottom `<style>` block with `step-enter-forward`/`step-enter-back` keyframes must be preserved verbatim — only the chrome around them changes. Update `STEP_LABELS` to `['Basics','Discovery','Structure','Sharing']`. Delete the stale `wizard-progress.tsx` after confirming it has no callers via grep. Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T1 — stage shell + progress bar refresh`.
>
> Read the spec section "Stage Layout" + "Progress bar" for the exact token assignments before writing code. The 4-step structure, `jumpTo` behavior, and the forward-jump validation gate on step 1 title all stay. The `<header>` is no longer a separate flex band — the progress bar lives at the top of the stage panel itself.

---

### Task 2: Shared `<StepHeader>` component

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/step-header.tsx`.
- Modify: `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` (the per-step header block currently inlined at lines ~279-318 moves into this component).

**Surfaces changed:**
- Three stacked lines per step:
  1. **Eyebrow** — `STEP N OF 4` in `var(--font-mono)` uppercase, 10px, letter-spacing 0.12em, `color: var(--canvas-dark-ink-muted)`.
  2. **Headline** — `var(--font-display)` (Comfortaa) bold, 24px, `color: var(--brand)`.
  3. **Lede** — 13px, `var(--canvas-dark-ink-muted)`, max-width 620px. Trailing reassurance phrase rendered as bold ink-strong via a `<strong>` child in the lede string.

- [ ] **Step 1: Author the component**

```tsx
// app/[locale]/(app)/studio/_components/create-book-wizard/step-header.tsx
import type { ReactNode } from 'react'

type Props = {
  step: 1 | 2 | 3 | 4
  total: number
  headline: string
  lede: ReactNode
}

export function StepHeader({ step, total, headline, lede }: Props) {
  return (
    <div
      style={{
        padding: '26px 36px 18px',
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.12em',
          color: 'var(--canvas-dark-ink-muted)',
          marginBottom: '10px',
        }}
      >
        Step {step} of {total}
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: 700,
          letterSpacing: '-0.015em',
          margin: 0,
          color: 'var(--brand)',
          textWrap: 'balance' as const,
        }}
      >
        {headline}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          lineHeight: 1.55,
          marginTop: '10px',
          maxWidth: '620px',
          color: 'var(--canvas-dark-ink-muted)',
          textWrap: 'pretty' as const,
        }}
      >
        {lede}
      </p>
    </div>
  )
}
```

The `lede` prop is `ReactNode` so callers can pass `<>A few quick details so we can set up your book. <strong style={{ color: 'var(--canvas-dark-ink-strong)', fontWeight: 600 }}>You can change any of this later.</strong></>` — that's how the trailing reassurance gets the bold treatment per the spec.

- [ ] **Step 2: Wire it into the orchestrator**

Replace the inlined step-header block in `book-creation-form.tsx` (current lines ~279-318) with a single `<StepHeader>` call. Update copy per the spec:

```ts
const STEP_HEADLINES = [
  "Let's start with the basics.",
  "How will readers find this book?",
  "Pick a starting structure.",
  "Who should see this book?",
] as const

const STEP_LEDES: ReactNode[] = [
  <>A few quick details so we can set up your book. <strong style={REASSURE}>You can change any of this later.</strong></>,
  <>Tags and comp titles help readers discover your book on /discover. You can come back to any of this whenever.</>,
  <>We'll create the binder for you. <strong style={REASSURE}>You can rearrange or rename anything later.</strong></>,
  <>Most writers start private and switch later — pick what feels right today.</>,
]

const REASSURE = { color: 'var(--canvas-dark-ink-strong)', fontWeight: 600 } as const
```

`STEP_SUBHEADS` is deleted.

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T2 — shared StepHeader component"
```

**Acceptance criteria:**
- New file `step-header.tsx` exists and exports `<StepHeader />`.
- Orchestrator renders one `<StepHeader>` per step with the spec-correct headline + lede.
- Headline is brand-yellow Comfortaa 24px bold.
- Lede max-width is 620px and the reassurance phrase is bold + ink-strong.
- Padding around the header is 26px top / 36px sides / 18px bottom.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 2 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Create `app/[locale]/(app)/studio/_components/create-book-wizard/step-header.tsx` per the spec. Wire it into `book-creation-form.tsx` replacing the existing inlined headline + subhead block. Delete the now-unused `STEP_SUBHEADS` constant. Use the exact headline + lede strings from the spec — DO NOT paraphrase. The reassurance phrase ("You can change any of this later.", "You can rearrange or rename anything later.") must be wrapped in `<strong>` with inline style `color: var(--canvas-dark-ink-strong); font-weight: 600;`. Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T2 — shared StepHeader component`.

---

### Task 3: Shared field components (`<WizardField>`, `<HelperText>`, `<ExampleChips>`)

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/wizard-field.tsx` (exports `<WizardField>`, `<HelperText>`, `<ExampleChips>` from a single file).

**Surfaces / patterns introduced:**
- `<WizardField>` is a label-wrapper that renders the `<label>` row with required asterisk OR optional marker. Takes `label`, `required` (default false), `optionalMarker` (string like `"optional"` or `"optional · up to 5"`), and children.
- `<HelperText>` is a `<p>` rendering 12px ink-muted text with `aria-describedby` wiring (caller passes an `id`). Supports inline `<strong>` for the spec's "examples in bold inline" pattern.
- `<ExampleChips>` is a button strip with a mono uppercase "try one:" prefix label and N italic-serif chips. Click fires `onPick(value)`.

All three share the editor-refresh tokens:
- Recessed input bg → `background: var(--canvas-dark-100)`.
- Recessed input border → `1px solid oklch(1 0 0 / 0.06)`.
- Input radius → `var(--r-row)` (14px).
- Focus ring → `box-shadow: 0 0 0 3px oklch(from var(--brand) l c h / 0.18)` + brand border.
- Required asterisk → `color: var(--brand)`.
- Optional marker → `var(--font-mono)`, 10px, uppercase, letter-spacing 0.08em, `color: var(--canvas-dark-ink-muted)`.
- Label → `var(--font-display)`, 13px, weight 600, `color: var(--canvas-dark-ink-strong)`.
- Example chip → tile gradient (`linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`) + `var(--sh-tile)` + `var(--r-pill)` + `var(--font-prose)` italic 12.5px.
- "try one:" prefix → `var(--font-mono)`, 9.5px, uppercase, letter-spacing 0.1em, `color: var(--canvas-dark-ink-muted)`.

NOTE: The components are presentational; the underlying `<input>` / `<textarea>` element is provided by the caller. `<WizardField>` is a label+helper wrapper, not an input.

- [ ] **Step 1: Author `wizard-field.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'

type WizardFieldProps = {
  label: string
  required?: boolean
  optionalMarker?: string
  helperId?: string
  children: ReactNode
}

export function WizardField({ label, required, optionalMarker, children }: WizardFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--brand)', marginLeft: 4 }}>*</span>}
        </label>
        {optionalMarker && (
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            {optionalMarker}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

type HelperTextProps = {
  id?: string
  children: ReactNode
}

export function HelperText({ id, children }: HelperTextProps) {
  return (
    <p
      id={id}
      style={{
        fontSize: '12px',
        lineHeight: 1.5,
        color: 'var(--canvas-dark-ink-muted)',
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

type ExampleChipsProps = {
  examples: string[]
  onPick: (value: string) => void
  ariaLabelPrefix?: string
}

export function ExampleChips({ examples, onPick, ariaLabelPrefix = 'Use example' }: ExampleChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      <span
        className="uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.1em',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        try one:
      </span>
      {examples.map(ex => (
        <button
          key={ex}
          type="button"
          onClick={() => onPick(ex)}
          aria-label={`${ariaLabelPrefix}: ${ex}`}
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            borderRadius: 'var(--r-pill)',
            padding: '4px 12px',
            fontFamily: 'var(--font-prose)',
            fontStyle: 'italic',
            fontSize: '12.5px',
            color: 'var(--canvas-dark-ink)',
            cursor: 'pointer',
            transition: 'transform 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {ex}
        </button>
      ))}
    </div>
  )
}
```

The shared "recessed input" styling is exposed as an exported const so step components can apply it consistently:

```tsx
export const RECESSED_INPUT_STYLE = {
  background: 'var(--canvas-dark-100)',
  border: '1px solid oklch(1 0 0 / 0.06)',
  borderRadius: 'var(--r-row)',
  padding: '10px 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  color: 'var(--canvas-dark-ink-strong)',
  width: '100%',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
} as const

// Caller adds: onFocus={recessFocus} onBlur={recessBlur}
export function recessFocus(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 3px oklch(from var(--brand) l c h / 0.18)'
  e.currentTarget.style.borderColor = 'var(--brand)'
}
export function recessBlur(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.boxShadow = 'none'
  e.currentTarget.style.borderColor = 'oklch(1 0 0 / 0.06)'
}
```

The textarea variant of `RECESSED_INPUT_STYLE` is identical except `background: 'oklch(0.245 0.003 256)'` (the one-stop-lighter derived value the spec calls out). Exported as `RECESSED_TEXTAREA_STYLE`. **Followup note (encoded in T11's AGENTS.md write-up):** if a second consumer needs this value, promote to `--textarea-bg` in `globals.css`.

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T3 — shared field components (WizardField, HelperText, ExampleChips)"
```

**Acceptance criteria:**
- New file `wizard-field.tsx` exports `WizardField`, `HelperText`, `ExampleChips`, `RECESSED_INPUT_STYLE`, `RECESSED_TEXTAREA_STYLE`, `recessFocus`, `recessBlur`.
- Required asterisk renders in brand-yellow.
- Optional marker renders in mono uppercase 10px ink-muted.
- Example chip strip has "try one:" mono prefix + italic-serif chips with tile gradient + pill radius.
- Chips are real `<button>` elements with `aria-label`.
- No step components are wired yet — they consume in T4-T8.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 3 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Create `app/[locale]/(app)/studio/_components/create-book-wizard/wizard-field.tsx` with the exports listed in the plan. Do NOT touch any step component yet — they consume these in T4-T8. The components are presentational only; no state. Use inline-style approach for the focus/blur ring (matches the editor refresh's pattern of inline style for token-driven chrome). Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T3 — shared field components (WizardField, HelperText, ExampleChips)`.

---

### Task 4: Step 1 Basics — text fields side (right column)

**Files:**
- Modify: `app/[locale]/(app)/studio/_components/create-book-wizard/step-one.tsx` (right-column re-skin; cover side handled in T5).

**Surfaces changed:**
- Outer container becomes a 2-column grid: `gridTemplateColumns: '260px 1fr', gap: '22px'` (left column is the cover area added in T5; until T5 lands, the left column renders a placeholder `<div />` to preserve the grid).
- Right column gap between fields → 18px.
- Title field:
  - `<WizardField label="Title" required>` (no optional marker).
  - `<HelperText>` per spec: "What's this book called? A working title is fine — you can change it any time. It'll appear on your bookshelf and at the top of every chapter."
  - Recessed input with `RECESSED_INPUT_STYLE` + `recessFocus` / `recessBlur`.
  - `<ExampleChips>` below input with 3 chips: `"'The Last Glassblower'"`, `"'Tideborn'"`, `"'Untitled Project'"` — click fills the input.
  - Error state preserved: red border + 12px red error message below.
- Subtitle field:
  - `<WizardField label="Subtitle" optionalMarker="optional">`.
  - `<HelperText>` per spec (use `<strong>` for the two bold-inline examples): `Sometimes a subtitle tells the reader exactly what they're picking up — <strong>'A Novel of the Saltwater Coast'</strong>, <strong>'Book One of the Lantern Cycle'</strong>. Skip if not sure.`
  - Recessed input.
- Synopsis field:
  - `<WizardField label="Synopsis" optionalMarker="optional · up to 500 words">`.
  - `<HelperText>` per spec: "Two or three sentences — the back-of-the-book pitch. Even rough notes work; this is for you, and you can edit it later."
  - Recessed textarea with `RECESSED_TEXTAREA_STYLE`. `min-height: 130px`. `resize: 'vertical'`. `fontFamily: 'var(--font-prose)'` (Newsreader). `fontSize: '15px'`. `lineHeight: 1.55`.

The character count `{synopsis.length}/2000` line stays (functional affordance; preserved per "NO removal").

- [ ] **Step 1: Re-shape the component**

Replace the existing field stack with the new grid + shared components. Cover-side left column is a placeholder for now (T5 fills it):

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '22px' }}>
  <div data-cover-placeholder /> {/* T5 fills */}
  <div className="flex flex-col gap-[18px]">
    <WizardField label="Title" required>
      <HelperText id="title-help">
        What's this book called? A working title is fine — you can change it any time.
        It'll appear on your bookshelf and at the top of every chapter.
      </HelperText>
      <input
        type="text"
        value={title}
        autoFocus
        aria-describedby="title-help"
        onChange={e => onUpdate({ title: e.target.value })}
        onFocus={recessFocus}
        onBlur={recessBlur}
        style={{
          ...RECESSED_INPUT_STYLE,
          ...(titleError ? { borderColor: 'oklch(0.62 0.21 25)' } : {}),
        }}
      />
      {titleError && (
        <p style={{ fontSize: 12, color: 'oklch(0.62 0.21 25)', marginTop: 4 }}>{titleError}</p>
      )}
      <ExampleChips
        examples={["'The Last Glassblower'", "'Tideborn'", "'Untitled Project'"]}
        onPick={value => onUpdate({ title: value.replace(/^'|'$/g, '') })}
        ariaLabelPrefix="Use title"
      />
    </WizardField>

    <WizardField label="Subtitle" optionalMarker="optional">
      <HelperText id="subtitle-help">
        Sometimes a subtitle tells the reader exactly what they're picking up —{' '}
        <strong>'A Novel of the Saltwater Coast'</strong>, <strong>'Book One of the Lantern Cycle'</strong>.
        Skip if not sure.
      </HelperText>
      <input
        type="text"
        value={subtitle}
        aria-describedby="subtitle-help"
        onChange={e => onUpdate({ subtitle: e.target.value })}
        onFocus={recessFocus}
        onBlur={recessBlur}
        style={RECESSED_INPUT_STYLE}
      />
    </WizardField>

    <WizardField label="Synopsis" optionalMarker="optional · up to 500 words">
      <HelperText id="synopsis-help">
        Two or three sentences — the back-of-the-book pitch. Even rough notes work;
        this is for you, and you can edit it later.
      </HelperText>
      <textarea
        value={synopsis}
        aria-describedby="synopsis-help"
        rows={5}
        maxLength={2000}
        onChange={e => onUpdate({ synopsis: e.target.value })}
        onFocus={recessFocus}
        onBlur={recessBlur}
        style={{
          ...RECESSED_TEXTAREA_STYLE,
          minHeight: 130,
          resize: 'vertical' as const,
          fontFamily: 'var(--font-prose)',
          fontSize: 15,
          lineHeight: 1.55,
        }}
      />
      <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', textAlign: 'right' as const, margin: 0 }}>
        {synopsis.length}/2000
      </p>
    </WizardField>
  </div>
</div>
```

- [ ] **Step 2: Strip the old field/label constants**

Delete the `field` and `label` string constants at the top of `step-one.tsx` (lines 6-7) — they're replaced by the shared components.

- [ ] **Step 3: Footer-button block stays in T9**

Leave the existing Cancel + Next button row at the bottom of step-one.tsx untouched for now — T9 reshapes all footers together.

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T4 — step 1 basics (right column text fields)"
```

**Acceptance criteria:**
- Step 1 renders a 2-column grid; left column is empty placeholder (T5 will fill).
- Title field has required brand asterisk + helper text + example chip strip with 3 chips.
- Subtitle field has optional marker + helper text with 2 bold inline examples.
- Synopsis field has optional · up to 500 words marker + helper text + textarea with one-stop-lighter bg + Newsreader serif + 130px min-height + vertical resize.
- Error state on title field shows red border + 12px red message.
- `{synopsis.length}/2000` counter preserved.
- Title autofocus preserved.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 4 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Modify `app/[locale]/(app)/studio/_components/create-book-wizard/step-one.tsx` to use the shared `<WizardField>`, `<HelperText>`, `<ExampleChips>` components from T3. The cover-image block (currently lines ~77-111) stays as-is for now — T5 replaces it. Keep `useCloudinaryUpload`, `preview`, `fileRef`, and `handleFile` (T5 will refactor these). Leave the bottom Cancel/Next button row untouched — T9 reshapes all footers. Use the EXACT helper-text strings from the spec; do not paraphrase. The example chip strings include the surrounding single quotes — keep them. When a chip is picked, strip the leading/trailing single quote before writing to state so the input shows the title without the framing quotes. Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T4 — step 1 basics (right column text fields)`.

---

### Task 5: Step 1 Basics — cover dropzone + URL (left column)

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/cover-picker.tsx` (the dropzone + URL component).
- Modify: `app/[locale]/(app)/studio/_components/create-book-wizard/step-one.tsx` (replace the placeholder + the existing cover block with `<CoverPicker>`).

**Pre-flight check (subagent runs first):** Confirm `hooks/use-cloudinary-upload.ts` exports `useCloudinaryUpload(folder: string)` with `{ upload, uploading, error, result }`. **Already verified in the plan's pre-flight C** — but the subagent re-runs `Grep useCloudinaryUpload` to defend against drift. If the hook has changed shape, file a follow-up and use the existing `step-one.tsx` integration pattern (`upload(file)` returns `{ url, publicId } | null`).

**Fallback:** If Cloudinary is not configured (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is undefined or empty), the dropzone reads the file as a `FileReader` data URL and stores that as `coverUrl`. The dropzone copy degrades to "Drop a file to embed locally" + a small note "(Cloudinary not configured — upload disabled)". This matches the spec's deferred-upload fallback and the existing `cloudinaryConfigured` guard in the current `step-one.tsx`.

**Surfaces:**
- Left column of the Step 1 grid (260px wide).
- Section heading row: "Cover image" (Comfortaa 13px bold, ink-strong) + right-aligned "optional" mono marker.
- Helper text per spec: "Drop a file or paste a URL. Don't worry if you don't have one — we'll generate a paper-tone placeholder you can swap later."
- **Dropzone:** 5:7 aspect-ratio (`aspectRatio: '5 / 7'`), rounded `var(--r-card)`, recessed bg `var(--canvas-dark-100)`, 1.5px dashed border `oklch(1 0 0 / 0.10)`. Hover → border `var(--brand)` + bg `oklch(from var(--brand) l c h / 0.04)`.
  - Centered: 36px tile-styled circle holding lucide `UploadCloud` (size 16), then "Drag & drop an image" (Comfortaa 13px bold ink-strong), then "or click to browse · PNG, JPG, WEBP · up to 5 MB" (11px ink-muted).
  - On drop OR click → file picker → `validateFile(file)` → `upload(file)` OR data-URL fallback → `onUpdate({ coverUrl: result.url })`.
  - On a hot file (`coverUrl` set + file-based): replace dropzone with 5:7 paper-warm preview `<img>` + "Change image" link below (clears preview + reopens file picker).
- File constraints: PNG / JPG / WEBP, ≤ 5 MB. Reject others with sonner toast `toast.error("…")` (sonner is already mounted globally; see Delete Book toast pattern in AGENTS.md). 5 MB → `5 * 1024 * 1024` bytes.
- "OR PASTE A URL" divider: mono uppercase 10px ink-muted, with hairline `::before`/`::after` extensions via flex `<div style={{ flex: 1, height: 1, background: 'oklch(1 0 0 / 0.06)' }} />`.
- URL input: narrow mono 12.5px, `var(--r-row)`, recessed bg, placeholder `https://…`. On change → `onUpdate({ coverUrl: value })`. The two paths are mutually-overwriting (the most recent one wins).
- Dropzone is keyboard accessible: `role="button"`, `tabIndex={0}`, `onKeyDown` triggers file picker on Enter / Space.

- [ ] **Step 1: Pre-flight grep**

```bash
# subagent runs:
grep -n "useCloudinaryUpload" hooks/use-cloudinary-upload.ts
grep -rn "useCloudinaryUpload" app/ components/ hooks/
```

Confirm hook shape: `{ upload, uploading, error, result }`. If shape differs, halt and report.

- [ ] **Step 2: Author `cover-picker.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { HelperText, RECESSED_INPUT_STYLE, recessBlur, recessFocus } from './wizard-field'

type Props = {
  coverUrl: string | null
  onChange: (next: string | null) => void
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const CLOUDINARY_CONFIGURED = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

function validate(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'Only PNG, JPG, and WEBP images are supported.'
  if (file.size > MAX_BYTES) return 'Cover image must be 5 MB or smaller.'
  return null
}

export function CoverPicker({ coverUrl, onChange }: Props) {
  const { upload, uploading } = useCloudinaryUpload('covers')
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(coverUrl)

  async function handleFile(file: File) {
    const err = validate(file)
    if (err) { toast.error(err); return }
    setLocalPreview(URL.createObjectURL(file))
    if (CLOUDINARY_CONFIGURED) {
      const result = await upload(file)
      if (result) onChange(result.url)
      else toast.error('Upload failed. Try again or paste a URL below.')
    } else {
      // Data-URL fallback (spec: "good enough for v1")
      const reader = new FileReader()
      reader.onload = () => onChange(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          Cover image
        </label>
        <span
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          optional
        </span>
      </div>

      <HelperText id="cover-help">
        Drop a file or paste a URL. Don't worry if you don't have one — we'll generate
        a paper-tone placeholder you can swap later.
      </HelperText>

      {localPreview ? (
        <div
          style={{
            aspectRatio: '5 / 7',
            borderRadius: 'var(--r-card)',
            overflow: 'hidden',
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          <img src={localPreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-describedby="cover-help"
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
          style={{
            aspectRatio: '5 / 7',
            borderRadius: 'var(--r-card)',
            background: dragOver
              ? 'oklch(from var(--brand) l c h / 0.04)'
              : 'var(--canvas-dark-100)',
            border: `1.5px dashed ${dragOver ? 'var(--brand)' : 'oklch(1 0 0 / 0.10)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <div
              className="inline-flex items-center justify-center"
              style={{
                width: 36, height: 36,
                borderRadius: 'var(--r-pill)',
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: 'var(--sh-tile)',
                color: 'var(--canvas-dark-ink-strong)',
              }}
            >
              <UploadCloud size={16} />
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--canvas-dark-ink-strong)', margin: 0 }}>
              {uploading ? 'Uploading…' : 'Drag & drop an image'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', margin: 0 }}>
              or click to browse · PNG, JPG, WEBP · up to 5&nbsp;MB
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      {localPreview && (
        <button
          type="button"
          onClick={() => { setLocalPreview(null); onChange(null) }}
          style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Change image
        </button>
      )}

      <div className="flex items-center gap-2 my-1">
        <div style={{ flex: 1, height: 1, background: 'oklch(1 0 0 / 0.06)' }} />
        <span
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          or paste a url
        </span>
        <div style={{ flex: 1, height: 1, background: 'oklch(1 0 0 / 0.06)' }} />
      </div>

      <input
        type="url"
        placeholder="https://…"
        value={coverUrl?.startsWith('http') ? coverUrl : ''}
        onChange={e => { onChange(e.target.value || null); setLocalPreview(e.target.value || null) }}
        onFocus={recessFocus}
        onBlur={recessBlur}
        style={{
          ...RECESSED_INPUT_STYLE,
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Wire `<CoverPicker>` into `step-one.tsx`**

Replace the left-column placeholder + the existing cover block (currently lines ~77-111) with `<CoverPicker coverUrl={coverUrl} onChange={url => onUpdate({ coverUrl: url })} />`. Delete `useCloudinaryUpload`, `preview`, `fileRef`, `handleFile`, and the `cloudinaryConfigured` const from `step-one.tsx` — they're owned by `<CoverPicker>` now.

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T5 — cover dropzone + URL"
```

**Acceptance criteria:**
- Left column of Step 1 grid renders `<CoverPicker>`.
- Dropzone is 5:7 aspect-ratio, recessed bg, dashed border, hover/drag-over highlights to brand color.
- Clicking the dropzone opens file picker.
- Dragging a file onto it triggers upload.
- Files outside PNG/JPG/WEBP or > 5 MB → sonner toast rejection.
- On successful upload → preview thumbnail replaces dropzone + "Change image" link.
- URL input below the dropzone is mono 12.5px and recessed.
- Cloudinary path: file → `upload(file)` → `coverUrl` set to returned URL.
- Cloudinary not configured: file → `FileReader.readAsDataURL` → `coverUrl` set to data URL (spec-deferred fallback).
- Dropzone is keyboard accessible (Enter/Space triggers picker, `role="button"`, `tabIndex={0}`).
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 5 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. FIRST run `grep -n useCloudinaryUpload hooks/use-cloudinary-upload.ts` and confirm the hook exports `{ upload, uploading, error, result }`. If the shape differs, HALT and report. Otherwise, create `app/[locale]/(app)/studio/_components/create-book-wizard/cover-picker.tsx` per the plan. Wire it into `step-one.tsx`, removing the now-unused `useCloudinaryUpload`, `preview`, `fileRef`, `handleFile`, and `cloudinaryConfigured` imports/locals. Use sonner's `toast.error(...)` for rejection — `sonner` is mounted globally per AGENTS.md "Delete Book" entry. Confirm aria-describedby threads from the dropzone to the helper text. The dropzone must be keyboard accessible (Enter/Space). If `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is undefined, fall back to `FileReader.readAsDataURL`. Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T5 — cover dropzone + URL`.

---

### Task 6: Step 2 Discovery refresh

**Files:**
- Modify: `app/[locale]/(app)/studio/_components/create-book-wizard/step-two.tsx`.

**Surfaces / copy:**
- Outer container → single column, gap 18px between fields.
- Strip `field`, `label`, `selectClass`, and `Chip` constants from the file top — replaced by shared components (Chip stays as a local helper since it's used inline for tags + content warnings + target audience).
- **Genre + Subgenre** (existing 2-col grid stays):
  - `<WizardField label="Genre" optionalMarker="optional">`.
  - `<HelperText>` per spec: "Pick the one closest to your story — even if it's not a perfect fit. We use this to group your book on /discover."
  - `<select>` styled with `RECESSED_INPUT_STYLE` + `appearance: 'none'` + a `ChevronDown` lucide absolute-positioned on focus → brand color.
  - Subgenre below if available.
- **Target audience** — chip strip preserved verbatim (no spec change; just re-token the existing `Chip` to use tile gradient + recessed bg for the idle state).
- **Tags** (optional, up to 10):
  - `<WizardField label="Tags" optionalMarker={`optional · ${tags.length}/10`}>`.
  - `<HelperText>`: `Short labels readers can search for — <strong>'cozy'</strong>, <strong>'second-world fantasy'</strong>, <strong>'time loop'</strong>. Add 1-10.`
  - Existing PREDEFINED_TAGS chip grid stays.
  - Custom-tag input row stays.
- **Content warnings** — re-token only.
- **Comparable titles** (optional, up to 5):
  - `<WizardField label="Comparable titles" optionalMarker="optional · up to 5">`.
  - `<HelperText>`: `Books that share a vibe with yours. 'My book is <em>Howl's Moving Castle</em> meets <em>Gormenghast</em>' — readers love these. You can add up to 5.`
  - 5 slots stay as recessed inputs; last empty slot shows "+ Add another title" inline (existing affordance preserved).
  - NEW: `<ExampleChips examples={["Piranesi", "House of Leaves", "The Night Circus"]} onPick={addToNextEmptyCompTitle} ariaLabelPrefix="Use comp title" />` below the input strip. `addToNextEmptyCompTitle` finds the first empty slot and fills it, or appends a new slot if all 5 are full and the cap isn't hit.
- **Language** — `<WizardField label="Language">` + same select styling.

The `Chip` helper at lines 34-48 stays but its `className` is reshaped to use tokens (idle: tile gradient + `--sh-tile` + ink-muted; active: brand-soft bg + brand text + brand border).

- [ ] **Step 1: Re-skin field-by-field**

Walk each section top-to-bottom, swap to `<WizardField>` + `<HelperText>` + recessed style. Keep the existing state, handlers, and skip/back/next logic.

- [ ] **Step 2: Add `addToNextEmptyCompTitle` + chip wiring**

```tsx
function addToNextEmptyCompTitle(value: string) {
  const idx = compTitles.findIndex(t => !t.trim())
  if (idx >= 0) {
    const next = [...compTitles]
    next[idx] = value
    onUpdate({ compTitles: next })
  } else if (compTitles.length < 5) {
    onUpdate({ compTitles: [...compTitles, value] })
  }
}
```

- [ ] **Step 3: Re-skin the inline `Chip` helper**

```tsx
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 'var(--r-pill)',
        fontSize: 12,
        background: active
          ? 'oklch(from var(--brand) l c h / 0.12)'
          : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: active ? 'none' : 'var(--sh-tile)',
        color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
        border: active ? '1px solid oklch(from var(--brand) l c h / 0.35)' : '1px solid transparent',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T6 — step 2 discovery refresh"
```

**Acceptance criteria:**
- Genre + Subgenre + Target Audience + Tags + Content Warnings + Comp Titles + Language all render with new chrome.
- Helper text strings match the spec verbatim (with bold-inline examples where spec uses them).
- Comp titles example chip strip ("Piranesi", "House of Leaves", "The Night Circus") fills the next empty slot.
- All existing affordances (tag add, comp title add/remove, skip) preserved.
- `Chip` helper uses tile gradient idle + brand-soft active.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 6 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Modify `app/[locale]/(app)/studio/_components/create-book-wizard/step-two.tsx`. Re-skin each field section using `<WizardField>` + `<HelperText>` + the recessed style helpers from T3. Preserve every existing affordance — including the "+ Add another title" inline button, the custom tag input, the content warnings strip, and the skip button. Add the new `<ExampleChips>` strip below comp titles, with `addToNextEmptyCompTitle` wired per the plan. The leading `field` / `label` / `selectClass` consts at the top of the file are deleted. The `Chip` helper stays but is re-tokenized inline. Leave the bottom Back/Skip/Next footer untouched — T9 reshapes all footers. Use the EXACT helper-text strings from the spec; do not paraphrase. Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T6 — step 2 discovery refresh`.

---

### Task 7: Step 3 Structure refresh

**Files:**
- Modify: `app/[locale]/(app)/studio/_components/create-book-wizard/step-three.tsx`.

**Surfaces / copy:**
- Outer container → 2-column grid (`gridTemplateColumns: '1fr 1fr', gap: '22px'`).
- Strip `field`, `label`, `selectClass` consts.
- **Left column — Standalone vs Series cards:**
  - `<HelperText>` at the column top (no `<WizardField>`): "Pick a structure for your manuscript."
  - Two stacked cards. Each is a `<button>` with:
    - Idle: `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `var(--sh-tile)` + `var(--r-card)` (18px override → use 16px inline since spec says "slightly larger: 18px" but the card scale is 20px; use 18px inline).
    - Active: `background: oklch(from var(--brand) l c h / 0.12)` + `border: 1px solid oklch(from var(--brand) l c h / 0.45)` + brand-text label.
  - Card 1 "Standalone" — helper "One self-contained story. Most novels live here."
  - Card 2 "Part of a series" — when active, expands an inline subform: Series name (recessed input) + Book number (recessed number input). Helper: `If you're writing the second book of <em>The Stormlight Archive</em>, name the series and put <strong>'2'</strong> here. We'll show prev/next links on the reader page.`
- **Right column — Template picker:**
  - `<HelperText>` at the column top: `Pick a manuscript template. <strong>Novel</strong> gives you 24 chapters, <strong>Short story</strong> gives you 1. Don't sweat it — you can add/remove chapters once you're inside.`
  - Vertical stack of template tiles. Each tile: tile gradient idle, brand-soft + brand border active. Layout: 36px circle icon left (currently no icon — render a `<span>` with the template name initial; spec calls for "small icon", initial is a reasonable fallback until tile data carries an icon field), then name + description + chapter count, then a `<Check>` icon right when selected.
  - The existing genre subtitle metadata stays.
- **Publisher info** — the existing optional publisher / trim size / edition fields stay BUT move into a collapsible `<details>` block at the bottom (full-width, spanning both columns) titled "Publisher info — optional". This keeps the 2-col card layout clean while preserving the affordances.

- [ ] **Step 1: Re-shape into 2-col grid**

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
  <div className="flex flex-col gap-3">{/* Standalone/Series + helper */}</div>
  <div className="flex flex-col gap-3">{/* Template picker + helper */}</div>
</div>
<details className="mt-5" style={{ /* publisher info collapsed by default */ }}>
  <summary>Publisher info — optional</summary>
  {/* existing publisher inputs */}
</details>
```

- [ ] **Step 2: Re-skin Standalone vs Series cards**

Use the active-card pattern (brand-soft bg + brand border) for the chosen option. The Series subform appears inline beneath the Series card when `isSeriesBook === true`.

- [ ] **Step 3: Re-skin template tiles**

Each tile is a `<button>` 100% wide; active tile shows `<Check>` lucide icon on the right.

- [ ] **Step 4: Wrap publisher block in `<details>`**

The existing Publisher info / Trim size / Edition fields move inside a `<details>` with a styled `<summary>` (Comfortaa 12px ink-muted; chevron rotates on open).

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T7 — step 3 structure refresh"
```

**Acceptance criteria:**
- 2-column grid with Standalone/Series cards on left, template tiles on right.
- Active card / tile has brand-soft bg + brand border.
- Selected template tile shows lucide `<Check>` icon on the right.
- Series subform appears inline when "Part of a series" card is active.
- Publisher info collapses into a `<details>` block below the grid (defaults closed).
- All existing affordances preserved (template select/deselect, series toggle, publisher fields, skip).
- Helper-text strings match the spec.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 7 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Modify `app/[locale]/(app)/studio/_components/create-book-wizard/step-three.tsx`. Re-shape into 2-col grid + a collapsible `<details>` for the optional publisher info. Use the shared `<WizardField>`, `<HelperText>` helpers from T3 where labels apply. Standalone vs Series uses a 2-card stack (left col); template picker is a vertical tile stack (right col). Preserve every existing affordance — including the Series subform's seriesName + seriesNumber inputs, the publisher fields, and the skip button. Active card/tile = brand-soft bg + brand border + (for templates) lucide `<Check>` icon. Leave the bottom Back/Skip/Next footer untouched — T9 reshapes all footers. Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T7 — step 3 structure refresh`.

---

### Task 8: Step 4 Sharing refresh (re-skin `<SharingControls>`)

**Files:**
- Modify: `components/book/sharing-controls.tsx` (shared between wizard Step 4 and the Details page — see pre-flight D).
- Modify: `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` (the inline Step 4 block at lines ~375-413 gets a `<StepHeader>` already from T2; this task just confirms the wrapper styling and adds a helper-text block above `<SharingControls>` if not already there).

**Surfaces:**
- 3 visibility cards (Private / Friends / Public):
  - Idle: `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `var(--sh-tile)` + `border-radius: 18px` (matches the spec "slightly larger for cards: 18px") + `border: 1px solid transparent` + Lock/Users/Globe icon in `var(--canvas-dark-ink-muted)`.
  - Active: `background: oklch(from var(--brand) l c h / 0.12)` + `border: 1px solid oklch(from var(--brand) l c h / 0.45)` + brand-yellow icon + bold ink-strong label.
  - Helper copy per card preserved verbatim from the existing component.
- Discoverable toggle row:
  - Recessed input bg around the entire row (`background: var(--canvas-dark-100)` + `var(--r-row)` + 12px padding).
  - Custom checkbox swatch:
    - Unchecked: 18×18 square, `background: var(--canvas-dark-100)`, `border: 1px solid oklch(1 0 0 / 0.10)`, `border-radius: 4px`.
    - Checked: 18×18 square, `background: var(--brand)`, lucide `<Check>` icon `color: var(--brand-ink)` size 13, no border.
  - Visually-hidden native `<input type="checkbox">` for a11y; the swatch is a `<span aria-hidden>`.
  - Disabled when `visibility !== 'PUBLIC'`. Disabled state dims the row to 40% opacity.

The native `accent-brand` styling in the current component (line 64) is replaced by the visually-hidden + custom-swatch pattern. This matches the hive settings T12 pattern called out in the spec (no concrete file reference; the implementation here is a self-contained restyle).

- [ ] **Step 1: Re-skin the 3 visibility cards in `sharing-controls.tsx`**

```tsx
{OPTIONS.map(opt => {
  const Icon = opt.icon
  const selected = visibility === opt.value
  return (
    <button
      key={opt.value}
      type="button"
      onClick={() => onChange({ visibility: opt.value })}
      style={{
        textAlign: 'left',
        padding: 14,
        borderRadius: 18,
        background: selected
          ? 'oklch(from var(--brand) l c h / 0.12)'
          : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: selected ? 'none' : 'var(--sh-tile)',
        border: selected
          ? '1px solid oklch(from var(--brand) l c h / 0.45)'
          : '1px solid transparent',
        color: 'var(--canvas-dark-ink-strong)',
        cursor: 'pointer',
        transition: 'all 150ms ease',
      }}
    >
      <Icon size={16} style={{ color: selected ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)', marginBottom: 8 }} />
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700 }}>{opt.title}</div>
      <div style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', marginTop: 2 }}>{opt.description}</div>
      {opt.hint && <div style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', opacity: 0.7, marginTop: 6 }}>{opt.hint}</div>}
    </button>
  )
})}
```

- [ ] **Step 2: Re-skin the Discoverable toggle row**

Visually-hidden native checkbox + custom swatch:

```tsx
<label
  style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 'var(--r-row)',
    background: 'var(--canvas-dark-100)',
    boxShadow: 'var(--sh-inset)',
    cursor: isPublic ? 'pointer' : 'not-allowed',
    opacity: isPublic ? 1 : 0.45,
    transition: 'opacity 150ms ease',
  }}
>
  <input
    type="checkbox"
    checked={discoverable && isPublic}
    disabled={!isPublic}
    onChange={(e) => onChange({ discoverable: e.target.checked })}
    className="sr-only"
    aria-describedby="discoverable-help"
  />
  <span
    aria-hidden="true"
    className="inline-flex items-center justify-center"
    style={{
      width: 18,
      height: 18,
      borderRadius: 4,
      marginTop: 1,
      background: (discoverable && isPublic) ? 'var(--brand)' : 'var(--canvas-dark-100)',
      border: (discoverable && isPublic) ? 'none' : '1px solid oklch(1 0 0 / 0.10)',
      color: 'var(--brand-ink)',
      flexShrink: 0,
    }}
  >
    {discoverable && isPublic && <Check size={13} strokeWidth={3} />}
  </span>
  <div>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--canvas-dark-ink-strong)' }}>
      Discoverable
    </div>
    <div id="discoverable-help" style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', marginTop: 2 }}>
      {isPublic
        ? 'Discoverable books show up on /discover. Uncheck if you want a public-but-unlisted link only.'
        : 'Only public books can be discoverable.'}
    </div>
  </div>
</label>
```

The Discoverable helper copy is updated per the spec ("Discoverable books show up on /discover. Uncheck if you want a public-but-unlisted link only.").

- [ ] **Step 3: Verify Details page still renders**

Manual smoke: run dev server, navigate to `/en/studio/<existing-book>/details`, scroll to Sharing section, confirm the 3 cards render with the new chrome and the Discoverable toggle works.

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T8 — step 4 sharing refresh (shared SharingControls)"
```

**Acceptance criteria:**
- 3 visibility cards render with tile gradient idle + brand-soft active + brand-yellow icon when active.
- Discoverable row uses recessed bg + custom checkbox swatch (brand-yellow square + brand-ink `<Check>` when checked).
- Discoverable disabled when visibility ≠ PUBLIC; row dims to 45% opacity.
- Helper copy on the Discoverable row matches the spec.
- The Details page Sharing section still renders correctly (manual smoke confirmed).
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 8 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Modify `components/book/sharing-controls.tsx` — this component is SHARED between the wizard Step 4 AND `/studio/[bookId]/details`. Re-skin the 3 visibility cards + the Discoverable toggle per the plan. The native `<input type="checkbox">` becomes visually-hidden (`className="sr-only"`) and the visible swatch is a `<span aria-hidden>` with the brand-yellow `<Check>` icon when checked. Update the Discoverable helper copy to the spec wording. After the change, run the dev server and manually verify `/en/studio/<any-book>/details` Sharing section still renders correctly — this is required acceptance. Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T8 — step 4 sharing refresh (shared SharingControls)`.

---

### Task 9: Footer + Next-button copy + submit flow

**Files:**
- Modify: `app/[locale]/(app)/studio/_components/create-book-wizard/step-one.tsx` (footer row).
- Modify: `app/[locale]/(app)/studio/_components/create-book-wizard/step-two.tsx` (footer row).
- Modify: `app/[locale]/(app)/studio/_components/create-book-wizard/step-three.tsx` (footer row).
- Modify: `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` (Step 4 inline footer + submit button + error display).

**Surfaces:**
- Each step's footer:
  - Top hairline (`border-top: 1px solid oklch(1 0 0 / 0.05)`).
  - Padding: 18-26px vertical, 36px horizontal.
  - Left: text button — Step 1 shows "← Cancel"; Steps 2-4 show "← Back". Style: ink-muted, transparent bg, hover → ink-strong, no border.
  - Right (for steps 2-3): "Skip" text button + "Next" brand pill. Step 1 only shows the Next pill. Step 4 shows "Create your book ✨".
  - Next pill: `background: var(--brand)` + `color: var(--brand-ink)` + `var(--font-display)` font-bold + `padding: 11px 22px` + `border-radius: var(--r-pill)` + **NO box-shadow glow** (`box-shadow: none`). Hover → `translateY(-1px)` 150ms ease.
  - Disabled state (Step 1, no title): opacity 0.4 + cursor not-allowed.

**Per-step Next button copy:**
- Step 1: `"Next: tell us how to find it →"`
- Step 2: `"Next: shape your manuscript →"`
- Step 3: `"Next: who can see it →"`
- Step 4: `"Create your book ✨"`

**Submit flow (Step 4):**
- Click `"Create your book ✨"` → existing `submit()` handler called.
- While submitting: button text becomes `"Creating…"` and gets a spinner (existing affordance).
- On error: existing red error block stays (re-token to match new chrome — `background: oklch(0.62 0.21 25 / 0.10)`, `border: 1px solid oklch(0.62 0.21 25 / 0.25)`, `border-radius: var(--r-row)`).

- [ ] **Step 1: Author a shared `<WizardFooter>` helper inside `wizard-field.tsx`**

```tsx
type WizardFooterProps = {
  onBack?: () => void
  onCancel?: () => void
  onSkip?: () => void
  onNext: () => void
  nextLabel: string
  nextDisabled?: boolean
  submitting?: boolean
}

export function WizardFooter({ onBack, onCancel, onSkip, onNext, nextLabel, nextDisabled, submitting }: WizardFooterProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        marginTop: 20,
        paddingTop: 22,
        borderTop: '1px solid oklch(1 0 0 / 0.05)',
      }}
    >
      {onCancel ? (
        <button type="button" onClick={onCancel} className="back-link">← Cancel</button>
      ) : onBack ? (
        <button type="button" onClick={onBack} className="back-link">← Back</button>
      ) : <span />}

      <div className="flex items-center gap-3">
        {onSkip && (
          <button type="button" onClick={onSkip} className="back-link">Skip</button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || submitting}
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
            padding: '11px 22px',
            borderRadius: 'var(--r-pill)',
            boxShadow: 'none',
            opacity: (nextDisabled || submitting) ? 0.4 : 1,
            cursor: (nextDisabled || submitting) ? 'not-allowed' : 'pointer',
            transition: 'transform 150ms ease',
          }}
          onMouseEnter={e => { if (!nextDisabled && !submitting) e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {submitting ? 'Creating…' : nextLabel}
        </button>
      </div>
    </div>
  )
}
```

The `.back-link` class consumed above is added once to the orchestrator's `<style>` block:

```css
.back-link {
  font-size: 13px;
  color: var(--canvas-dark-ink-muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 150ms ease;
}
.back-link:hover { color: var(--canvas-dark-ink-strong); }
```

- [ ] **Step 2: Wire `<WizardFooter>` into all 4 steps**

Step 1: `<WizardFooter onCancel={onCancel} onNext={() => { if (!title.trim()) return; onNext() }} nextLabel="Next: tell us how to find it →" nextDisabled={!title.trim()} />`.

Step 2: `<WizardFooter onBack={onBack} onSkip={onSkip} onNext={onNext} nextLabel="Next: shape your manuscript →" />`.

Step 3: `<WizardFooter onBack={onBack} onSkip={onSkip} onNext={onNext} nextLabel="Next: who can see it →" />`.

Step 4 (inside `book-creation-form.tsx`): `<WizardFooter onBack={goBack} onNext={submit} nextLabel="Create your book ✨" submitting={submitting} />`.

The existing error-display blocks in step-three.tsx and book-creation-form.tsx Step 4 are re-tokenized to match the new chrome:

```tsx
{error && (
  <p style={{
    fontSize: 13,
    color: 'oklch(0.72 0.21 25)',
    background: 'oklch(0.62 0.21 25 / 0.10)',
    border: '1px solid oklch(0.62 0.21 25 / 0.25)',
    borderRadius: 'var(--r-row)',
    padding: '12px 16px',
  }}>
    {error === 'FREE_LIMIT_REACHED'
      ? "You've reached the free plan limit of 3 books. Upgrade to create more."
      : error}
  </p>
)}
```

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "style(wizard): T9 — footer + Next button copy"
```

**Acceptance criteria:**
- All 4 steps use `<WizardFooter>`.
- Step 1 shows "← Cancel" + "Next: tell us how to find it →" (no Skip).
- Step 2 shows "← Back" + "Skip" + "Next: shape your manuscript →".
- Step 3 shows "← Back" + "Skip" + "Next: who can see it →".
- Step 4 shows "← Back" + "Create your book ✨".
- Next pill has NO box-shadow glow.
- Step 1 Next is disabled when title is empty.
- Step 4 submit shows "Creating…" + disabled state while in-flight.
- Error blocks re-tokenized to match the new chrome.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 9 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Add a `<WizardFooter>` export to `app/[locale]/(app)/studio/_components/create-book-wizard/wizard-field.tsx` per the plan. Wire it into all 4 step surfaces (`step-one.tsx`, `step-two.tsx`, `step-three.tsx`, and the inline Step 4 block in `book-creation-form.tsx`). Use the exact Next-button copy strings from the spec. The Next pill MUST NOT have a box-shadow glow per Chris's explicit call in the spec. Add the `.back-link` CSS to the orchestrator's existing `<style>` block at the bottom of `book-creation-form.tsx`. Re-tokenize the error-display blocks (currently red Tailwind classes). Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T9 — footer + Next button copy`.

---

### Task 10: Feature-integrity sweep + a11y check

**Files:**
- Test only (no code changes unless an integrity break is found).

**Walk every existing affordance:**

1. **Step 1**:
   - Title required validation → empty title blocks Next + shows red error.
   - Title autofocus on mount.
   - Subtitle optional.
   - Synopsis 2000-char cap + counter visible.
   - Example chips fill the title input (with surrounding quotes stripped).
   - Cover dropzone accepts drag-and-drop OR click-to-browse.
   - Cover URL input accepts pasted URLs.
   - File > 5 MB rejected via sonner toast.
   - File outside PNG/JPG/WEBP rejected via sonner toast.
   - "Change image" link clears the preview + lets user pick again.
2. **Step 2**:
   - Genre dropdown populates Subgenre.
   - Target audience chip toggles.
   - Tags: add/remove from predefined; custom tag via Enter/comma; 10-cap enforced.
   - Content warnings chip toggles.
   - Comp titles: add up to 5; remove individual slots; example chips fill next empty slot.
   - Language dropdown.
   - Skip → advances to Step 3.
3. **Step 3**:
   - Template tile select/deselect.
   - Standalone vs Series toggle.
   - Series subform appears when "Part of a series" active.
   - Series number accepts integer input.
   - Publisher info expands from `<details>`.
   - Skip → advances to Step 4.
4. **Step 4**:
   - 3 visibility cards toggle.
   - Discoverable disabled when visibility ≠ PUBLIC.
   - Discoverable resets to false when visibility flips away from PUBLIC.
   - "Create your book ✨" submits + shows "Creating…" + disabled state.
   - On `FREE_LIMIT_REACHED` → friendly error message.
   - On success → redirect to `/${locale}/studio/${newBookId}` (or `?createHive=…` if `withHive=1`).
5. **Progress bar**:
   - Backwards jump to a reached step works.
   - Forward jump still blocked when title is empty.
   - Active pill has `aria-current="step"`.
   - Done pills show `<Check>` icon.
6. **Animations**:
   - `step-enter-forward` fires when advancing.
   - `step-enter-back` fires when going back.
   - `prefers-reduced-motion: reduce` disables animations.
7. **Accessibility**:
   - Helper text has `id` matching the input's `aria-describedby`.
   - Cover dropzone is keyboard accessible (Enter/Space).
   - Example chips are `<button>` not `<div>`, with descriptive `aria-label`.
   - Visibility cards are buttons; Discoverable checkbox is keyboard accessible (visually-hidden native input).
   - Focus rings visible on tab through (3px brand-soft outer glow on inputs; tile shadow on chip buttons).

- [ ] **Step 1: Walk the checklist on dev server**

```bash
npm run dev
# manual walk-through per the list above
```

- [ ] **Step 2: Run static checks**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 3: Fix any breaks discovered**

If any integrity break is found, file a one-shot fix in this task's commit (do not punt to a follow-up).

- [ ] **Step 4: Commit**

If fixes were needed:
```bash
git add -A
git commit -m "style(wizard): T10 — feature-integrity + a11y sweep"
```

If no fixes were needed (clean sweep), an empty commit communicates the audit happened:
```bash
git commit --allow-empty -m "style(wizard): T10 — feature-integrity + a11y sweep (clean)"
```

**Acceptance criteria:**
- Every affordance in the walk-through list operates correctly.
- All a11y items in the list are confirmed.
- tsc clean, 424+ tests passing.
- One commit lands (with or without fixes).

**Subagent dispatch:**
> Implement Task 10 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. This is a verification task — no code changes unless a break is discovered. Run the dev server and walk the entire affordance checklist in the plan top-to-bottom across all 4 steps. Verify the a11y items (aria-describedby threading, aria-current on active pill, keyboard accessibility of dropzone + chips + checkbox swatch). If a break is found, fix it in this same commit. Run `npx tsc --noEmit` and `npm test`. Commit with `style(wizard): T10 — feature-integrity + a11y sweep` (or `... (clean)` if no fixes needed).

---

### Task 11: AGENTS.md write-up + ship commit

**Files:**
- Modify: `AGENTS.md` (add the "Book Creation Wizard Redesign" entry under "What Has Been Built"; update "📍 Resume Here").

**Surfaces:**
- New entry titled `### Book Creation Wizard Redesign ✅ COMPLETE (2026-06-01)` placed AFTER the current latest entry under "What Has Been Built" (currently the Hives H2 entry).
- Brief paragraph + bullet list summarizing:
  - Stage panel + progress bar refreshed to the editor refresh chrome.
  - Shared `<StepHeader>`, `<WizardField>`, `<HelperText>`, `<ExampleChips>`, `<WizardFooter>` components.
  - Cover dropzone (drag-drop + URL) wired to existing `useCloudinaryUpload('covers')` hook; data-URL fallback when Cloudinary not configured.
  - Helper text added to every field per the spec.
  - Example chips on title (Step 1) + comp titles (Step 2).
  - `<SharingControls>` re-skinned once; cascades to wizard + Details page.
  - Per-step Next-button copy: "Next: tell us how to find it →" etc.
  - Stale `wizard-progress.tsx` deleted.
  - No new tokens. No new server actions. No DB changes.
- Note the deferred follow-up: textarea-bg `oklch(0.245 0.003 256)` is currently a one-off; if a second consumer needs it, promote to `--textarea-bg` in `globals.css`.

Update "📍 Resume Here":
- Bump `Last updated` to 2026-06-01.
- Refresh `Current focus` line to "Wizard redesign shipped. Awaiting Chris's manual smoke."
- Refresh `Last commit`.
- Refresh `Next concrete step` to the next priority per the existing candidate list (H3 Collaboration Core, etc.).

- [ ] **Step 1: Author the AGENTS.md entry**

Modeled on existing entries (compact paragraph + bullets), single section, no code blocks. The entry sits in the "What Has Been Built" section at chronological top.

- [ ] **Step 2: Update Resume Here**

Refresh the dated header at the top of AGENTS.md.

- [ ] **Step 3: Commit + ship**

```bash
npx tsc --noEmit
npm test
git add AGENTS.md
git commit -m "docs(agents): wizard redesign shipped — entry + Resume Here refresh"
git push
```

Push to GitHub per Chris's working preference (commits go straight to `main`, push when work ships).

**Acceptance criteria:**
- AGENTS.md "What Has Been Built" has a `### Book Creation Wizard Redesign ✅ COMPLETE (2026-06-01)` entry.
- "📍 Resume Here" block reflects current state.
- All 424+ tests passing.
- tsc clean.
- Branch pushed.

**Subagent dispatch:**
> Implement Task 11 of `docs/superpowers/plans/2026-06-01-book-creation-wizard-redesign.md`. Modify `AGENTS.md` only — add the new "Book Creation Wizard Redesign" entry and refresh the "📍 Resume Here" block. Match the tone/structure of existing entries (paragraph + bullet list, no code blocks). Include the textarea-bg follow-up note. Run `npx tsc --noEmit` and `npm test`. Commit with `docs(agents): wizard redesign shipped — entry + Resume Here refresh`. Push to `main`.

---

## Sequencing notes

- T1 → T2 → T3 must land in order (T2 depends on T1's chrome; T3 introduces shared components T4+ consume).
- T4 → T5 must land in order (T4 establishes the 2-col grid with a left-column placeholder; T5 fills it with `<CoverPicker>`).
- T6, T7, T8 can be parallelized after T3 (each touches a different file).
- T9 lands after T4-T8 (it touches all 4 step files + the orchestrator).
- T10 lands last before T11; it's the integrity gate.
- T11 ships.

## Out-of-scope (deferred)

- Mobile-specific layout. Existing wizard is desktop-first; mobile can fall back to 1-column. The 2-col grids in Steps 1 + 3 use a fixed `gridTemplateColumns` (not `auto-fit`) so on narrow viewports they wrap to single-column. No additional media-query work in this plan.
- Per-tier image quota gating on the cover dropzone. Spec defers ("if there's a free-tier image quota, surface the limit copy inline; if none, defer"). No such quota is exposed today.
- Promoting the textarea-bg derived value to a `--textarea-bg` token. Noted as a follow-up in T11.
- Animation changes beyond `step-enter-forward` / `step-enter-back` (which are preserved verbatim).
- New design tokens.

## Risks

- **Helper-text vertical density:** Step 2 (Genre + Subgenre + Target Audience + Tags + Content Warnings + Comp Titles + Language) is dense and may scroll on shorter viewports. Spec accepts this trade-off ("Chris asked 'if possible' for no scroll, not 'must'").
- **Cover dropzone data-URL fallback:** if Cloudinary is misconfigured at runtime (env var present but `upload()` fails for unrelated reasons), the spec-deferred fallback doesn't auto-engage — the user just sees the sonner error toast and can paste a URL. Acceptable for v1.
- **Shared `<SharingControls>` re-skin:** changes both the wizard AND the Details page Sharing section simultaneously. T8 explicitly requires a manual smoke of the Details page. Subagent must confirm before committing.
