# Book Creation Wizard Redesign — Design

**Status:** Approved (Chris, 2026-06-01)
**Date:** 2026-06-01
**Scope:** The 4-step new-book wizard at `/[locale]/studio/new` — chrome, copy, layout, and the cover-image field.
**Predecessor design system:** [docs/superpowers/specs/2026-06-01-editor-aesthetic-refresh-design.md](2026-06-01-editor-aesthetic-refresh-design.md).

---

## Context

The current new-book wizard works but reads as a functional prototype: `#1c1c1c` flat inputs, thin borders, terse one-word labels, and no encouragement. The four steps (Basics / Discovery / Structure / Sharing) deliver the right data flow but feel utilitarian.

Chris wants to keep the four-step structure and the underlying fields, but re-skin the chrome to match the iOS-inspired aesthetic the rest of the app now ships, and add hand-holding via longer helper text + clickable example chips. Cover-image upload also becomes file-or-URL (currently URL only).

The wizard inherits the design system from the editor refresh spec — no new tokens, same radius / depth / brand-yellow rules.

## Goals

- Each of the 4 steps re-skinned to the new design system (panel chrome, soft 14-20px radii, recessed inputs, brand-yellow active states, no near-black, no pure-black).
- Tone: **Apple-warm / Things 3** — encouraging micro-copy, reassuring lede ("you can change this later"), preview-style Next button copy ("Next: tell us how to find it →").
- Helper text under every field — multi-sentence explanations with examples in **bold inline** for scanability.
- Example chips below the title field (and other fields where ideation helps) — clickable to pre-fill.
- 2-column body layout so each step fits a typical viewport without scrolling.
- Cover-image field: drag-and-drop file upload OR paste-a-URL, both surfaced at once.

## Non-goals

- No change to the 4-step structure or the underlying field set.
- No new database columns.
- No new server actions beyond what cover-file upload requires (and that wires into the existing Cloudinary upload helper).
- No animation work beyond the existing step-enter-forward / step-enter-back transitions.
- No new design tokens.
- No mobile-specific layout (existing wizard is desktop-first; mobile can fall back to 1-column).

---

## Design System (inherited)

All tokens from the editor refresh spec apply. Specifically used:

- **Page bg:** `#262728` (app-wide, already shipped).
- **Stage / panel surface:** `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))` + `--r-card` (20px) + `--sh-card` + `--br-card`.
- **Recessed inputs:** `background: var(--canvas-dark-100)` (referred to in this spec as the "input bg" — single-stop darker than the page surface).
- **Recessed textareas:** one stop lighter than the inputs — `oklch(0.245 0.003 256)`. (This is a new derived value scoped to textareas only; if it gets reused, promote to `--textarea-bg` in `globals.css` as a follow-up.)
- **Tile chrome** (chips, progress pills): `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `--sh-tile`.
- **Brand-yellow:** Next CTA, active progress pill, required-field asterisk, focus ring (3px outer glow at `oklch(from var(--brand) l c h / 0.18)`). **NO drop-shadow glow** on the Next button.
- **Typography:** Comfortaa for the step headline + field labels; Geist for body and lede; Newsreader serif for synopsis textarea + example chips; JetBrains Mono for eyebrows, "try one:" labels, and "optional" markers.

---

## Stage Layout

All four steps share a single stage panel:

- Max width: **1040px**.
- Centered horizontally, page padding ~28px.
- Vertical sections inside the stage:
  1. **Progress bar** (top, 18px vertical padding, bottom hairline).
  2. **Step header** (26px top / 36px sides / 18px bottom padding).
  3. **Form body** (36px sides padding, content varies per step).
  4. **Footer** (top hairline, 18-26px padding, Back/Cancel left + Next right).

### Progress bar

4 pills in a row separated by 1px hairlines that span. Each pill:
- Idle: tile gradient + `--sh-tile` + ink-muted text + small 18px circle holding the step number.
- Active: solid `var(--brand)` bg + `var(--brand-ink)` text + brand-ink circle.
- Done (after the user advances past it): same active treatment but with a check icon instead of the number — confirms progress.

Each pill is clickable to jump back (existing `jumpTo` behavior preserved). Forward jumps gated by step-1 title validation.

Step labels: `Basics / Discovery / Structure / Sharing`.

### Step header

Three lines stacked left-aligned:
1. **Eyebrow** — `STEP N OF 4` in JetBrains Mono uppercase muted, 10px, letter-spacing 0.12em.
2. **Headline** — Comfortaa font-bold 24px, brand-yellow. Examples per step below.
3. **Lede** — 13px ink-muted, max-width ~620px. Always ends with a reassuring phrase in **bold ink-strong** ("*You can change this later.*").

### Footer

- Left: **Cancel / Back** — text button, ink-muted, transparent bg, hover → ink-strong. Step 1 says "← Cancel"; steps 2-4 say "← Back".
- Right: **Next CTA** — solid brand pill, Comfortaa font-bold, 11px 22px padding, `--r-pill` (999px). **Plain — no drop-shadow glow.** Slight `translateY(-1px)` on hover, 150ms ease. Disabled state when required validation fails.
- Step 4's Next button reads "Create your book ✨" and submits.

---

## Per-Step Content

### Step 1 — Basics

**Headline:** "Let's start with the basics."
**Lede:** "A few quick details so we can set up your book. *You can change any of this later.*"

**Form body** — 2-column grid (`260px 1fr`, gap 22px):

- **Left column — Cover image (optional):**
  - Sub-heading: "Cover image" with right-aligned mono "optional" marker.
  - Helper text: "Drop a file or paste a URL. Don't worry if you don't have one — we'll generate a paper-tone placeholder you can swap later."
  - **Dropzone:** 5:7 aspect-ratio rounded card, recessed input bg, 1.5px dashed `oklch(1 0 0 / 0.10)` border. Hover → border brand + bg `oklch(from var(--brand) l c h / 0.04)`.
    - Centered content: 36px tile-styled circle with an upload arrow (lucide UploadCloud), then "Drag & drop an image" (ink-strong, bold) and "or click to browse · PNG, JPG, WEBP · up to 5 MB" (ink-muted, 11px).
    - Click opens file picker; drag-over highlights border.
    - On selected file: dropzone replaced with a preview thumbnail (5:7 paper-warm card) + "Change image" link below.
    - File upload → goes through existing Cloudinary helper; `coverUrl` is set to the returned URL.
  - **"OR PASTE A URL"** divider — mono uppercase muted, 10px, with hairline `::before`/`::after` flex extensions.
  - **URL input** — narrow mono input, 12.5px, `--r-row` (14px), recessed input bg, placeholder `https://…`. On valid URL → preview thumbnail above swaps in.

- **Right column — Title + Subtitle + Synopsis** (gap 18px between fields):
  - **Title** (required):
    - Label "Title" + brand-yellow asterisk.
    - Helper: "What's this book called? A working title is fine — you can change it any time. It'll appear on your bookshelf and at the top of every chapter."
    - Input: recessed, 14px Geist.
    - Below input: example chips row — mono uppercase "try one:" label + 3 italic-serif chips ("'The Last Glassblower'", "'Tideborn'", "'Untitled Project'"). Click chip → fills input.
    - Error state: red border + 12px red error message below.
  - **Subtitle** (optional):
    - Label "Subtitle" + mono "optional" marker.
    - Helper: "Sometimes a subtitle tells the reader exactly what they're picking up — **'A Novel of the Saltwater Coast'**, **'Book One of the Lantern Cycle'**. Skip if not sure."
    - Input: recessed, 14px Geist.
  - **Synopsis** (optional, up to 500 words):
    - Label "Synopsis" + mono "optional · up to 500 words" marker.
    - Helper: "Two or three sentences — the back-of-the-book pitch. Even rough notes work; this is for you, and you can edit it later."
    - **Textarea bg one stop lighter** than other inputs. Min-height 130px, resize vertical. Font: Newsreader serif, 15px, line-height 1.55.

**Next button copy:** "Next: tell us how to find it →"

---

### Step 2 — Discovery

**Headline:** "How will readers find this book?"
**Lede:** "Tags and comp titles help readers discover your book on /discover. You can come back to any of this whenever."

**Form body** — single column (genre dropdown is wide; comp titles + tags use horizontal chip strips):

- **Genre** (optional):
  - Helper: "Pick the one closest to your story — even if it's not a perfect fit. We use this to group your book on /discover."
  - shadcn-style dropdown with the existing genre list. Recessed input chrome, brand-yellow chevron on focus.
- **Comparable titles** (optional, up to 5):
  - Helper: "Books that share a vibe with yours. 'My book is *Howl's Moving Castle* meets *Gormenghast*' — readers love these. You can add up to 5."
  - 5 slots — each is a recessed input. Last empty slot shows "+ Add another title" inline.
  - Example chips: "Piranesi", "House of Leaves", "The Night Circus" (click → fills next empty slot).
- **Tags** (optional, up to 10):
  - Helper: "Short labels readers can search for — **'cozy'**, **'second-world fantasy'**, **'time loop'**. Add 1-10."
  - Inline chip strip: existing tag chips + "+ Add tag" button opens an autocomplete from the tags-data list.

**Next button copy:** "Next: shape your manuscript →"

---

### Step 3 — Structure

**Headline:** "Pick a starting structure."
**Lede:** "We'll create the binder for you. *You can rearrange or rename anything later.*"

**Form body** — 2-column:

- **Left column** — Standalone vs Series picker (the existing structure question).
  - Two stacked cards, the active one filled in brand-soft (`oklch(from var(--brand) l c h / 0.12)`) with brand border.
  - Card 1 "Standalone": Helper "One self-contained story. Most novels live here."
  - Card 2 "Part of a series":
    - Inline subform: Series name + Book number (recessed inputs).
    - Helper: "If you're writing the second book of *The Stormlight Archive*, name the series and put **'2'** here. We'll show prev/next links on the reader page."
- **Right column** — Template picker:
  - Helper at top: "Pick a manuscript template. **Novel** gives you 24 chapters, **Short story** gives you 1. Don't sweat it — you can add/remove chapters once you're inside."
  - Vertical list of template tiles (existing template data). Each tile: small icon + name + short description + chapter count. Click selects; selected tile gets brand border + filled brand-soft bg + brand-ink check on the right.

**Next button copy:** "Next: who can see it →"

---

### Step 4 — Sharing

**Headline:** "Who should see this book?"
**Lede:** "Most writers start private and switch later — pick what feels right today."

**Form body** — single column with the existing `<SharingControls>` component, re-skinned:

- **Visibility** — three radio cards (existing Private / Friends / Public). Each card gets the new chrome:
  - Idle: tile gradient + tile shadow + `--r-card` (slightly larger for cards: 18px) + Lock/Users/Globe icon in ink-muted.
  - Active: brand border + brand-soft bg + brand-yellow icon + bold label.
  - Helper per card (already in existing component — preserve copy).
- **Discoverable** (only enabled when visibility = PUBLIC):
  - Recessed input bg around the entire toggle row.
  - Custom checkbox swatch matching the hive settings page (T12 pattern): solid brand-yellow square with brand-ink check when checked; recessed empty when unchecked.
  - Helper: "Discoverable books show up on /discover. Uncheck if you want a public-but-unlisted link only."

**Next button copy:** "Create your book ✨" — submits.

On submit:
- Loading spinner replaces the Next CTA.
- On success: redirect to `/${locale}/studio/${newBookId}` (existing behavior).
- On failure: sonner toast + Next CTA re-enabled.

---

## Cover-Image Upload Wiring

New behavior: file upload. Spec:

- Click dropzone OR drag a file → file picker / drop event → file passed to existing Cloudinary upload helper at `lib/cloudinary.ts` (or wherever the helper lives — verify in implementation).
- File constraints: PNG / JPG / WEBP, ≤ 5 MB. Reject others with sonner toast.
- Upload happens client-side; on success, returned `coverUrl` is written into form state.
- Preview thumbnail replaces dropzone after successful upload, with a "Change image" link below.
- URL input below the dropzone still works as before — pasting a valid URL also sets `coverUrl`. The two paths are mutually-overwriting (the most recent one wins).
- Premium check: if there's a free-tier image quota, surface the limit copy inline (use whatever existing pattern the Cloudinary helper exposes; if none, defer).

---

## Implementation Notes

- The existing `BookCreationForm` orchestrator (`app/[locale]/(app)/studio/new/_components/book-creation-form.tsx`) stays. Internal state, `update()`, `goNext()`, `goBack()`, `jumpTo()`, and the step-enter animations all preserved.
- The 4 step components (`StepOne`, `StepTwo`, `StepThree`, plus the inline Step 4 sharing controls) get re-skinned in place.
- The progress bar (currently in `wizard-progress.tsx`) gets the new pill treatment.
- All inline `#1c1c1c` / `bg-[#1c1c1c]` / etc. dark hex literals replaced with the design system tokens.
- Helper text becomes mandatory — every existing label gets a 1-3 sentence explanation added.
- Example chips: new pattern. Add `examples?: string[]` to the relevant field components and render the chip strip when provided.
- Step 4's `SharingControls` component is shared between the wizard and the Details page (see `components/book/sharing-controls.tsx`). Re-skin once — both consumers inherit.

### Accessibility

- Progress bar pills are buttons with `aria-current="step"` on the active one.
- Form labels associate via `<label htmlFor>` or wrapping pattern (preserve existing accessibility).
- Helper text uses `aria-describedby` linking back to the input.
- Dropzone is keyboard-accessible (Enter / Space triggers file picker).
- Example chips are buttons (not divs) with descriptive `aria-label`s.
- Focus ring on inputs uses `box-shadow` for visibility (already in spec).

---

## Risks & Trade-offs

- **Helper text adds vertical density** even with the 2-col layout. Step 1 should fit; Step 2 (genre + comps + tags) might still scroll on shorter viewports. Acceptable — Chris asked "if possible" for no scroll, not "must".
- **Cover dropzone** adds client-side upload complexity. If the Cloudinary helper isn't easily wirable client-side, fall back to a stubbed file picker that just reads the file as a data-URL and sets that as `coverUrl` (good enough for a v1; cleaner upload path is a follow-up).
- **Textarea-bg new value** (`oklch(0.245)`) is currently a one-off — if other surfaces want it, promote to a real token.
- **No-glow Next button** is an explicit Chris call. If we ever want emphasis on the CTA elsewhere, the system already has `--sh-tile` and the brand bg — they provide enough lift without a glow.

---

## Acceptance

Each of the 4 wizard steps visually matches the approved mockup at `.superpowers/brainstorm/33950-1780351986/content/wizard-step1-v2.html` (Step 1 reference; Steps 2-4 apply the same chrome pattern with their step-specific content per the section above). Every existing affordance (validation, navigation, template selection, sharing controls, etc.) remains operable. The 4-step structure and underlying field set are unchanged. tsc clean. All 424+ tests still pass.
