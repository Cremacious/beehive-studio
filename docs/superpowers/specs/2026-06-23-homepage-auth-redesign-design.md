# Issue #41 — Homepage + Auth Redesign (design)

**Date:** 2026-06-23
**Issue:** #41 — Homepage redesign (landing/selling page) + auth pages industry-standard redesign
**Status:** Designs locked via mockup review. Implementation pending final approval (no code committed yet).

Mockups: `.superpowers/brainstorm/homepage-auth-redesign-2026-06-23/content/` —
`home-a-editor-spotlight.html`, `home-b-narrative.html`, `home-c-bento.html`, `auth-mockups.html`, shared `tokens.css`.

## Context / why this is mostly a homepage job

The **auth pages are already on the new design system** (panel chrome, recessed `--canvas-dark-100` inputs, brand-yellow pill CTAs, OAuth tiles with Google + Apple "Soon", show/hide password, onboarding step pill bar). The **homepage is the only surface still on the old aesthetic** (`#141414`, `bg-card`, `paper-stack`, `text-white/65`, `border-border`, `mainFont`). So the homepage is a full rebuild; auth is surgical additions on top of what already ships.

## Locked decisions

- **Homepage = Variant B (Narrative).** Centered hero + wide editor "showcase", zigzag feature rows with mini-mockups, pricing preview, closing CTA, footer.
- **No testimonials section** and **no stats / social-proof section** (no real numbers to show). The page omits social proof entirely for v1.
- **Auth layout = Take 1 (centered card)**, refined version of the current pattern with a soft brand glow behind the card.
- **Onboarding stays 3 steps** (Username → Profile → Photo). `completeOnboardingAction` and DB schema untouched. Chrome/copy polish only.
- **Forgot/reset gain a 3-step indicator** (Enter email → Check inbox → New password) plus clearer success states.
- All user-facing copy: **no em-dashes** (project rule). Brand-yellow reserved for CTAs, accent eyebrows, the Premium tier, active/step states. No pure white or pure black backgrounds.

## Design system / tokens

Reuse `app/globals.css` tokens verbatim — no new tokens. Key ones: `--canvas-dark-100..400`, `--canvas-dark-ink[-faint|-muted|-strong]`, `--brand`/`--brand-hover`/`--brand-ink`, `--r-card/-row/-btn/-pill`, `--sh-card/-tile/-inset`, `--br-card`. Fonts: Comfortaa (`--font-display`/`mainFont`) for headings + UI, JetBrains Mono (`--font-mono`) for eyebrow/labels, Newsreader (`--font-prose`) for the in-mock prose.

**Marketing canvas:** the homepage uses a surface one notch lighter than the app interior (`#262728`) so the landing reads as its own "lobby". Implement as a local constant (e.g. `oklch(0.255 0.004 256)` for the base, a slightly deeper `oklch(0.225 0.004 256)` for footer/alt bands). Accent tints for the four pillars reuse existing categorical tokens: Studio = `--status-first-draft`-ish gold, Hives = mint (`--accent-hive` ~ `oklch(0.74 0.12 145)`), Sparks = warm gold (`oklch(0.78 0.13 70)`), Discover = sky blue (`oklch(0.72 0.11 230)`). These are used at low opacity for icon chips only, not as chrome.

## Homepage structure (`app/[locale]/(public)/page.tsx`)

Server component, full rewrite. Sections in order:

1. **Marketing nav** — sticky, blurred lobby bg, logo + Features / Pricing / Voices-removed / Discover + Sign in, brand "Start writing" pill. (For authed users the `(public)/layout.tsx` already renders `AppNav`; see "Layout / chrome" below.)
2. **Hero** — centered, brand-glow radial behind. Beta badge, big Comfortaa headline ("Write the book. Find your readers."), subhead, CTA row (brand "Start writing free" → `/sign-up`, ghost "See how it works" → anchor to features). Inline trust line (free forever / no card / export formats).
3. **Editor showcase** — wide framed panel under the hero: binder column (sample chapters, active row) + prose column (Newsreader sample) + Hive feedback column (2 comment cards). Decorative/static.
4. **Zigzag feature rows** (4 pillars across 3 rows): Studio (binder + goal bar mini), Hives (activity feed mini), Sparks + Discover combined (spark card + book shelf mini). Each row: eyebrow + heading + copy + 3-bullet list on one side, a `tile` mini-mock on the other; alternating sides; stacks on mobile.
5. **Pricing preview** — Free vs Premium two-card compare, Premium has brand border + "Most popular" pill, CTA "See full pricing" → `/pricing`, Free CTA "Start free" → `/sign-up`.
6. **Closing CTA band** — gradient band, headline + brand CTA.
7. **Footer** — full marketing footer: brand blurb + socials, Product / Community / Company columns, legal links (Privacy/Terms/DMCA all locale-prefixed), copyright + slogan.

**Components:** extract reusable bits under `(public)/_components/` (e.g. `marketing-nav.tsx`, `marketing-footer.tsx`, plus section components or inline in the page if small). Icons inline as SVG (the page already does this). All hrefs locale-prefixed.

## Layout / chrome reconciliation

`(public)/layout.tsx` currently renders `AppNav` (only when authed) + always renders the slim `AppFooter`, and wraps in `bg-[#262728]`. The homepage renders its OWN marketing nav + footer, so:

- A **guest** on `/` would get the marketing nav + marketing footer + the slim `AppFooter` (double footer). Fix: the homepage owns its chrome; suppress the slim `AppFooter` on the landing route. Cleanest: `AppFooter` already hides on the editor route via a pathname check — extend it to also return null on the exact landing path `/{locale}`. The marketing footer lives in the page.
- An **authed** user hitting `/` still gets `AppNav` from the layout. The marketing page should not render its own sticky nav on top of `AppNav`. Approach: render the marketing nav only for guests. The page is a server component with access to the session via the same `auth.api.getSession` call the layout uses; pass an `isAuthed` signal (re-fetch in the page, cheap) and conditionally render the marketing nav. (Authed users rarely land on `/`, but this avoids a stacked double nav.)
- The landing background uses the lighter `--lobby` surface; set it on the page root rather than relying on the layout's `#262728`.

## Auth changes (surgical, presentational)

Files: `(auth)/sign-in/_components/sign-in-form.tsx`, `(auth)/sign-up/_components/sign-up-form.tsx`, `(auth)/forgot-password/_components/forgot-password-form.tsx`, `(auth)/reset-password/_components/reset-password-form.tsx`, `(auth)/onboarding/_components/onboarding-flow.tsx`. Server actions and `lib/auth-client` calls untouched.

1. **Inline validation on blur.** Add a `touched` flag per field; on blur, validate format (email regex; password non-empty / min length on sign-up) and render the existing red-border + soft-red message treatment already used for the confirm-mismatch case. Submit-time server errors still render as today.
2. **Trust signal.** Add a centered lock-glyph line "Your writing is private by default." below the form on sign-in and sign-up (mint/`--accent-hive` glyph, faint ink).
3. **Soft brand glow** behind the auth card (radial `--brand` at very low alpha), matching the mockup, so the centered card isn't floating on flat dark. Add to the auth route — either the shared `(auth)/layout.tsx` wrapper or per page. (Note: onboarding renders its own full-page shell, not the auth layout; apply consistently.)
4. **Forgot/reset step indicator.** Add a shared 3-step indicator component (`Enter email → Check inbox → New password`) used by both forms. Forgot-password shows step 1 active, then a "Check your inbox" success state (step 2 active) after the link is sent, with a resend affordance. Reset-password shows step 3 active. Keep all existing submit logic.
5. **Onboarding** — chrome/copy polish only; pill bar + cards already match. Verify the lobby glow + logo header read consistently. No step/content/persistence changes.

## Acceptance criteria (from the issue) → coverage

- Homepage hero / features / pricing preview / footer ✓ (social proof intentionally omitted per decision).
- Mobile-responsive from 320px ✓ (mockups reflow; verify in implementation).
- Auth panel chrome / recessed inputs / brand CTAs ✓ (already present).
- Show/hide password ✓ (already present; reset-password gains it too).
- Inline validation on blur ✓ (new).
- Trust signal below auth forms ✓ (new).
- No em-dashes ✓ (enforced in copy).
- `tsc` clean + full `npm test` green ✓ (verify at the end).

## Out of scope / deferred

- Real social-proof data (numbers, testimonials) — add the section back when real data exists.
- Onboarding restructure to genre/intent steps (would need new server-action fields + DB columns).
- Apple OAuth (stays "Soon").
- Split brand-panel auth layout (Take 2) — not chosen.

## Verification plan

- Homepage at 320px / mobile / laptop / large monitor; all CTAs route (`/sign-up`, `/pricing`, footer legal links, anchor links).
- Every auth flow end-to-end: sign-up → onboarding → studio; sign-in; forgot → reset; Google OAuth; blur validation fires; trust signal shows.
- `npx tsc --noEmit` clean; `npm test` green; grep for em-dashes in changed user-facing strings.
