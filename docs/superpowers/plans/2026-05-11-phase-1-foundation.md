# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold Beehive Studio v2 from scratch with a working auth system, full database schema, middleware, and authenticated app shell — ready for feature phases to build on top.

**Architecture:** Next.js 16 App Router with all routes under `app/[locale]/`. Database schema defined in full upfront via Drizzle ORM on Neon Postgres. Auth handled by better-auth with email/password, Google OAuth, and Apple OAuth (pre-wired, disabled until credentials added). Middleware handles auth gating, onboarding gate, and rate limiting. UI tasks (landing page, auth pages, onboarding, app shell) are added once Claude Design screens are delivered — see `## UI Tasks (Pending Designs)` at the bottom.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM, Neon Postgres, better-auth, Cloudinary, Resend, Upstash Redis, Vercel

---

## File Map

```
beehive-studio/
├── app/
│   ├── layout.tsx                          # Root HTML shell, Comfortaa font
│   ├── not-found.tsx                       # Root 404
│   ├── robots.ts
│   ├── sitemap.ts
│   └── [locale]/
│       ├── layout.tsx                      # Locale layout: i18n provider, TanStack Query, cookie banner
│       ├── not-found.tsx
│       ├── error.tsx
│       ├── (public)/
│       │   ├── layout.tsx                  # Pass-through
│       │   ├── page.tsx                    # Landing page (UI task)
│       │   ├── privacy/page.tsx            # Privacy policy
│       │   ├── terms/page.tsx              # Terms of service
│       │   ├── cookies/page.tsx            # Cookie policy
│       │   └── dmca/page.tsx              # DMCA policy
│       ├── (auth)/
│       │   ├── layout.tsx                  # Bounces authed+onboarded users to /studio
│       │   ├── sign-in/page.tsx            # Sign in (UI task)
│       │   ├── sign-up/page.tsx            # Sign up (UI task)
│       │   ├── forgot-password/page.tsx    # Forgot password (UI task)
│       │   ├── reset-password/page.tsx     # Reset password (UI task)
│       │   └── onboarding/page.tsx         # 3-step onboarding wizard (UI task)
│       └── (app)/
│           ├── layout.tsx                  # Auth gate + onboarding gate + AppShell
│           ├── error.tsx
│           ├── studio/page.tsx             # Studio projects dashboard (UI task)
│           ├── community/page.tsx          # Community feed placeholder
│           └── discover/page.tsx           # Discover placeholder
├── api/
│   └── [locale]/
│       └── auth/[...all]/route.ts         # better-auth catch-all
├── db/
│   ├── index.ts                            # Neon client
│   └── schema/
│       ├── index.ts                        # Re-exports all schema
│       ├── auth.ts                         # users, user_profiles, user_billing, session, account, verification
│       ├── books.ts                        # books, book_publishing_metadata, binder_items, chapters, chapter_snapshots
│       ├── hive.ts                         # hives, hive_members, hive_invites, hive_submissions, hive_suggestions, hive_comments
│       ├── social.ts                       # follows, book_likes, book_comments, bookmarks, reading_progress, notifications, sparks, spark_entries
│       └── publishing.ts                   # export_presets, book_templates
├── lib/
│   ├── auth.ts                             # better-auth config (email, Google, Apple)
│   ├── auth-client.ts                      # better-auth client SDK exports
│   ├── require-auth.ts                     # requireAuth() / getOptionalUserId()
│   ├── rate-limit.ts                       # Upstash limiters
│   ├── cloudinary.ts                       # Cloudinary helpers
│   ├── email.ts                            # Resend transport + branded templates
│   └── validations/
│       └── onboarding.ts                   # Zod schemas for onboarding
├── hooks/
│   └── use-cloudinary-upload.ts            # Cloudinary upload hook
├── components/
│   ├── ui/                                 # shadcn primitives
│   ├── providers.tsx                       # TanStack Query + Zustand providers
│   └── cookie-banner.tsx                   # Cookie consent banner
├── middleware.ts                            # Auth gate, rate limit, bot block, locale routing
├── i18n/
│   ├── config.ts
│   └── request.ts
├── messages/
│   └── en.json                             # English translations
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts                      # (CSS-based in v4 — lives in globals.css)
└── app/globals.css                         # Tailwind v4 @theme, brand tokens, custom utilities
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `drizzle.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Initialise Next.js project**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

Expected: project scaffold created in current directory.

- [ ] **Step 2: Install all dependencies**

```bash
npm install \
  better-auth@^1.5.5 \
  drizzle-orm@^0.45.1 \
  @neondatabase/serverless@^1.0.2 \
  @tiptap/react@^3.20.0 \
  @tiptap/starter-kit@^3.20.0 \
  @tiptap/extension-placeholder@^3.20.0 \
  @tiptap/pm@^3.20.0 \
  @tanstack/react-query@^5.90.21 \
  @tanstack/react-query-devtools@^5.90.21 \
  zustand@^5.0.11 \
  react-hook-form@^7.71.2 \
  zod@^4.3.6 \
  @hookform/resolvers@^5.2.2 \
  next-cloudinary@^6.17.5 \
  cloudinary@^2.9.0 \
  stripe@^20.4.1 \
  @upstash/redis@^1.37.0 \
  @upstash/ratelimit@^2.0.8 \
  resend@^6.9.4 \
  next-intl@^4.8.3 \
  @dnd-kit/core@^6.3.1 \
  @dnd-kit/sortable@^10.0.0 \
  @dnd-kit/utilities@^3.2.2 \
  lucide-react@^0.575.0 \
  class-variance-authority@^0.7.1 \
  clsx@^2.1.1 \
  tailwind-merge@^3.5.0 \
  @paralleldrive/cuid2@^3.3.0 \
  tw-animate-css@^1.4.0 \
  jszip@^3.10.1 \
  html-to-docx@^1.8.0 \
  jspdf@^4.2.0 \
  html2canvas@^1.4.1 \
  @smoores/epub@^0.1.9

npm install -D \
  drizzle-kit@^0.31.9 \
  tsx@^4.0.0 \
  @types/node@^22
```

Expected: all packages installed with no peer dependency errors.

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: New York
- Base color: Neutral
- CSS variables: Yes

Then add components:
```bash
npx shadcn@latest add button badge skeleton input textarea select label avatar dropdown-menu dialog sheet tabs tooltip progress separator
```

- [ ] **Step 4: Write `app/globals.css` with brand tokens**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-brand: #FFC300;
  --color-brand-hover: #FFD040;
  --color-brand-active: #e0ac01;
  --color-surface: #1c1c1c;
  --color-surface-elevated: #252525;
  --color-surface-inset: #1e1e1e;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
}

:root {
  --radius: 0.625rem;
  --background: #141414;
  --foreground: oklch(0.985 0 0);
  --card: #1c1c1c;
  --card-foreground: oklch(0.985 0 0);
  --popover: #1c1c1c;
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: #252525;
  --secondary-foreground: oklch(0.985 0 0);
  --muted: #252525;
  --muted-foreground: oklch(0.708 0 0);
  --accent: #252525;
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: #2a2a2a;
  --input: #252525;
  --ring: oklch(0.556 0 0);
}

html {
  color-scheme: dark;
}

body {
  background-color: #141414;
  color: white;
  font-family: var(--font-geist-sans), sans-serif;
}

@utility mainFont {
  font-family: var(--font-comfortaa), sans-serif;
}

@utility scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

@utility scrollbar-custom {
  scrollbar-width: thin;
  scrollbar-color: #FFC300 transparent;
  &::-webkit-scrollbar { width: 8px; height: 8px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background-color: #FFC300; border-radius: 4px; }
  &::-webkit-scrollbar-thumb:hover { background-color: #FFD040; }
}

@utility paper-stack {
  border: 1px solid #2a2a2a;
  border-bottom-color: #111;
  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 3px 0 rgba(0,0,0,0.32);
}

@utility paper-stack-hover {
  transition: color 200ms, background-color 200ms, border-color 200ms, box-shadow 200ms, transform 200ms;
  &:hover {
    border-color: rgba(255,195,0,0.35);
    box-shadow: 0 4px 0 rgba(0,0,0,0.32);
    transform: translateY(-1px);
  }
}

@utility paper-grit {
  background-image: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 18px 18px;
}

@keyframes wiggle {
  0% { rotate: 0; }
  20% { rotate: 10deg; }
  40% { rotate: -8deg; }
  60% { rotate: 6deg; }
  80% { rotate: -4deg; }
  100% { rotate: 0; }
}

.animate-wiggle { animation: wiggle 0.6s ease-in-out; }
```

- [ ] **Step 5: Write `next.config.ts`**

```ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 6: Write `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Comfortaa } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const comfortaa = Comfortaa({
  variable: '--font-comfortaa',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Beehive Studio — Craft your story. Grow your hive.',
  description: 'The professional writing studio where authors write, collaborate, and publish to a community of readers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${comfortaa.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Write `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 8: Write `.env.example`**

```bash
# Database
DATABASE_URL=

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=

# Apple OAuth (leave empty until credentials obtained)
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Resend
RESEND_API_KEY=

# Misc
CRON_SECRET=
REQUIRE_EMAIL_VERIFICATION=false
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Copy to `.env.local` and fill in real values before running.

- [ ] **Step 9: Write `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 10: Add scripts to `package.json`**

Add under `"scripts"`:
```json
{
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:seed": "tsx scripts/seed.ts"
}
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffold — Next.js 16, Tailwind v4, shadcn/ui, Drizzle config"
```

---

## Task 2: Database Schema

**Files:**
- Create: `db/index.ts`
- Create: `db/schema/auth.ts`
- Create: `db/schema/books.ts`
- Create: `db/schema/hive.ts`
- Create: `db/schema/social.ts`
- Create: `db/schema/publishing.ts`
- Create: `db/schema/index.ts`

- [ ] **Step 1: Write `db/index.ts`**

```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 2: Write `db/schema/auth.ts`**

```ts
import { pgTable, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'

export const userRoleEnum = pgEnum('user_role', ['member', 'moderator', 'admin'])

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  banned: boolean('banned').default(false),
  bannedAt: timestamp('banned_at'),
  bannedReason: text('banned_reason'),
})

export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username').unique(),
  displayName: text('display_name'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  role: userRoleEnum('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const userBilling = pgTable('user_billing', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  premium: boolean('premium').default(false).notNull(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId: text('stripe_price_id'),
  stripeCurrentPeriodEnd: timestamp('stripe_current_period_end'),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  password: text('password'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  billing: one(userBilling, { fields: [users.id], references: [userBilling.userId] }),
}))

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}))
```

- [ ] **Step 3: Write `db/schema/books.ts`**

```ts
import { pgTable, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { users } from './auth'

export const bookVisibilityEnum = pgEnum('book_visibility', ['PRIVATE', 'PUBLIC'])
export const bookStatusEnum = pgEnum('book_status', ['DRAFT', 'PUBLISHED'])
export const chapterStatusEnum = pgEnum('chapter_status', ['IDEA', 'OUTLINE', 'FIRST_DRAFT', 'REVISED', 'FINAL'])
export const binderItemTypeEnum = pgEnum('binder_item_type', [
  'part', 'chapter', 'front_matter', 'back_matter',
  'research_folder', 'research_note', 'character', 'outline',
])

export const books = pgTable('books', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  genre: text('genre'),
  visibility: bookVisibilityEnum('visibility').default('PRIVATE').notNull(),
  status: bookStatusEnum('status').default('DRAFT').notNull(),
  coverUrl: text('cover_url'),
  explorable: boolean('explorable').default(false).notNull(),
  synopsis: text('synopsis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const bookPublishingMetadata = pgTable('book_publishing_metadata', {
  bookId: text('book_id').primaryKey().references(() => books.id, { onDelete: 'cascade' }),
  isbn: text('isbn'),
  subtitle: text('subtitle'),
  trimSize: text('trim_size').default('6x9'),
  authorBio: text('author_bio'),
  dedication: text('dedication'),
  publisherName: text('publisher_name'),
  edition: text('edition').default('First Edition'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const binderItems = pgTable('binder_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  type: binderItemTypeEnum('type').notNull(),
  title: text('title').notNull(),
  order: integer('order').default(0).notNull(),
  content: jsonb('content'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const chapters = pgTable('chapters', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  binderItemId: text('binder_item_id').references(() => binderItems.id, { onDelete: 'set null' }),
  content: jsonb('content'),
  wordCount: integer('word_count').default(0).notNull(),
  status: chapterStatusEnum('status').default('FIRST_DRAFT').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const chapterSnapshots = pgTable('chapter_snapshots', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  content: jsonb('content').notNull(),
  wordCount: integer('word_count').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(users, { fields: [books.userId], references: [users.id] }),
  publishingMetadata: one(bookPublishingMetadata, { fields: [books.id], references: [bookPublishingMetadata.bookId] }),
  binderItems: many(binderItems),
  chapters: many(chapters),
}))

export const binderItemsRelations = relations(binderItems, ({ one, many }) => ({
  book: one(books, { fields: [binderItems.bookId], references: [books.id] }),
  parent: one(binderItems, { fields: [binderItems.parentId], references: [binderItems.id], relationName: 'parent' }),
  children: many(binderItems, { relationName: 'parent' }),
}))

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  book: one(books, { fields: [chapters.bookId], references: [books.id] }),
  binderItem: one(binderItems, { fields: [chapters.binderItemId], references: [binderItems.id] }),
  snapshots: many(chapterSnapshots),
}))
```

- [ ] **Step 4: Write `db/schema/hive.ts`**

```ts
import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { users } from './auth'
import { books, chapters } from './books'

export const hiveStatusEnum = pgEnum('hive_status', ['ACTIVE', 'COMPLETED'])
export const hiveVisibilityEnum = pgEnum('hive_visibility', ['PRIVATE', 'PUBLIC', 'FRIENDS'])
export const hiveMemberRoleEnum = pgEnum('hive_member_role', ['OWNER', 'CONTRIBUTOR', 'EDITOR', 'BETA_READER', 'PROOFREADER'])
export const hiveInviteStatusEnum = pgEnum('hive_invite_status', ['PENDING', 'ACCEPTED', 'DECLINED'])
export const hiveSubmissionStatusEnum = pgEnum('hive_submission_status', ['PENDING', 'APPROVED', 'REJECTED'])
export const hiveSuggestionStatusEnum = pgEnum('hive_suggestion_status', ['PENDING', 'ACCEPTED', 'REJECTED'])

export const hives = pgTable('hives', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').references(() => books.id, { onDelete: 'set null' }),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  visibility: hiveVisibilityEnum('visibility').default('PRIVATE').notNull(),
  status: hiveStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const hiveMembers = pgTable('hive_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: hiveMemberRoleEnum('role').default('CONTRIBUTOR').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
})

export const hiveInvites = pgTable('hive_invites', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  inviteeId: text('invitee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: hiveMemberRoleEnum('role').default('CONTRIBUTOR').notNull(),
  status: hiveInviteStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const hiveSubmissions = pgTable('hive_submissions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  submitterId: text('submitter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: hiveSubmissionStatusEnum('status').default('PENDING').notNull(),
  reviewerNote: text('reviewer_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const hiveSuggestions = pgTable('hive_suggestions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalText: text('original_text').notNull(),
  suggestedText: text('suggested_text').notNull(),
  status: hiveSuggestionStatusEnum('status').default('PENDING').notNull(),
  diff: text('diff'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const hiveComments = pgTable('hive_comments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  anchorStart: text('anchor_start'),
  anchorEnd: text('anchor_end'),
  content: text('content').notNull(),
  resolved: timestamp('resolved'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const hivesRelations = relations(hives, ({ one, many }) => ({
  owner: one(users, { fields: [hives.ownerId], references: [users.id] }),
  book: one(books, { fields: [hives.bookId], references: [books.id] }),
  members: many(hiveMembers),
  invites: many(hiveInvites),
}))
```

- [ ] **Step 5: Write `db/schema/social.ts`**

```ts
import { pgTable, text, timestamp, integer, boolean, primaryKey, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { users } from './auth'
import { books, chapters } from './books'

export const notificationTypeEnum = pgEnum('notification_type', [
  'NEW_FOLLOWER', 'NEW_LIKE', 'NEW_COMMENT', 'NEW_CHAPTER',
  'HIVE_INVITE', 'HIVE_SUBMISSION', 'HIVE_SUGGESTION', 'SPARK_WIN',
])

export const follows = pgTable('follows', {
  followerId: text('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followeeId: text('followee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })])

export const bookLikes = pgTable('book_likes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.bookId] })])

export const bookComments = pgTable('book_comments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  parentId: text('parent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const bookmarks = pgTable('bookmarks', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.bookId] })])

export const readingProgress = pgTable('reading_progress', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  lastOpenedAt: timestamp('last_opened_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.bookId] })])

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sparks = pgTable('sparks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  rules: text('rules'),
  deadline: timestamp('deadline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sparkEntries = pgTable('spark_entries', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sparkId: text('spark_id').notNull().references(() => sparks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  votes: integer('votes').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

- [ ] **Step 6: Write `db/schema/publishing.ts`**

```ts
import { pgTable, text, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const exportFormatEnum = pgEnum('export_format', ['EPUB', 'PDF', 'DOCX', 'TXT', 'ZIP'])

export const exportPresets = pgTable('export_presets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  format: exportFormatEnum('format').notNull(),
  config: jsonb('config').notNull(),
  isSystemPreset: boolean('is_system_preset').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const bookTemplates = pgTable('book_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  genre: text('genre'),
  structure: jsonb('structure').notNull(),
  isSystemTemplate: boolean('is_system_template').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

- [ ] **Step 7: Write `db/schema/index.ts`**

```ts
export * from './auth'
export * from './books'
export * from './hive'
export * from './social'
export * from './publishing'
```

- [ ] **Step 8: Generate and push the schema**

```bash
npm run db:generate
npm run db:push
```

Expected: migrations generated in `drizzle/` and all tables created in Neon.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: full database schema — auth, books, hive, social, publishing"
```

---

## Task 3: better-auth Configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/auth-client.ts`
- Create: `lib/require-auth.ts`
- Create: `lib/email.ts`
- Create: `app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Write `lib/email.ts`**

```ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Beehive Studio <noreply@beehive-studio.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function brandedEmail(heading: string, body: string, ctaLabel: string, ctaUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="background:#141414;color:#ffffff;font-family:Arial,sans-serif;margin:0;padding:32px;">
      <div style="max-width:520px;margin:0 auto;">
        <div style="font-size:24px;font-weight:700;color:#FFC300;margin-bottom:24px;">🐝 Beehive Studio</div>
        <h1 style="font-size:22px;font-weight:700;margin-bottom:12px;">${heading}</h1>
        <p style="color:#cccccc;line-height:1.6;margin-bottom:24px;">${body}</p>
        <a href="${ctaUrl}"
           style="display:inline-block;background:#FFC300;color:#000000;font-weight:700;
                  text-decoration:none;padding:12px 24px;border-radius:9999px;">
          ${ctaLabel}
        </a>
        <p style="color:#555555;font-size:12px;margin-top:32px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `
}

export async function sendVerificationEmail(email: string, url: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify your Beehive Studio email',
    html: brandedEmail(
      'Verify your email',
      'Click the button below to verify your email address and start writing.',
      'Verify email',
      url,
    ),
  })
}

export async function sendPasswordResetEmail(email: string, url: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your Beehive Studio password',
    html: brandedEmail(
      'Reset your password',
      'Click the button below to reset your password. This link expires in 1 hour.',
      'Reset password',
      url,
    ),
  })
}
```

- [ ] **Step 2: Write `lib/auth.ts`**

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { sendVerificationEmail, sendPasswordResetEmail } from './email'

const appleConfigured =
  !!process.env.APPLE_CLIENT_ID &&
  !!process.env.APPLE_TEAM_ID &&
  !!process.env.APPLE_KEY_ID &&
  !!process.env.APPLE_PRIVATE_KEY

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url)
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url)
    },
    callbackURL: '/sign-in',
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_AUTH_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET ?? '',
      enabled: !!process.env.GOOGLE_AUTH_CLIENT_ID,
    },
    ...(appleConfigured && {
      apple: {
        clientId: process.env.APPLE_CLIENT_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
        keyId: process.env.APPLE_KEY_ID!,
        privateKey: process.env.APPLE_PRIVATE_KEY!,
      },
    }),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'apple'],
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
```

- [ ] **Step 3: Write `lib/auth-client.ts`**

```ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
})

export const { useSession, signIn, signUp, signOut } = authClient
```

- [ ] **Step 4: Write `lib/require-auth.ts`**

```ts
import { headers } from 'next/headers'
import { auth } from './auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function requireAuth(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error('Unauthorized')

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { banned: true },
  })
  if (user?.banned) throw new Error('Your account has been suspended.')

  return session.user.id
}

export async function getOptionalUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Write `app/api/auth/[...all]/route.ts`**

```ts
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: better-auth — email/password, Google, Apple (pre-wired), Resend email templates"
```

---

## Task 4: Rate Limiting & Middleware

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `middleware.ts`
- Create: `i18n/config.ts`
- Create: `i18n/request.ts`
- Create: `messages/en.json`

- [ ] **Step 1: Write `lib/rate-limit.ts`**

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
})

export const signUpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'rl:signup',
})

export const signInLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '15 m'),
  prefix: 'rl:signin',
})

export const actionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:action',
})

export const searchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:search',
})

export const pageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, '1 m'),
  prefix: 'rl:page',
})

export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:api',
})

export const checkoutLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:checkout',
})
```

- [ ] **Step 2: Write `i18n/config.ts`**

```ts
export const locales = ['en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'
```

- [ ] **Step 3: Write `i18n/request.ts`**

```ts
import { getRequestConfig } from 'next-intl/server'
import { defaultLocale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? defaultLocale
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 4: Write `messages/en.json`**

```json
{
  "app": {
    "name": "Beehive Studio",
    "tagline": "Craft your story. Grow your hive."
  },
  "auth": {
    "signIn": "Sign in",
    "signUp": "Sign up",
    "signOut": "Sign out",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot password?",
    "resetPassword": "Reset password",
    "continueWithGoogle": "Continue with Google",
    "continueWithApple": "Continue with Apple",
    "appleComingSoon": "Apple Sign In coming soon"
  },
  "onboarding": {
    "step1Title": "Choose your username",
    "step1Subtitle": "This is how other writers will find you.",
    "step2Title": "Tell us about yourself",
    "step2Subtitle": "Optional — you can always add this later.",
    "step3Title": "Add a profile photo",
    "step3Subtitle": "Optional.",
    "continue": "Continue",
    "skip": "Skip",
    "finish": "Finish setup",
    "skipForNow": "Skip for now"
  }
}
```

- [ ] **Step 5: Write `middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { defaultLocale, locales } from './i18n/config'

const BLOCKED_UA = /sqlmap|nikto|nmap|masscan|zgrab|python-requests\/2\.[0-1]/i

const PUBLIC_PATHS = new Set([
  '/',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/cookies',
  '/dmca',
])

function isPublicPath(pathname: string): boolean {
  const stripped = pathname.replace(/^\/(en)(\/|$)/, '/')
  return PUBLIC_PATHS.has(stripped) ||
    stripped.startsWith('/books/') ||
    stripped.startsWith('/u/')
}

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ua = request.headers.get('user-agent') ?? ''

  // Block malicious user agents
  if (BLOCKED_UA.test(ua)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Apply intl routing first
  const intlResponse = intlMiddleware(request)

  // Skip auth checks for public paths
  if (isPublicPath(pathname)) return intlResponse

  // Check session cookie
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ??
    request.cookies.get('__Secure-better-auth.session_token')?.value

  if (!sessionToken) {
    const signInUrl = new URL(`/${defaultLocale}/sign-in`, request.url)
    signInUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Fetch session to check onboarding status
  try {
    const sessionRes = await fetch(
      `${process.env.BETTER_AUTH_URL}/api/auth/get-session`,
      { headers: { cookie: request.headers.get('cookie') ?? '' } },
    )
    const session = await sessionRes.json()

    if (!session?.user) {
      const signInUrl = new URL(`/${defaultLocale}/sign-in`, request.url)
      return NextResponse.redirect(signInUrl)
    }

    const strippedPath = pathname.replace(/^\/(en)(\/|$)/, '/')
    const isOnboardingPath = strippedPath === '/onboarding'

    if (!session.user.onboardingComplete && !isOnboardingPath) {
      return NextResponse.redirect(new URL(`/${defaultLocale}/onboarding`, request.url))
    }

    if (session.user.onboardingComplete && isOnboardingPath) {
      return NextResponse.redirect(new URL(`/${defaultLocale}/studio`, request.url))
    }
  } catch {
    // Session fetch failed — let the page handle it
  }

  return intlResponse ?? NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: middleware — auth gate, onboarding gate, rate limiters, i18n routing"
```

---

## Task 5: Cloudinary Helpers

**Files:**
- Create: `lib/cloudinary.ts`
- Create: `hooks/use-cloudinary-upload.ts`

- [ ] **Step 1: Write `lib/cloudinary.ts`**

```ts
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export function getCloudinaryPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

export function buildCloudinaryUrl(
  publicId: string,
  opts: { width?: number; height?: number; quality?: number } = {},
): string {
  const { width, height, quality = 80 } = opts
  const transforms = [
    `q_${quality}`,
    `f_auto`,
    width ? `w_${width}` : null,
    height ? `h_${height}` : null,
    width || height ? 'c_fill' : null,
  ].filter(Boolean).join(',')
  return `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${transforms}/${publicId}`
}
```

- [ ] **Step 2: Write `hooks/use-cloudinary-upload.ts`**

```ts
'use client'

import { useState } from 'react'

type UploadState = { url: string; publicId: string } | null

export function useCloudinaryUpload(folder: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadState>(null)

  async function upload(file: File): Promise<UploadState> {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', `beehive_${folder}`)
      formData.append('folder', folder)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData },
      )

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      const uploaded = { url: data.secure_url, publicId: data.public_id }
      setResult(uploaded)
      return uploaded
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error, result }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Cloudinary helpers and upload hook"
```

---

## Task 6: Onboarding Server Actions

**Files:**
- Create: `lib/validations/onboarding.ts`
- Create: `lib/actions/onboarding.actions.ts`

- [ ] **Step 1: Write `lib/validations/onboarding.ts`**

```ts
import { z } from 'zod'

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be 20 characters or less')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')

export const bioSchema = z
  .string()
  .max(200, 'Bio must be 200 characters or less')
  .optional()

export const onboardingSchema = z.object({
  username: usernameSchema,
  bio: bioSchema,
  avatarUrl: z.string().url().optional(),
})
```

- [ ] **Step 2: Write `lib/actions/onboarding.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { usernameSchema, onboardingSchema } from '@/lib/validations/onboarding'

export async function checkUsernameAvailableAction(username: string): Promise<{
  available: boolean
  error?: string
}> {
  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) {
    return { available: false, error: parsed.error.errors[0].message }
  }

  const userId = await requireAuth().catch(() => null)

  const existing = await db.query.userProfiles.findFirst({
    where: userId
      ? and(
          eq(userProfiles.username, username.toLowerCase()),
          ne(userProfiles.userId, userId),
        )
      : eq(userProfiles.username, username.toLowerCase()),
    columns: { userId: true },
  })

  return { available: !existing }
}

export async function completeOnboardingAction(data: {
  username: string
  bio?: string
  avatarUrl?: string
}): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth()

  const parsed = onboardingSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const { username, bio, avatarUrl } = parsed.data

  // Check username is still available
  const existing = await db.query.userProfiles.findFirst({
    where: and(
      eq(userProfiles.username, username.toLowerCase()),
      ne(userProfiles.userId, userId),
    ),
    columns: { userId: true },
  })

  if (existing) {
    return { success: false, error: 'Username is already taken' }
  }

  await db
    .insert(userProfiles)
    .values({
      userId,
      username: username.toLowerCase(),
      bio: bio ?? null,
      avatarUrl: avatarUrl ?? null,
      onboardingComplete: true,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        username: username.toLowerCase(),
        bio: bio ?? null,
        avatarUrl: avatarUrl ?? null,
        onboardingComplete: true,
        updatedAt: new Date(),
      },
    })

  if (avatarUrl) {
    await db.update(users).set({ image: avatarUrl }).where(eq(users.id, userId))
  }

  return { success: true }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: onboarding server actions — username check, complete onboarding"
```

---

## Task 7: App Shell Layouts & Placeholders

**Files:**
- Create: `components/providers.tsx`
- Create: `app/[locale]/layout.tsx`
- Create: `app/[locale]/(auth)/layout.tsx`
- Create: `app/[locale]/(app)/layout.tsx`
- Create: `app/[locale]/(app)/studio/page.tsx`
- Create: `app/[locale]/(app)/community/page.tsx`
- Create: `app/[locale]/(app)/discover/page.tsx`
- Create: `app/[locale]/error.tsx`
- Create: `app/[locale]/not-found.tsx`
- Create: `app/not-found.tsx`

- [ ] **Step 1: Write `components/providers.tsx`**

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: 1 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Write `app/[locale]/layout.tsx`**

```tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Providers } from '@/components/providers'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  )
}
```

- [ ] **Step 3: Write `app/[locale]/(auth)/layout.tsx`**

```tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user?.id) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, session.user.id),
      columns: { onboardingComplete: true },
    })
    if (profile?.onboardingComplete) redirect('/studio')
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Write `app/[locale]/(app)/layout.tsx`**

```tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* AppShell nav injected via UI task — placeholder for now */}
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Write placeholder pages**

`app/[locale]/(app)/studio/page.tsx`:
```tsx
export default function StudioPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white/50">Studio — coming in Phase 2</p>
    </div>
  )
}
```

`app/[locale]/(app)/community/page.tsx`:
```tsx
export default function CommunityPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white/50">Community — coming in Phase 6</p>
    </div>
  )
}
```

`app/[locale]/(app)/discover/page.tsx`:
```tsx
export default function DiscoverPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white/50">Discover — coming in Phase 5</p>
    </div>
  )
}
```

- [ ] **Step 6: Write error and not-found pages**

`app/[locale]/error.tsx`:
```tsx
'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-white/70">Something went wrong.</p>
      <button onClick={reset} className="text-[#FFC300] hover:underline text-sm">
        Try again
      </button>
    </div>
  )
}
```

`app/[locale]/not-found.tsx` and `app/not-found.tsx`:
```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-4xl font-bold text-white mainFont">404</h1>
      <p className="text-white/50">This page doesn't exist.</p>
      <Link href="/" className="text-[#FFC300] hover:underline text-sm">
        Go home
      </Link>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: app shell layouts, providers, placeholder pages, error boundaries"
```

---

## Task 8: Seed Export Presets & Book Templates

**Files:**
- Create: `scripts/seed-publishing.ts`

- [ ] **Step 1: Write `scripts/seed-publishing.ts`**

```ts
import { db } from '../db'
import { exportPresets, bookTemplates } from '../db/schema'

async function seed() {
  await db.insert(exportPresets).values([
    {
      name: 'Standard Manuscript Format',
      format: 'DOCX',
      config: {
        font: 'Times New Roman',
        fontSize: 12,
        lineSpacing: 2,
        margins: { top: 1, bottom: 1, left: 1, right: 1 },
        headerFormat: 'AUTHOR_LAST / TITLE_SHORT / PAGE',
        indent: 0.5,
      },
      isSystemPreset: true,
    },
    {
      name: 'EPUB',
      format: 'EPUB',
      config: { includeTableOfContents: true, includeCover: true },
      isSystemPreset: true,
    },
    {
      name: 'KDP Print-Ready PDF',
      format: 'PDF',
      config: { trimSize: '6x9', margins: { top: 0.875, bottom: 0.875, inside: 0.875, outside: 0.625 }, bleed: false },
      isSystemPreset: true,
    },
    {
      name: 'IngramSpark PDF',
      format: 'PDF',
      config: { trimSize: '6x9', margins: { top: 0.875, bottom: 0.875, inside: 0.875, outside: 0.625 }, bleed: true, bleedSize: 0.125 },
      isSystemPreset: true,
    },
    {
      name: 'DOCX',
      format: 'DOCX',
      config: { font: 'Calibri', fontSize: 11, lineSpacing: 1.15 },
      isSystemPreset: true,
    },
  ]).onConflictDoNothing()

  await db.insert(bookTemplates).values([
    {
      name: 'Blank',
      genre: null,
      structure: { parts: [], researchFolders: ['Characters', 'World Notes', 'Outline'] },
      isSystemTemplate: true,
    },
    {
      name: 'Three-Act Thriller',
      genre: 'Thriller',
      structure: {
        parts: [
          { title: 'Act 1 — Setup', chapterCount: 5 },
          { title: 'Act 2 — Confrontation', chapterCount: 12 },
          { title: 'Act 3 — Resolution', chapterCount: 5 },
        ],
        researchFolders: ['Characters', 'Timeline', 'Locations', 'Clues & Twists'],
      },
      isSystemTemplate: true,
    },
    {
      name: 'Romance Arc',
      genre: 'Romance',
      structure: {
        parts: [
          { title: 'Meeting', chapterCount: 4 },
          { title: 'Falling', chapterCount: 8 },
          { title: 'Conflict', chapterCount: 6 },
          { title: 'Resolution (HEA)', chapterCount: 4 },
        ],
        researchFolders: ['Characters', 'Relationship Timeline', 'Settings'],
      },
      isSystemTemplate: true,
    },
    {
      name: 'Fantasy World',
      genre: 'Fantasy',
      structure: {
        parts: [{ title: 'Book One', chapterCount: 10 }],
        researchFolders: ['Characters', 'World Map', 'Magic System', 'Factions', 'History & Lore', 'Outline'],
      },
      isSystemTemplate: true,
    },
  ]).onConflictDoNothing()

  console.log('✅ Seed complete')
  process.exit(0)
}

seed().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run the seed**

```bash
npm run db:seed scripts/seed-publishing.ts
```

Or add to package.json:
```json
"db:seed:publishing": "tsx scripts/seed-publishing.ts"
```

Then run: `npm run db:seed:publishing`

Expected: `✅ Seed complete`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: seed export presets and book templates"
```

---

## Task 9: Legal Pages (Static Content)

**Files:**
- Create: `app/[locale]/(public)/layout.tsx`
- Create: `app/[locale]/(public)/privacy/page.tsx`
- Create: `app/[locale]/(public)/terms/page.tsx`
- Create: `app/[locale]/(public)/cookies/page.tsx`
- Create: `app/[locale]/(public)/dmca/page.tsx`

- [ ] **Step 1: Write `app/[locale]/(public)/layout.tsx`**

```tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 2: Write the legal page shell (reused across all 4 pages)**

Each legal page follows this pattern — write all four:

`app/[locale]/(public)/privacy/page.tsx`:
```tsx
export const metadata = { title: 'Privacy Policy — Beehive Studio' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mainFont mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>
        <div className="prose prose-invert prose-sm max-w-none text-white/70 leading-relaxed space-y-8">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Information We Collect</h2>
            <p>We collect information you provide when creating an account (email address, username, bio, profile photo) and information generated by your use of the service (books, chapters, writing activity).</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">How We Use Your Information</h2>
            <p>We use your information to provide and improve Beehive Studio, send transactional emails (email verification, password reset), and display your public profile and published works to other users.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Data Storage</h2>
            <p>Your data is stored on secure servers via Neon (Postgres database) and Cloudinary (images). We do not sell your personal information to third parties.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Contact</h2>
            <p>Questions about this policy? Email us at privacy@beehive-studio.app.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
```

Write similar shells for `/terms`, `/cookies`, and `/dmca` with appropriate headings and placeholder content appropriate to each policy type.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: legal pages — privacy, terms, cookies, DMCA"
```

---

## UI Tasks (Pending Claude Design)

The following tasks implement the page components and require Claude Design screens before they can be written. Add them here once designs are delivered.

**Screens needed:**
- [ ] **Task 10: Landing page** — `/` marketing page
- [ ] **Task 11: Sign in page** — email/password + Google + Apple (disabled)
- [ ] **Task 12: Sign up page** — email/password + strength meter + Google + Apple (disabled)
- [ ] **Task 13: Forgot password page**
- [ ] **Task 14: Reset password page** (reads `?token=` from URL)
- [ ] **Task 15: Onboarding step 1** — username with debounced availability check
- [ ] **Task 16: Onboarding step 2** — bio with character counter
- [ ] **Task 17: Onboarding step 3** — avatar upload via Cloudinary
- [ ] **Task 18: App shell navigation** — top nav (Studio / Community / Discover), notification bell, user avatar

---

## Verification

After all tasks (including UI tasks) are complete:

- [ ] `npm run build` passes with no TypeScript or ESLint errors
- [ ] `npm run dev` — navigate to `http://localhost:3000`, you are redirected to `/en/`
- [ ] Sign up with email → verify email (if `REQUIRE_EMAIL_VERIFICATION=true`) → land on `/en/onboarding`
- [ ] Complete onboarding → land on `/en/studio` (placeholder page)
- [ ] Sign out → middleware redirects to `/en/sign-in`
- [ ] Visit `/en/privacy` — renders without auth
- [ ] `npm run db:studio` — all tables visible in Drizzle Studio
