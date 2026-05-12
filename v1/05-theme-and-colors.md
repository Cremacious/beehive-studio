# Beehive Books v1 — Theme & Colors

> Source app: `C:\Code\personal\beehive-books-online`
> Stack: Tailwind CSS v4 (CSS-based config) + shadcn/ui (new-york style) + Radix UI primitives.

There's also a long-form `DESIGN_SYSTEM.md` at the v1 repo root — this doc captures everything that matters for a v2 rebuild, condensed.

---

## 1) Brand identity

- **Vibe:** Dark, warm, premium — like a late-night indie bookshop. Cozy but confident.
- **Not:** Cold, clinical, corporate, generic SaaS.
- **Bar:** Better-looking than Royal Road, approaching Kindle / Wattpad quality.
- **Theme mode:** Dark only — there is no light mode in the live app, even though light-mode CSS variables exist as a fallback.

The brand color is a single warm yellow (`#FFC300`) used for CTAs, active states, focus rings, links, and the custom scrollbar.

---

## 2) Color palette in plain English

### Brand
| Token | Hex | Usage |
|---|---|---|
| Brand yellow | `#FFC300` | Primary CTAs, active state, links, accent text, scrollbar thumb, focus ring |
| Brand yellow hover | `#FFD040` | CTA hover |
| Brand yellow active | `#e0ac01` | CTA pressed |

### Surfaces (dark theme)
| Layer | Hex | Usage |
|---|---|---|
| Page background | `#141414` | Body background |
| Card / surface | `#1c1c1c` | Cards, modals, panels |
| Elevated surface | `#252525` | Sidebar, inputs, dropdowns |
| Borders / dividers | `#2a2a2a` | Subtle borders, dividers, disabled states |
| Inset / inner | `#1e1e1e` | Cookie banner, input inner, tag chips |
| Card hover shadow | `rgba(0,0,0,0.4)` | `shadow-black/40` |

### Text (opacity-based on white)
| Token | Equivalent | Usage |
|---|---|---|
| `text-white` | 100% | Headings, body, UI labels |
| `text-white/90` | ≈`#e5e5e5` | Reading content; minimum for readable text |
| `text-white/80` | ≈`#cccccc` | Secondary text |
| `text-white/70` | ≈`#b3b3b3` | Captions, supporting text |
| `text-white/30` | ≈`#4d4d4d` | Placeholder, disabled — **never** for readable content |

> **Rule:** Don't drop below `text-white/40` for readable content.

### Semantic
| Intent | Text | Background | Border |
|---|---|---|---|
| Success | `text-green-400` | `bg-green-400/10` (or `bg-green-500/10`) | `border-green-500/20` |
| Error / destructive | `text-red-400` | `bg-red-900/20` (or `bg-red-500/10`) | `border-red-500/20` |
| Warning | `text-yellow-400` | `bg-yellow-400/10` | `border-yellow-500/20` |
| Info | `text-blue-400` | `bg-blue-400/10` | `border-blue-500/20` |
| Premium / brand | `text-[#FFC300]` | `bg-yellow-500/10` | `border-yellow-500/30` |

### Charts (recharts, admin dashboards)
Five chart colors, set via `--chart-1` … `--chart-5`. In dark mode they read as: indigo/purple, teal/cyan, warm orange, magenta/purple, red/warm.

---

## 3) CSS variables (`app/globals.css`)

The token system uses **OKLCH** colors (perceptually uniform). Both `:root` (light fallback) and `.dark` (the actual app theme) are defined. Tailwind v4 picks them up via an `@theme inline` block.

### Dark mode tokens (the live app)
```css
.dark {
  --background:               oklch(0.145 0 0);             /* near #141414 */
  --foreground:               oklch(0.985 0 0);             /* near white */
  --card:                     oklch(0.205 0 0);             /* near #1c1c1c */
  --card-foreground:          oklch(0.985 0 0);
  --popover:                  oklch(0.205 0 0);
  --popover-foreground:       oklch(0.985 0 0);
  --primary:                  oklch(0.922 0 0);             /* near white */
  --primary-foreground:       oklch(0.205 0 0);
  --secondary:                oklch(0.269 0 0);             /* mid-dark gray */
  --secondary-foreground:     oklch(0.985 0 0);
  --muted:                    oklch(0.269 0 0);
  --muted-foreground:         oklch(0.708 0 0);             /* ~text-white/60 */
  --accent:                   oklch(0.269 0 0);
  --accent-foreground:        oklch(0.985 0 0);
  --destructive:              oklch(0.704 0.191 22.216);    /* lighter red */
  --border:                   oklch(1 0 0 / 10%);           /* white at 10% */
  --input:                    oklch(1 0 0 / 15%);           /* white at 15% */
  --ring:                     oklch(0.556 0 0);
  --chart-1:                  oklch(0.488 0.243 264.376);   /* indigo/purple */
  --chart-2:                  oklch(0.696 0.17  162.48);    /* teal/cyan */
  --chart-3:                  oklch(0.769 0.188 70.08);     /* warm orange */
  --chart-4:                  oklch(0.627 0.265 303.9);     /* bright magenta */
  --chart-5:                  oklch(0.645 0.246 16.439);    /* red/warm */
  --sidebar:                  oklch(0.205 0 0);             /* near #1c1c1c */
  --sidebar-foreground:       oklch(0.985 0 0);
  --sidebar-primary:          oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent:           oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border:           oklch(1 0 0 / 10%);
  --sidebar-ring:             oklch(0.556 0 0);
}
```

### Light mode tokens (fallback only — not used in the live UI)
```css
:root {
  --radius:               0.625rem; /* 10px */
  --background:           #1a1a1a;
  --foreground:           oklch(0.985 0 0);
  --card:                 oklch(1 0 0);
  --card-foreground:      oklch(0.145 0 0);
  --popover:              oklch(1 0 0);
  --popover-foreground:   oklch(0.145 0 0);
  --primary:              oklch(0.205 0 0);
  --primary-foreground:   oklch(0.985 0 0);
  --secondary:            oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted:                oklch(0.97 0 0);
  --muted-foreground:     oklch(0.556 0 0);
  --accent:               oklch(0.97 0 0);
  --accent-foreground:    oklch(0.205 0 0);
  --destructive:          oklch(0.577 0.245 27.325);
  --border:               oklch(0.922 0 0);
  --input:                oklch(0.922 0 0);
  --ring:                 oklch(0.708 0 0);
  /* + chart-1..5 + sidebar.* aliases — see globals.css */
}
```

### Tailwind v4 `@theme` mapping
Inside `@theme inline { ... }`, tokens are aliased so Tailwind classes pick them up:
```
--color-background, --color-foreground
--color-card, --color-card-foreground
--color-popover, --color-popover-foreground
--color-primary, --color-primary-foreground
--color-secondary, --color-secondary-foreground
--color-muted, --color-muted-foreground
--color-accent, --color-accent-foreground
--color-destructive
--color-border, --color-input, --color-ring
--color-chart-1 ... --color-chart-5
--color-sidebar, --color-sidebar-foreground, --color-sidebar-primary,
--color-sidebar-accent, --color-sidebar-border, --color-sidebar-ring
--radius-sm, --radius-md, --radius-lg, --radius-xl, --radius-2xl, --radius-3xl, --radius-4xl
```

### Border radius scale
Base `--radius: 0.625rem` (10px). Tailwind variants:
- `rounded-sm` → 6px
- `rounded-md` → 8.5px
- `rounded-lg` → 10px (base)
- `rounded-xl` → 14px ← **default for cards / inputs**
- `rounded-2xl` → 18px
- `rounded-3xl` → 22px
- `rounded-4xl` → 26px

---

## 4) Tailwind v4 config (CSS-based)

There's no `tailwind.config.ts` to speak of — config lives in CSS via the v4 model. PostCSS pipeline is `@tailwindcss/postcss`.

`globals.css` imports:
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

### Custom utilities defined in `globals.css`
- **`@utility mainFont`** — `font-family: 'Comfortaa', sans-serif;`
- **`@utility scrollbar-hide`** — cross-browser scrollbar removal.
- **`@utility paper-grit`** — subtle noise overlay (radial dot pattern + slight gradient). 18×18px tile.
- **`@utility paper-stack`** — handmade "stacked-paper" surface:
  ```css
  border: 1px solid #2a2a2a;
  border-bottom-color: #111;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.04) inset,
    0 3px 0 rgba(0,0,0,0.32);
  ```
- **`@utility paper-stack-hover`** — animated hover for `paper-stack`:
  - 200ms transition on color/bg/border/box-shadow/transform
  - Border shifts to `rgba(255,195,0,0.35)` (brand yellow @ 35%)
  - Shadow grows to `0 4px 0 rgba(0,0,0,0.32)`
  - `transform: translateY(-1px)` — subtle lift

### Custom keyframes
```css
@keyframes wiggle { 0% {rotate:0}; 20% {rotate:10deg}; 40% {rotate:-8deg}; 60% {rotate:6deg}; 80% {rotate:-4deg}; 100% {rotate:0} }
.animate-wiggle { animation: wiggle 0.6s ease-in-out; }
```

### Custom scrollbar
- `.scrollbar-custom` — yellow thumb (`#FFC300`), hover `#FFD040`, transparent track, 8px height.
- `.scrollbar-hide` — removes scrollbars entirely (webkit + Firefox + IE/Edge).

---

## 5) Typography

### Fonts loaded
- **Comfortaa** (Google Fonts) — loaded in the root layout via `next/font/google`.
  - Weights: 300, 400, 500, 600, 700
  - CSS variable: `--font-comfortaa`
  - Display: `swap`
  - Used via the `mainFont` utility class — applied to headings and prominent UI labels.
- **Geist Sans** — Tailwind/shadcn default `font-sans`. Used for body text.
- **Geist Mono** — default `font-mono`. Used for code blocks.

### Sizes (Tailwind scale, in actual use)
| Class | Size | Usage |
|---|---|---|
| `text-xs` | 12px | Captions, timestamps, badges |
| `text-sm` | 14px | Body text, form labels, inputs |
| `text-base` | 16px | Default paragraph |
| `text-lg` | 18px | Smaller card titles |
| `text-xl` | 20px | Card titles, page subheadings |
| `text-2xl` | 24px | Page headings, section titles |
| `text-3xl` | 30px | Hero headings, landing pages |
| `text-4xl+` | 36px+ | Landing only |

### Weights
- `font-normal` (400) — body
- `font-medium` (500) — labels, nav items
- `font-semibold` (600) — subheadings, card titles
- `font-bold` (700) — page headings, CTAs, brand elements

### Line-heights
Default Tailwind. Buttons use `leading-none` for compact CTA labels.

---

## 6) shadcn/ui — what's installed

From `components.json` and `components/ui/`:

| Component file | Notes |
|---|---|
| `button.tsx` | Custom CVA-based variants (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) and sizes (`xs`, `sm`, `default`, `lg`, icon variants). |
| `badge.tsx` | Variants (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`). |
| `skeleton.tsx` | Pulse-animated; includes a `UserSkeleton` helper. |
| `tag-input.tsx` | Custom add/remove tag input. |
| `badge-count.tsx` | Badge with a numeric count. |
| `cookie-banner.tsx` | Fixed bottom dismissible cookie banner. |
| `popup.tsx` | Portal-based modal with scroll + max-width control. |

Other primitives (inputs, selects, forms) are **styled directly with Tailwind in their consuming components** — the project doesn't ship a shadcn `input` or `select` wrapper. Forms use `react-hook-form` + Zod.

Other foundations:
- **Icons:** `lucide-react`. Default `w-5 h-5` (20px), smaller `w-4 h-4` (16px).
- **Class merging:** `clsx` + `tailwind-merge` via a `cn()` utility in `lib/utils.ts`.
- **State:** Zustand (client) + TanStack Query (server cache).
- **Editor:** TipTap v3.

---

## 7) Component / pattern conventions

### Buttons (CVA variants)
**Primary CTA**
```css
bg-[#FFC300] text-black font-bold rounded-full py-3 px-6
hover:bg-[#FFD040]
active:bg-[#e0ac01]
disabled:opacity-50 disabled:cursor-not-allowed
```
- `mainFont` (Comfortaa)
- Pill shape
- Default size `h-10 px-5 py-2`

**Secondary**
```css
bg-transparent border border-[#2a2a2a] text-white rounded-xl py-2 px-4
hover:border-[#FFC300]/40 hover:text-[#FFC300]
```

**Ghost**
```css
text-white/80 rounded-lg px-3 py-2
hover:text-white hover:bg-white/5
```

**Destructive**
```css
text-red-400 border border-red-500/20 rounded-xl
hover:bg-red-400/10
```

**Link**
```css
text-[#FFC300] underline-offset-4 hover:underline
```

### Inputs
```css
bg-[#252525] border border-[#2a2a2a] rounded-xl px-4 py-3
text-white placeholder-white/30
focus:outline-none focus:ring-1 focus:ring-[#FFC300]/30
```
- Minimum height ~44px (mobile touch target).
- Selects mirror the same look (`appearance-none cursor-pointer`).

### Tags
- Each tag: `bg-[#1e1e1e] border border-[#2a2a2a] rounded-full text-xs text-white`
- Remove: `hover:text-red-400`
- Add: `bg-[#FFC300]/15 text-[#FFC300]`

### Badges
| Variant | Classes |
|---|---|
| Default / brand | `bg-[#FFC300]/10 text-[#FFC300] hover:bg-[#FFC300]/15` |
| Secondary | `bg-white/6 text-white font-normal hover:bg-white/10` |
| Outline | `border-[#2a2a2a] text-white hover:bg-white/5` |
| Destructive | `bg-red-400/10 text-red-400 border-red-500/20 hover:bg-red-400/15` |

### Avatars (3 states required)
1. **Loading:** `animate-pulse bg-[#2a2a2a] rounded-full` skeleton, size-matched.
2. **Loaded:** `<Image fill object-cover rounded-full />`.
3. **Fallback:** initials in a colored circle (`bg-[#FFC300]/10 text-[#FFC300]`).

Optional brand ring: `ring-2 ring-[#FFC300]/20`.

Sizes: `w-7 h-7` (lists) / `w-9 h-9` (default/nav) / `w-12 h-12` (profile cards) / `w-16 h-16` (profile header).

### Page shell template
```tsx
<div className="flex-1 flex flex-col min-h-screen bg-[#141414]">
  <div className="border-b border-[#2a2a2a] px-6 py-4">
    <h1 className="text-xl font-bold text-white mainFont">Page Title</h1>
  </div>
  <div className="flex-1 px-4 md:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full">
    {/* content */}
  </div>
</div>
```

### Back button pattern
```tsx
<Link
  href="/previous"
  className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-[#FFC300]
             transition-colors rounded-2xl border border-white/10 px-3 py-2
             hover:bg-white/5 hover:border-[#FFC300]/30"
>
  <ChevronLeft className="w-4 h-4 text-[#FFC300]/60" />
  Back to Library
</Link>
```
- Always contextual label (not "Back").
- Top-left, before the page heading.
- Skip on top-level nav pages (Home, Explore, Library, Hive).

### `TactileSurface` (v2 components)
`components/v2/tactile-surface.tsx` wraps the paper effects:
- Always: `rounded-xl bg-[#1c1c1c] paper-stack`
- Props: `as` (div / section / article / aside), `interactive` (adds `paper-stack-hover`), `grit` (adds `paper-grit`).
- Used as the base for cards, panels, dashboard tiles in the v2 surfaces.

---

## 8) Layout & spacing

### Required `max-w-*` per page
| Context | Class | Width |
|---|---|---|
| Reading content (chapter reader) | `max-w-2xl` | 672px |
| Forms / auth | `max-w-md` | 448px |
| Standard page | `max-w-4xl` | 896px |
| Wide pages (Explore, Library, dashboard) | `max-w-6xl` | 1152px |
| Hero / top-level shells | `max-w-7xl` | 1280px |

### Sidebar widths (responsive)
- `w-20` (80px) collapsed (icon only) — md and below
- `w-64` (256px) compact — lg
- `w-72` (288px) standard — xl
- `w-80` (320px) wide — 2xl

### Padding scale
- Page horizontal: `px-4` (mobile) → `px-6` (tablet) → `px-8` (desktop)
- Card padding: `p-4` / `p-6` / `p-8`
- Gaps: `gap-4` / `gap-6` / `gap-8`; section breaks `gap-12`

### Common grids
- Books: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` with `gap-4`.
- Members: auto-fit responsive grid.

---

## 9) Responsive breakpoints

| Breakpoint | Min width | Notes |
|---|---|---|
| (default) | 0 | Mobile-first |
| `sm` | 640px | Large phone |
| `md` | 768px | Tablet — sidebar appears |
| `lg` | 1024px | Laptop — wider content |
| `xl` | 1280px | Desktop — full nav, wide grids |
| `2xl` | 1536px | Large monitor — max widths apply |

Recommended dev test sizes: 390 / 768 / 1440 / 1920 / 2560.

---

## 10) Animations

- Default: `transition-colors duration-200`
- Property bag: `transition-all duration-200`
- Hover lift: `hover:-translate-y-0.5 transition-transform`
- Paper-stack hover (lift + border highlight + shadow growth) on tactile surfaces
- Skeleton loaders: `animate-pulse` on `bg-[#2a2a2a] rounded`
- Spinners: `animate-spin` on `<Loader2 />`
- Branded: `animate-wiggle` (the bee wiggle, 0.6s)
- Page transitions: `animate-in fade-in duration-200`

**Rule:** Every interactive element must have a hover state.

---

## 11) Touch targets & a11y

- Minimum tap area: **44 × 44 px** on mobile.
- Buttons: `min-h-[44px]` on mobile, `min-w-[44px]` for icon-only.
- Icon buttons: at least `p-2` for padding.
- Form inputs: `py-3` to keep total height in the 44–52px range.
- Decorative icons: `aria-hidden="true"`.
- WCAG AA contrast minimum on all text.

---

## 12) Pre-ship UI checklist

- [ ] No `text-white/40` or lower on readable text.
- [ ] Every interactive element has a visible hover state.
- [ ] Page has a `max-w-*` constraint.
- [ ] Verified at 390 / 1440 / 1920+ widths.
- [ ] Avatars handle all three states (loading / loaded / fallback).
- [ ] Back button on drill-down pages with a contextual label.
- [ ] Empty states explain the feature with a CTA.
- [ ] Touch targets ≥ 44px on mobile.
- [ ] Skeletons used for async content.
- [ ] Forms surface validation clearly.

---

## 13) Brand assets in `public/`

Logos:
- `public/logo.png`
- `public/logo2.png`
- `public/logo3.png`

Default Next.js / Vercel starter SVGs (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) are still in `public/` but unused by the brand surface.

---

## 14) Things to revisit in v2

- **Brand color hardcoded** (`#FFC300`, `#1c1c1c`, `#2a2a2a`, …) literally everywhere instead of going through tokens. v2 should commit to either:
  - replacing all hardcoded colors with semantic Tailwind tokens (`bg-card`, `border-border`, etc.), **or**
  - defining brand-specific tokens (`--color-brand`, `--color-surface`, …) and using those.
- **Light mode CSS exists but isn't reachable** — either delete it or actually ship a light theme.
- **Two parallel design surfaces** (legacy and v2 with `paper-stack`/`TactileSurface`). v2 of the studio should pick one and migrate.
- **shadcn coverage is partial** — input/select/form components are custom one-offs. Standardize via shadcn primitives in v2 to cut visual drift.
- **Typography is mostly Comfortaa for headings + Geist Sans for body**, but the rule isn't enforced. v2 could codify it in the token layer.
- **Charts use vivid OKLCH purples / teals / oranges** that don't tie back to the warm brand. v2 could pick chart colors that come *from* the brand palette rather than alongside it.
