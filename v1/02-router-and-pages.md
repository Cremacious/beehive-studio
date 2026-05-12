# Beehive Books v1 — Router & Pages

> Source app: `C:\Code\personal\beehive-books-online`
> Framework: Next.js 16 App Router, all routes locale-prefixed via `[locale]` (`next-intl`).

Every URL in the app starts with a locale segment (`/en`, `/es`, `/fr`, `/de`, `/pt`). For brevity below, examples use `/en/...`. Anywhere you see `[locale]` in a file path, that's the locale segment.

The route tree is split into route groups:

- `app/[locale]/(app)/...` — the authenticated app shell (sidebar + header + everything you do once signed in)
- `app/[locale]/(auth)/...` — auth-flow pages (sign-in, sign-up, password reset, onboarding)
- `app/[locale]/(public)/...` — legal pages, public to anyone

---

## Root + locale-level

### `/` Root layout — `app/layout.tsx`
Bootstraps the HTML document. Loads the **Comfortaa** font, sets the lang from the locale segment, suppresses hydration warnings.

### `/{locale}` Locale layout — `app/[locale]/layout.tsx`
Wraps every locale-prefixed route. Sets up `NextIntlClientProvider` with the active locale's messages, mounts global `Providers` (TanStack Query, etc.), and renders the `CookieBanner`.

### `/{locale}` Landing page — `app/[locale]/page.tsx`
**Public.** Marketing landing page with hero + feature sections (Library, Hives, Clubs, Reading Lists, Sparks). CTAs to Sign Up / Sign In / Explore. Authenticated + onboarded users are bounced to `/home`.

### `app/not-found.tsx` & `app/[locale]/not-found.tsx`
404 fallbacks (root catch-all and locale-scoped).

### `app/[locale]/error.tsx`
Error boundary for everything under `[locale]`.

### `app/robots.ts`, `app/sitemap.ts`
SEO endpoints. No UI.

---

## `(auth)` — sign-in / sign-up / onboarding

All public. The layout (`app/[locale]/(auth)/layout.tsx`) checks the session and bounces fully-onboarded users to `/home` so signed-in users never see auth pages.

| URL | File | What's on it / what the user is doing |
|---|---|---|
| `/en/sign-in` | `(auth)/sign-in/page.tsx` | Email/password form + Google OAuth + "Show password" toggle + "Forgot password?" link. After submit: full-page navigation to `/home` so the session cookie ships. Shows a success banner when redirected from a successful password reset. |
| `/en/sign-up` | `(auth)/sign-up/page.tsx` | Email + password + confirm password with a strength meter (≥8 chars, uppercase + number). Google OAuth button. If `REQUIRE_EMAIL_VERIFICATION` is on, shows a "check your inbox" confirmation; otherwise auto-signs the user in and routes to `/onboarding`. |
| `/en/forgot-password` | `(auth)/forgot-password/page.tsx` | Single email field. Sends a reset link via Resend, shows "check your inbox" regardless of whether the email exists (no enumeration). |
| `/en/reset-password` | `(auth)/reset-password/page.tsx` | Reads `?token=...` from the URL. New password + confirm. Validates 8+ chars and match. On success, redirects to `/sign-in?reset=success`. |
| `/en/onboarding` | `(auth)/onboarding/page.tsx` | 3-step flow: **Username** (3–20 chars, debounced availability check) → **Bio** (≤200 chars, optional) → **Profile photo** (Cloudinary upload, optional). Completing it sets `onboardingComplete = true` and routes to `/home`. |

---

## `(public)` — legal

Plain content pages, no auth required. Layout is a pass-through.

| URL | File | Purpose |
|---|---|---|
| `/en/privacy` | `(public)/privacy/page.tsx` | Privacy policy |
| `/en/terms` | `(public)/terms/page.tsx` | Terms of service |
| `/en/cookies` | `(public)/cookies/page.tsx` | Cookie policy — names essential cookies (auth, CSRF) and functional cookies (locale). No third-party tracking. |
| `/en/dmca` | `(public)/dmca/page.tsx` | DMCA takedown / copyright policy |

---

## `(app)` — the authenticated app

The `app/[locale]/(app)/layout.tsx` is the gate: it requires a session, requires `onboardingComplete`, and wraps everything in `V2AppShell` (sidebar + header + admin-aware nav). All routes below assume "auth: signed in" unless noted.

There's also an `app/[locale]/(app)/error.tsx` boundary for graceful in-app errors.

---

### Home — the dashboard

| URL | File | What's on it / user expectation |
|---|---|---|
| `/en/home` | `(app)/home/page.tsx` | The user's personal hub. Friend activity feed (events: `NEW_BOOK`, `NEW_CHAPTER`, `NEW_CLUB`, `CLUB_DISCUSSION`, `NEW_PROMPT`, `NEW_READING_LIST`, `NEW_HIVE`, `LIST_NEW_BOOK`), "Recent writing" grid, "Continue reading" carousel, announcements, suggested writers, feature cards into other sections. New users see onboarding prompts and friend suggestions; returning users see their feed. |

---

### Library — the user's books

| URL | File | What's on it / user expectation |
|---|---|---|
| `/en/library` | `(app)/library/page.tsx` | Tabbed view: **My Books** (books the user authored) and **Favourites** (books they've liked). "Create new book" button. |
| `/en/library/create` | `(app)/library/create/page.tsx` | Full book creation form (title, author, description, genre, category, privacy, cover upload). Routes back to the new book on success. |
| `/en/library/[bookId]` | `(app)/library/[bookId]/page.tsx` | **Owner-only** book detail. Cover, metadata, chapter list grouped by collection, "Open Studio", "Edit", "Share" actions. Non-owners 404 here. |
| `/en/library/[bookId]/edit` | `(app)/library/[bookId]/edit/page.tsx` | Edit book metadata + cover + privacy. |
| `/en/library/[bookId]/create-chapter` | `(app)/library/[bookId]/create-chapter/page.tsx` | New-chapter form (title + content + optional collection). |
| `/en/library/[bookId]/[chapterId]` | `(app)/library/[bookId]/[chapterId]/page.tsx` | View a single chapter (owner or hive member). |
| `/en/library/[bookId]/[chapterId]/edit` | `(app)/library/[bookId]/[chapterId]/edit/page.tsx` | Rich-text editor for the chapter (TipTap). Owner or hive writer. |

`[bookId]` and `[chapterId]` are UUIDs.

---

### Write / Studio — the v2 workspace

| URL | File | What's on it / user expectation |
|---|---|---|
| `/en/write` | `(app)/write/page.tsx` | **Doorway page** for the v2 project workspace. Two CTAs: "Open library" or "Start a book". Explains what the workspace does. |
| `/en/write/[bookId]` | `(app)/write/[bookId]/page.tsx` | The full v2 project workspace — drafting, planning, collaboration, publishing, export. Owner or hive writer. |
| `/en/write/[bookId]/chapter/[chapterId]` | `(app)/write/[bookId]/chapter/[chapterId]/page.tsx` | Chapter-focused rich-text editor inside the workspace. |
| `/en/write/[bookId]/import` | `(app)/write/[bookId]/import/page.tsx` | Import chapters from external files (DOCX, TXT). |

---

### Explore — public discovery

Wrapped by `(app)/explore/layout.tsx`, which adds the `ExploreNav` tabs.

| URL | File | What's on it / user expectation |
|---|---|---|
| `/en/explore` | `(app)/explore/page.tsx` | Discovery hub: featured books, popular books, trending by genre, recommended clubs / hives / prompts / reading lists, friends' reading carousel. |
| `/en/explore/books` | `(app)/explore/books/page.tsx` | Searchable / filterable public-book catalog. |
| `/en/explore/clubs` | `(app)/explore/clubs/page.tsx` | Browse public book clubs. |
| `/en/explore/hives` | `(app)/explore/hives/page.tsx` | Browse public collaborative writing hives. |
| `/en/explore/reading-lists` | `(app)/explore/reading-lists/page.tsx` | Browse community reading lists. |
| `/en/explore/sparks` | `(app)/explore/sparks/page.tsx` | Browse community writing prompts ("sparks"). |

---

### Books — public reading view

| URL | File | What's on it / user expectation |
|---|---|---|
| `/en/books/[bookId]` | `(app)/books/[bookId]/page.tsx` | The "reader" view of a book the user doesn't own. Cover, metadata, chapter list, like button, share, comments (if enabled), related reading lists. |
| `/en/books/[bookId]/[chapterId]` | `(app)/books/[bookId]/[chapterId]/page.tsx` | Read a specific chapter. Tracks "continue reading" state in the background. |

Privacy on these routes is enforced by the action layer (`PRIVATE` returns 404, `FRIENDS` checks accepted friendship).

---

### Hive — collaborative writing spaces

| URL | File | Purpose |
|---|---|---|
| `/en/hive` | `(app)/hive/page.tsx` | List of hives the user is in + pending hive invites with accept/reject buttons. |
| `/en/hive/create` | `(app)/hive/create/page.tsx` | Create a new hive (name, description, privacy, optionally link to an existing book or create a new one). |
| `/en/hive/[hiveId]` | `(app)/hive/[hiveId]/page.tsx` | Hive dashboard. Linked book, member buzz/activity, join request status if non-member, pending join requests if owner/mod. |

Wrapped by `(app)/hive/[hiveId]/layout.tsx`. All sub-routes below are member-only:

| URL | File | Purpose |
|---|---|---|
| `/en/hive/[hiveId]/outline` | `(app)/hive/[hiveId]/outline/page.tsx` | Story outline board (drag-and-drop). |
| `/en/hive/[hiveId]/wiki` | `(app)/hive/[hiveId]/wiki/page.tsx` | World-building wiki. |
| `/en/hive/[hiveId]/buzz` | `(app)/hive/[hiveId]/buzz/page.tsx` | Activity / discussion feed for the hive. |
| `/en/hive/[hiveId]/chapters` | `(app)/hive/[hiveId]/chapters/page.tsx` | Chapter list for the hive's linked book. |
| `/en/hive/[hiveId]/submissions` | `(app)/hive/[hiveId]/submissions/page.tsx` | Chapter submissions awaiting owner/mod approval. |
| `/en/hive/[hiveId]/submissions/[submissionId]` | `(app)/hive/[hiveId]/submissions/[submissionId]/page.tsx` | Review and approve/reject one submission (owner/mod). |
| `/en/hive/[hiveId]/suggest` | `(app)/hive/[hiveId]/suggest/page.tsx` | List of suggested edits/rewrites. |
| `/en/hive/[hiveId]/suggest/[suggestionId]` | `(app)/hive/[hiveId]/suggest/[suggestionId]/page.tsx` | Review one rewrite suggestion (owner/mod). |
| `/en/hive/[hiveId]/comments` | `(app)/hive/[hiveId]/comments/page.tsx` | All inline annotations left on chapters. |
| `/en/hive/[hiveId]/forum` | `(app)/hive/[hiveId]/forum/page.tsx` | General hive discussion forum. |
| `/en/hive/[hiveId]/members` | `(app)/hive/[hiveId]/members/page.tsx` | Member list with role management (owner/mod can demote/remove). |
| `/en/hive/[hiveId]/word-goals` | `(app)/hive/[hiveId]/word-goals/page.tsx` | Shared word-count goals + per-member contribution. |
| `/en/hive/[hiveId]/milestones` | `(app)/hive/[hiveId]/milestones/page.tsx` | Project milestone tracking. |
| `/en/hive/[hiveId]/settings` | `(app)/hive/[hiveId]/settings/page.tsx` | Owner-only — edit metadata, privacy, invitations. |

---

### Clubs — book clubs

| URL | File | Purpose |
|---|---|---|
| `/en/clubs` | `(app)/clubs/page.tsx` | List of clubs the user is in + pending club invites. |
| `/en/clubs/create` and `/en/clubs/new` | `(app)/clubs/create/page.tsx`, `(app)/clubs/new/page.tsx` | Create a new club. (Two routes exist — `new` is the older one; both render a club-creation form.) |
| `/en/clubs/[clubId]` | `(app)/clubs/[clubId]/page.tsx` | Club dashboard. Currently-reading book, recent discussions, member count, reading list. Non-members see a join gate (if the club isn't private). |
| `/en/clubs/[clubId]/about` | `(app)/clubs/[clubId]/about/page.tsx` | Club description, rules, member roster. |
| `/en/clubs/[clubId]/discussions` | `(app)/clubs/[clubId]/discussions/page.tsx` | All discussion threads (pinned first, then by recency). |
| `/en/clubs/[clubId]/discussions/create` | `(app)/clubs/[clubId]/discussions/create/page.tsx` | Start a new discussion. |
| `/en/clubs/[clubId]/discussions/[discussionId]` | `(app)/clubs/[clubId]/discussions/[discussionId]/page.tsx` | Read + reply to one discussion thread (replies nested 2 levels). |
| `/en/clubs/[clubId]/members` | `(app)/clubs/[clubId]/members/page.tsx` | Member roster. Owner/mods can change roles or remove members. |
| `/en/clubs/[clubId]/reading-list` | `(app)/clubs/[clubId]/reading-list/page.tsx` | Curated club reading list with `IN_PROGRESS` / `COMPLETED` / `NOT_STARTED` per book. |
| `/en/clubs/[clubId]/settings` | `(app)/clubs/[clubId]/settings/page.tsx` | Owner-only. Metadata, privacy, member invitations. |

---

### Reading lists

| URL | File | Purpose |
|---|---|---|
| `/en/reading-lists` | `(app)/reading-lists/page.tsx` | User's own lists + lists they like. |
| `/en/reading-lists/create` | `(app)/reading-lists/create/page.tsx` | Create a new list (title, description, optional commentary per book). |
| `/en/reading-lists/[listId]` | `(app)/reading-lists/[listId]/page.tsx` | View a list with ranked books and curator commentary. Privacy-aware: `PRIVATE` is owner-only. |
| `/en/reading-lists/[listId]/edit` | `(app)/reading-lists/[listId]/edit/page.tsx` | Owner-only. Edit metadata + reorder books. |

---

### Sparks — writing prompts

| URL | File | Purpose |
|---|---|---|
| `/en/sparks` | `(app)/sparks/page.tsx` | User's prompts + entries + pending invitations. |
| `/en/sparks/create` | `(app)/sparks/create/page.tsx` | Create a new prompt (title, description, deadline, rules). |
| `/en/sparks/[promptId]` | `(app)/sparks/[promptId]/page.tsx` | Prompt detail: rules, leaderboard, entries, submission status. |
| `/en/sparks/[promptId]/create` | `(app)/sparks/[promptId]/create/page.tsx` | Submit an entry to a prompt. |
| `/en/sparks/[promptId]/edit` | `(app)/sparks/[promptId]/edit/page.tsx` | Edit your entry before the deadline. |
| `/en/sparks/[promptId]/[entryId]` | `(app)/sparks/[promptId]/[entryId]/page.tsx` | Read a single entry. |

---

### User profiles

| URL | File | Purpose |
|---|---|---|
| `/en/u/[username]` | `(app)/u/[username]/page.tsx` | Public profile. Avatar, bio, member-since, stats (public books, total likes), prompt wins, and tabs for books / lists / clubs / hives / sparks. Privacy is respected (`PUBLIC` / `FRIENDS` / `PRIVATE`). |

`[username]` is a string (not a UUID).

---

### Search

| URL | File | Purpose |
|---|---|---|
| `/en/search?q=...` | `(app)/search/page.tsx` | Unified search across books / clubs / hives / sparks. Empty query redirects to `/explore`. Each section limited to 5 results with a "See all" link. |

---

### Friends

| URL | File | Purpose |
|---|---|---|
| `/en/friends` | `(app)/friends/page.tsx` | Three tabs: **Friends** (current friends), **Requests** (sent + received), **Find** (suggested users). |

---

### Notifications

| URL | File | Purpose |
|---|---|---|
| `/en/notifications` | `(app)/notifications/page.tsx` | Notification center (paginated, with mark-all-read and 30-day pruning). |

---

### Settings

| URL | File | Purpose |
|---|---|---|
| `/en/settings` | `(app)/settings/page.tsx` | Account: profile (username, email, avatar, bio), password (only if account uses email/password), connected OAuth accounts, subscription status. |

---

### Premium

| URL | File | Purpose |
|---|---|---|
| `/en/premium` | `(app)/premium/page.tsx` | Pricing page. Free vs Premium feature comparison, "Solo indie" developer message. Free users see "Upgrade", premium users see "Manage subscription". |
| `/en/premium/success` | `(app)/premium/success/page.tsx` | Stripe checkout return page — confirmation after a successful subscription. |

---

### Community

| URL | File | Purpose |
|---|---|---|
| `/en/community` | `(app)/community/page.tsx` | General community hub. |

---

### Feedback

| URL | File | Purpose |
|---|---|---|
| `/en/feedback` | `(app)/feedback/page.tsx` | Feedback form (feature request / bug / general / content concern). |

---

### Admin

Layout: `app/[locale]/(app)/admin/layout.tsx`. **All routes require `users.role === 'admin'`.**

| URL | File | Purpose |
|---|---|---|
| `/en/admin` | `admin/page.tsx` | Dashboard — totals (users, books, chapters, clubs, hives, prompts), 30-day signup chart, cleanup health (stale invites, old notifications), pending reports. |
| `/en/admin/announcements` | `admin/announcements/page.tsx` | Create / activate / deactivate / delete site-wide announcements. |
| `/en/admin/audit-log` | `admin/audit-log/page.tsx` | Admin action audit trail. |
| `/en/admin/books` | `admin/books/page.tsx` | All books (search + delete). |
| `/en/admin/chapters` | `admin/chapters/page.tsx` | All chapters (moderation). |
| `/en/admin/clubs` | `admin/clubs/page.tsx` | All clubs (moderation). |
| `/en/admin/discussions` | `admin/discussions/page.tsx` | All club discussions (moderation). |
| `/en/admin/feedback` | `admin/feedback/page.tsx` | User feedback inbox. |
| `/en/admin/hives` | `admin/hives/page.tsx` | All hives (moderation). |
| `/en/admin/notifications` | `admin/notifications/page.tsx` | Notification management. |
| `/en/admin/prompts` | `admin/prompts/page.tsx` | All prompts (moderation). |
| `/en/admin/reports` | `admin/reports/page.tsx` | Content reports queue (dismiss / remove content). |
| `/en/admin/users` | `admin/users/page.tsx` | User search, role changes, premium toggle, ban/unban. |

---

## Dynamic route parameters — quick reference

| Pattern | Type | Notes |
|---|---|---|
| `[locale]` | enum string | `en`, `es`, `fr`, `de`, `pt`. Always the first segment. |
| `[bookId]` | UUID | Identifies a book. |
| `[chapterId]` | UUID | Identifies a chapter within a book. |
| `[hiveId]` | UUID | Identifies a hive. |
| `[clubId]` | UUID | Identifies a book club. |
| `[listId]` | UUID | Identifies a reading list. |
| `[promptId]` | UUID | Identifies a writing prompt / spark. |
| `[entryId]` | UUID | A spark entry (submission). |
| `[submissionId]` | UUID | A hive chapter submission. |
| `[suggestionId]` | UUID | A hive rewrite suggestion. |
| `[username]` | string | The user's public username (not their UUID). |

---

## Layout map (which layouts wrap which routes)

```
app/layout.tsx                                 — root (font, html)
└─ app/[locale]/layout.tsx                     — locale + i18n + providers + cookie banner
   ├─ app/[locale]/(public)/layout.tsx         — pass-through for legal pages
   ├─ app/[locale]/(auth)/layout.tsx           — bounces fully-onboarded users to /home
   └─ app/[locale]/(app)/layout.tsx            — auth gate + onboarding gate + V2AppShell (sidebar/header)
      ├─ app/[locale]/(app)/explore/layout.tsx — adds ExploreNav tabs
      ├─ app/[locale]/(app)/hive/[hiveId]/layout.tsx — hive sub-nav
      └─ app/[locale]/(app)/admin/layout.tsx   — admin gate (role === 'admin')
```

---

## Counts at a glance

- **~100+ pages** across authenticated, auth, public, and admin sections
- **10 dynamic-segment patterns** (9 UUIDs + 1 username)
- **5 supported locales** (en / es / fr / de / pt)
- **5 route groups**: `(app)`, `(auth)`, `(public)`, plus implicit root and admin
