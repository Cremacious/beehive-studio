<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Beehive Studio — Project Status

**Slogan:** "Get buzzed about writing!"

## What This Is

Beehive Studio is a solo-developer writing platform: rich-text book editor, Hive collaboration groups, and a community discovery feed. Dark-only, bee-themed. Built with Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (New York style), Drizzle ORM on Neon Postgres.

## What Has Been Built

### Phase 1 — Foundation ✅ COMPLETE
- Full DB schema: `users`, `userProfiles`, `userBilling`, `books`, `binderItems`, `chapters`, `chapterSnapshots`, `hives`, `hiveMembers`, social tables, `exportPresets`, `bookTemplates`
- Auth: better-auth v1 (email/password + Google OAuth; Apple pre-wired for when creds are ready)
- Middleware: locale routing (next-intl, `localePrefix: 'always'`), auth guard, onboarding gate
- Route groups: `(public)` (landing, legal), `(auth)` (sign-in, sign-up, forgot-password, reset-password, onboarding), `(app)` (studio, discover, community)
- Onboarding actions: `checkUsernameAvailableAction`, `completeOnboardingAction`
- Cloudinary image upload wiring
- Rate limiting: 7 Upstash limiters
- Seed scripts: export presets + book templates

### Phase 2 — Studio Server Layer ✅ COMPLETE
All server actions are done. No UI yet — pages are stubs. Tests: 45/45 passing. TypeScript: clean.

Files created:
- `lib/premium.ts` — `FREE_BOOK_LIMIT=3`, `getUserPremiumStatus()`, `requirePremium()`
- `lib/tiptap-utils.ts` — `extractWordCount()` (pure, unit tested)
- `lib/validations/book.ts` — Zod schemas for all book/binder/chapter/publishing operations
- `lib/actions/_helpers.ts` — shared `assertBookOwner()`
- `lib/actions/book.actions.ts` — `createBookAction`, `getUserBooksAction`, `getBookAction`, `updateBookAction`, `publishBookAction`, `unpublishBookAction`, `deleteBookAction`
- `lib/actions/binder.actions.ts` — `getBinderTreeAction`, `createBinderItemAction`, `updateBinderItemAction`, `deleteBinderItemAction`, `reorderBinderItemsAction`
- `lib/actions/chapter.actions.ts` — `getChapterAction`, `saveChapterAction` (word count + 60s snapshot throttle), `updateChapterStatusAction`, `updateChapterNotesAction`
- `lib/actions/snapshot.actions.ts` — `getChapterSnapshotsAction`, `restoreSnapshotAction` (both premium-gated)
- `lib/actions/publishing.actions.ts` — `getPublishingMetadataAction`, `updatePublishingMetadataAction` (premium), `getExportPresetsAction`

## What's Next

### Immediate: Port Claude Designs to Pages (UI work)

HTML design files are in `designs/`. These need to be mechanically ported to the existing page stubs — convert HTML/CSS to JSX, wire up existing actions. No design decisions. Pixel-faithful to the designs.

| Design File | Target Page | Notes |
|---|---|---|
| `designs/beehive-landing-page.html` | `app/[locale]/(public)/page.tsx` | Main landing page |
| `designs/Sign In.html` | `app/[locale]/(auth)/sign-in/page.tsx` | |
| `designs/Sign Up.html` | `app/[locale]/(auth)/sign-up/page.tsx` | |
| `designs/Forgot Password.html` | `app/[locale]/(auth)/forgot-password/page.tsx` | |
| `designs/onboarding-username.html` | `app/[locale]/(auth)/onboarding/page.tsx` | Multi-step: username → avatar → profile |
| `designs/onboarding-avatar.html` | Same onboarding page | Step 2 |
| `designs/onboarding-profile.html` | Same onboarding page | Step 3 |
| `designs/privacy-policy.html` | `app/[locale]/(public)/privacy/page.tsx` | |
| `designs/studio-empty.html` | `app/[locale]/(app)/studio/page.tsx` | Empty state (no books yet) |

**How to port:** Read the design HTML, reproduce it as JSX using Tailwind v4 classes (or the closest equivalent). Wire server actions where needed (e.g. sign-in page calls better-auth's `signIn.email`, onboarding calls `completeOnboardingAction`).

### After UI Ports
- Phase 3: Book editor (TipTap + binder tree UI)
- Phase 4: Hive collaboration
- Phase 5: Publishing & exports
- Phase 6: Discover feed
- Phase 7: Community
- Phase 8: Stripe monetization

## Key Patterns

### Server Actions
```ts
'use server'
// requireAuth() → userId (throws AuthError if not authed or banned)
// validate with Zod → return { success: false, error } if invalid
// check ownership with assertBookOwner() from lib/actions/_helpers.ts
// ActionResult<T> = { success: true; data: T } | { success: false; error: string }
```

### Premium Errors
- `{ success: false, error: 'FREE_LIMIT_REACHED' }` — show upgrade prompt
- `{ success: false, error: 'PREMIUM_REQUIRED:<feature>' }` — show upgrade prompt

### Brand Tokens (defined in `app/globals.css`)
- Background: `#141414` (`--background`)
- Brand yellow: `#FFC300` (`--color-brand`)
- Border: `#2a2a2a` (`--border`)
- Font: Comfortaa (headings/brand), Geist (body)
- Dark-only — `<html className="dark">` is set in root layout

### DB
```ts
import { db } from '@/db'              // Drizzle ORM instance
import { books, chapters, ... } from '@/db/schema'  // all tables
```

### Auth
```ts
import { auth } from '@/lib/auth'      // better-auth instance
import { requireAuth } from '@/lib/require-auth'  // server action guard
```

### Tests
```bash
npm test          # vitest run (pure unit tests only — DB-dependent code uses tsc)
npx tsc --noEmit  # type check everything
```

## Free Tier Limits
- 3 books max (`FREE_BOOK_LIMIT`)
- 3 Hives max (`FREE_HIVE_LIMIT`)
- 5 Hive members max (`FREE_HIVE_MEMBER_LIMIT`)
- No version history (snapshots are premium only)
- No publishing metadata editing (premium only)
