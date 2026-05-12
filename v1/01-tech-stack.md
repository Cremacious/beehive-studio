# Beehive Books v1 — Tech Stack Breakdown

> Source app: `C:\Code\personal\beehive-books-online`
> Version: `1.0.0-beta.2`
> Live at: [beehive-books.app](https://www.beehive-books.app)

A social writing platform for authors and readers — built on Next.js 16 App Router with React 19, deployed on Vercel.

---

## At a glance

| Category | Tech | Version |
|---|---|---|
| Framework | Next.js (App Router) | `16.1.6` |
| Runtime | React + React DOM | `19.2.3` |
| Language | TypeScript | `^5` |
| Styling | Tailwind CSS | `^4` |
| Component primitives | shadcn/ui + Radix UI | `radix-ui ^1.4.3` |
| Icons | lucide-react | `^0.575.0` |
| Animations | tw-animate-css | `^1.4.0` |
| Database | Neon (serverless Postgres) | via `@neondatabase/serverless ^1.0.2` |
| ORM | Drizzle ORM | `^0.45.1` (kit `^0.31.9`) |
| Auth | better-auth | `^1.5.5` |
| Server state | TanStack Query v5 | `^5.90.21` (+ devtools) |
| Client state | Zustand | `^5.0.11` |
| Forms | react-hook-form + Zod | `^7.71.2` / `^4.3.6` (+ `@hookform/resolvers ^5.2.2`) |
| Rich-text editor | TipTap v3 | `^3.20.0` (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/pm`) |
| Image uploads / CDN | Cloudinary + next-cloudinary | `^2.9.0` / `^6.17.5` |
| Payments | Stripe | `^20.4.1` |
| Rate limiting | Upstash Redis + Ratelimit | `^1.37.0` / `^2.0.8` |
| Email | Resend | `^6.9.4` |
| Internationalization | next-intl (EN, ES, FR, DE, PT) | `^4.8.3` |
| Drag and drop | dnd-kit (`core`, `sortable`, `utilities`) | `^6.3.1` / `^10.0.0` / `^3.2.2` |
| Charts | recharts | `^3.8.1` |
| Export — DOCX | html-to-docx, mammoth | `^1.8.0`, `^1.11.0` |
| Export — PDF | jspdf, html2canvas | `^4.2.0`, `^1.4.1` |
| Export — EPUB | @smoores/epub | `^0.1.9` |
| Diff/merge (suggestions) | diff-match-patch | `^1.0.5` |
| ZIP packaging | jszip | `^3.10.1` |
| ID generation | @paralleldrive/cuid2 | `^3.3.0` |
| Class-variance / merging | class-variance-authority, clsx, tailwind-merge | `^0.7.1` / `^2.1.1` / `^3.5.0` |
| Testing (E2E) | Playwright | `^1.58.2` |
| Linting | ESLint + eslint-config-next | `^9` / `16.1.6` |
| Hosting / Deploy | Vercel | (config in `vercel.json`) |

---

## Architectural pillars

### 1. App Router + Server Components first
- Next.js 16 App Router with the `app/[locale]/...` directory layout.
- Server Components are the default; Client Components opt in with `"use client"`.
- All routes live under a `[locale]` segment so every URL is locale-prefixed (`/en/home`, `/es/library`, etc.).

### 2. Server Actions over API routes
- **Mutations and most reads go through Server Actions** in `lib/actions/*.ts` (`"use server"` files).
- API route handlers (`app/.../route.ts`) are reserved for things that *must* be HTTP endpoints:
  - `app/api/auth/[...all]/route.ts` — better-auth catch-all
  - `app/api/stripe/webhook/route.ts` — Stripe webhook signature verification (raw body)
  - `app/api/stripe/checkout/route.ts` — Stripe Checkout session
  - `app/api/stripe/portal/route.ts` — Stripe Customer Portal session
  - `app/api/cron/cleanup/route.ts` — Vercel Cron entry point (Bearer-token auth)

### 3. Postgres via Drizzle on Neon serverless
- Schema lives in `db/schema.ts` (with split files under `db/schema/`) — declared in TypeScript with Drizzle table builders and relations.
- Connection through `@neondatabase/serverless` keeps cold-start friendly (HTTP/WebSocket pooling).
- Migrations + studio via `drizzle-kit` (`db:generate`, `db:push`, `db:studio`).

### 4. better-auth for identity
- Wraps Drizzle adapter with email/password + Google OAuth.
- Email verification is **toggleable** via `REQUIRE_EMAIL_VERIFICATION`.
- Sessions: 30-day expiry, daily refresh, HTTP-only cookies.
- Custom user fields layered on top: `username`, `bio`, `onboardingComplete`, `premium`, `role`, Stripe billing fields, `banned*`.

### 5. Cursor-based pagination + Upstash rate limiting
- Explore/search uses **timestamp cursors**, not offset pagination.
- All write actions and search endpoints are gated by Upstash Redis rate limiters defined in `lib/rate-limit.ts` (separate buckets: `signUpLimiter`, `signInLimiter`, `actionLimiter`, `searchLimiter`, `pageLimiter`, `apiLimiter`, `checkoutLimiter`).

### 6. Privacy model baked into the schema
Three visibility levels for almost every user-owned resource:
- `PRIVATE` — owner only
- `FRIENDS` — owner + accepted friends
- `PUBLIC` — anyone signed in
A separate `explorable` flag controls whether public content shows on the Explore page.

### 7. Premium / monetization layer
- Free vs Premium ($?/mo) — limits enforced through `lib/premium.ts` (`checkCreateLimit()`):
  - Free: books 5, clubs 3, hives 3, lists 5, prompts 3
  - Premium: unlimited + file export (EPUB / PDF / DOCX)
- Stripe Checkout + Customer Portal handled via `/api/stripe/*` route handlers, webhook keeps `users.premium` and `users.stripe*` in sync.

### 8. Internationalization
- `next-intl ^4.8.3` powers locale routing and translations.
- Translation files: `messages/en.json`, `messages/es.json`, `messages/fr.json`, `messages/de.json`, `messages/pt.json`.
- The middleware strips the leading locale segment before route matching.

### 9. Realtime-ish UX without sockets
- TanStack Query v5 owns server cache, optimistic updates, and refetch behavior.
- Zustand handles ephemeral client state (modals, drafts, UI toggles).
- No WebSockets or SSE — the app is request/response over Server Actions.

---

## Repository layout (top level)

```
beehive-books-online/
├── app/                  # Next.js App Router (all routes live here)
│   ├── [locale]/         # All app routes are locale-prefixed
│   │   ├── (app)/        # Authenticated app shell
│   │   ├── (auth)/       # Sign-in / sign-up / onboarding / etc.
│   │   └── (public)/     # Legal: privacy, terms, dmca, cookies
│   ├── api/              # API route handlers (auth, stripe, cron)
│   ├── layout.tsx        # Root layout (font, providers)
│   ├── not-found.tsx
│   ├── robots.ts
│   └── sitemap.ts
├── components/           # Shared UI (incl. v2 components, ui/ primitives)
├── db/
│   ├── schema.ts         # Drizzle schema (single entry)
│   └── index.ts          # DB client (Neon)
├── drizzle/              # Generated migrations
├── docs/                 # In-repo docs
├── hooks/                # Custom React hooks
├── i18n/                 # next-intl config
├── lib/
│   ├── actions/          # All server actions (`"use server"`)
│   ├── auth.ts           # better-auth config
│   ├── auth-client.ts    # better-auth client SDK
│   ├── require-auth.ts   # `requireAuth()` / `getOptionalUserId()` guards
│   ├── rate-limit.ts     # Upstash limiters
│   ├── stripe.ts         # Stripe SDK init
│   ├── email.ts          # Resend transport + templates
│   ├── cloudinary.ts     # Cloudinary helpers
│   ├── premium.ts        # Per-resource creation limits
│   ├── milestones.ts     # Achievement awarding
│   ├── notifications.ts  # `insertNotification()` helper
│   └── ...
├── messages/             # i18n translation JSON files
├── public/               # Static assets (logo.png, logo2.png, logo3.png, ...)
├── scripts/              # CLI scripts (e.g. seed-users.ts)
├── tests/                # Playwright tests
├── middleware.ts         # Auth gating, rate limits, locale routing, UA filters
├── next.config.ts
├── drizzle.config.ts
├── playwright.config.ts
├── tailwind / postcss config
└── package.json
```

---

## Environment variables

| Var | Purpose | Required for dev? |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string | Yes |
| `BETTER_AUTH_SECRET` | better-auth signing secret | Yes |
| `BETTER_AUTH_URL` | App base URL (e.g. `http://localhost:3000`) | Yes |
| `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` | Google OAuth | Optional |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud (image uploads) | Yes |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary signed uploads | Yes |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe billing | Optional |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash rate limiting | Optional |
| `RESEND_API_KEY` | Outbound email (verification, password reset) | Optional |
| `REQUIRE_EMAIL_VERIFICATION` | Toggles email verification gate | No (default off) |
| `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` | Mirror of the above for client-side branching | No |
| `CRON_SECRET` | Bearer token for `/api/cron/cleanup` | Required in prod |

---

## Scripts

```bash
npm run dev              # Next dev server
npm run build            # Production build
npm run start            # Production server
npm run lint             # ESLint
npm run db:generate      # drizzle-kit generate (create migrations)
npm run db:push          # drizzle-kit push (sync schema → DB)
npm run db:studio        # drizzle-kit studio (GUI)
npm run db:seed          # tsx scripts/seed-users.ts
npm run test:e2e         # Playwright headless
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:report  # Open last Playwright report
```

---

## Notable choices to revisit in v2

- **Mostly server actions, very few API routes** — works well, but mixing webhooks + auth catch-all + cron means three different "exception" patterns living next to each other. Worth consolidating.
- **Custom additional fields stuffed into the `users` table** — `username`, `bio`, `premium`, `role`, all the Stripe fields, ban fields. Consider splitting `user_profile` and `user_billing` from auth identity in v2.
- **Three privacy levels (`PRIVATE`/`FRIENDS`/`PUBLIC`) + separate `explorable` flag** — works but the relationship between them is implicit. v2 could model this more explicitly.
- **No realtime layer** — collaboration features (Hives, comments, suggestions) all rely on refetch. v2 could add SSE or a Liveblocks-style provider for true co-presence.
- **TipTap v3 + custom serialization for export** — heavy export pipeline (DOCX/PDF/EPUB) lives client-side via html2canvas and friends; consider server-side rendering for fidelity in v2.
- **Cloudinary for *all* image uploads** — fine, but ties branding/CDN to one vendor; v2 could front it with a thin abstraction.
