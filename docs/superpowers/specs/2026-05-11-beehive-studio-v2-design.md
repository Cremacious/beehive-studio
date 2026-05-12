# Beehive Studio v2 — Design Spec

**Date:** 2026-05-11
**Status:** Approved — ready for implementation planning
**Replaces:** Beehive Books v1 (`C:\Code\personal\beehive-books-online`)

---

## 1. Vision & Positioning

Beehive Studio is a SaaS book writing and editing platform that competes on two fronts simultaneously:

- **Writing tools:** Against Scrivener and Google Docs — a professional three-panel Studio workspace that serious authors actually want to use.
- **Discovery & community:** Against Wattpad and RoyalRoad — a chapter-first reader experience with social features that keep both writers and readers engaged.

**Brand soul:** A bee-themed version of "Write like a professional, publish to a community." Candidate taglines:
- "Craft your story. Grow your hive."
- "Every great story starts in the hive."

**Premium pitch:** Built and maintained by a solo developer. Subscribing to premium helps keep the app alive. The tone is authentic and sympathetic — not corporate. "No VC funding. No corporate overlords. Just one developer and a community of writers." / "Help the hive thrive."

**V1 inspiration:** The v1 codebase (`beehive-books-online`) is reference material only. v2 is a clean rewrite with a new schema, new feel, and the Studio as the primary surface rather than an afterthought.

---

## 2. Tech Stack

Same proven stack as v1, carried forward:

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (new-york) + Radix UI |
| Database | Neon serverless Postgres |
| ORM | Drizzle ORM |
| Auth | better-auth (email/password + Google OAuth) |
| Editor | TipTap v3 |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Forms | react-hook-form + Zod |
| Images | Cloudinary |
| Payments | Stripe |
| Email | Resend |
| Rate limiting | Upstash Redis |
| Hosting | Vercel |

**Platform targets:** Web (desktop + mobile-responsive) — primary. iOS and Android native apps are future scope; the web API should be clean enough to support them without a monorepo restructure.

**No AI features.** No LLM integrations, no generation. Competes on craft tools, not AI gimmicks. Keeps operating costs predictable.

**No real-time collaboration.** All collaboration is async (Hive model). No WebSockets, no CRDT layer. Zero additional infrastructure cost.

---

## 3. App Structure — Three Surfaces

The app has three equally important surfaces. Users move between them via top-level navigation.

```
┌──────────────────────────────────────────────────────┐
│  🐝 Beehive Studio  │ Studio │ Community │ Discover  │
└──────────────────────────────────────────────────────┘
         │                  │               │
    Writing workspace    Social feed    Book discovery
    Hive collaboration   Author profiles  Genre browsing
    Publishing prep      Reading shelf    New chapters feed
    Goals & streaks      Comments/likes   Trending / featured
```

### The publishing flow

```
Write in Studio → Collaborate in Hive → Publish to Community → Discovered by Readers
```

---

## 4. Studio — The Writing Workspace

The primary surface. Authors spend the majority of their time here.

### 4.1 Projects Dashboard (`/studio`)

- Grid of the user's active books with cover, title, word count, last-edited date, and status badge.
- "New Book" CTA — creates a project and opens the workspace.
- Free users capped at 3 active books. Hitting the cap triggers the premium upgrade prompt.

### 4.2 Writing Workspace (`/studio/[bookId]`) — Three-Panel Layout

**Panel A — Binder (left, ~200px)**

The project tree. Everything in the manuscript lives here as a unified tree via the `binder_items` table.

- **Manuscript section:** Parts (collections) → Chapters. Front matter and back matter nodes.
- **Research section:** Characters, World Notes, Outline, References — separate content nodes, same tree.
- Drag-and-drop reorder of chapters and parts.
- "New Chapter" button pinned to the bottom.
- Active chapter highlighted in brand yellow.
- Collapsible on mobile.

**Panel B — Editor (center, flex-fill)**

TipTap v3 rich text editor.

- Formatting toolbar: Bold, Italic, Underline, H1, H2, paragraph, em dash, scene break (✦).
- Clean reading-width layout (~65ch max, centered).
- Scene breaks rendered as `✦` dividers.
- Inline comments from Hive collaborators appear as highlighted spans (free).
- **Focus Mode** (premium): hides both side panels, full-screen, typewriter scroll. Triggered from the toolbar.

**Panel C — Inspector (right, ~180px)**

Metadata and writing stats for the active chapter.

- Chapter word count + progress bar toward chapter target.
- Book total word count and chapter count.
- Chapter status selector: `Idea → Outline → First Draft → Revised → Final`.
- Daily writing goal + word count toward it.
- Writing streak (🔥 N-day streak).
- Chapter notes — private scratchpad, not visible to collaborators.
- **Publishing metadata** (premium, collapsed section): ISBN, subtitle, trim size, author bio for back matter.

### 4.3 Binder Item Types

All binder items share one `binder_items` table with a `type` discriminator:

| Type | Description |
|---|---|
| `part` | A collection/grouping of chapters |
| `chapter` | A writable chapter (links to `chapters` table) |
| `front_matter` | Title page, dedication, epigraph, etc. |
| `back_matter` | Acknowledgements, about the author, etc. |
| `research_folder` | A grouping for research items |
| `research_note` | A free-text research document |
| `character` | A character sheet |
| `outline` | The story outline document |

### 4.4 Version History (Premium)

- Every save creates a `chapter_snapshots` row (content + word count + timestamp).
- Inspector shows a "History" tab listing snapshots. Premium users can restore any snapshot.
- Free users see the tab but are gated with an upgrade prompt.

### 4.5 Focus Mode (Premium)

Hides Binder and Inspector. Full-screen editor. Typewriter scrolling keeps the cursor vertically centered. Toggled from the editor toolbar. Escape or click a button to exit.

### 4.6 Writing Goals & Analytics (Premium)

- Daily word count target (user-configurable).
- Streak tracking — consecutive days with at least 1 word written.
- Pace projections — "at your current pace, you'll finish in ~X weeks."
- Heatmap calendar showing writing activity by day.
- Free users see only basic word count totals.

### 4.7 Templates (Premium)

Genre-specific book structure presets applied at book creation:

- **Thriller:** Three-act structure with chapter count suggestions.
- **Romance:** HEA/HFN arc milestones.
- **Fantasy:** World-building research folders pre-populated.
- **Screenplay format:** Scene heading, action, dialogue styles.
- Templates are data rows in a `book_templates` table — extensible without code changes.

---

## 5. Hive — Async Collaboration

Free for all users, with premium perks. Directly evolved from v1 Hives — same concept, tightly integrated into the Studio.

### 5.1 Core (Free)

- Up to 3 active Hives per user (free). Unlimited for premium.
- Up to 5 members per Hive (free). Unlimited for premium.
- Roles: **Owner** and **Contributor** (free). Advanced roles are premium.
- **Chapter submissions:** Contributors submit chapters for Owner review. Owner approves/rejects.
- **Inline suggestions:** Highlight text → propose a rewrite. Owner accepts/rejects via diff view.
- **Inline comments:** Anchored to specific text spans. Resolved by owner.
- **Outline board:** Shared drag-and-drop outline.
- **Wiki:** Shared world-building notes.
- **Buzz feed:** Activity stream for the Hive.

### 5.2 Premium Hive Perks

| Perk | Detail |
|---|---|
| Unlimited Hives | Remove the 3-Hive cap |
| Unlimited members | Remove the 5-member cap |
| Advanced roles | Editor, Beta Reader, Proofreader — with per-chapter permissions |
| Contribution analytics | Per-member word count, activity heatmap |
| Collaborative export | Any premium member (not just owner) can export |
| Hive version history | Full edit history for shared chapters |

---

## 6. Publishing Prep (Premium)

Surfaced in the Inspector panel's Publishing tab. Designed with a future publisher/small press account type in mind — the schema supports it without requiring a migration.

### 6.1 Export Presets

Presets are stored as rows in `export_presets` (not hardcoded), making them extensible:

| Preset | Format | Target |
|---|---|---|
| Standard Manuscript Format | DOCX | Literary agents, traditional publishers |
| EPUB | EPUB | E-readers, KDP digital |
| KDP Print-Ready PDF | PDF | Amazon KDP print |
| IngramSpark PDF | PDF | Indie print distribution |
| DOCX | DOCX | Editors, beta readers, general use |

### 6.2 Publishing Metadata (`book_publishing_metadata` table)

Separate table from `books` — keeps core book data clean while the publishing layer is isolated:

- `isbn` — optional
- `subtitle` — optional
- `trim_size` — e.g. `6x9`, `5x8` (for print presets)
- `author_bio` — used in back matter on export
- `dedication` — optional front matter
- `publisher_name` — empty for now; populated when publisher accounts land
- `edition` — e.g. `First Edition`

### 6.3 Publisher Handoff Package

One-click ZIP download containing:
- Manuscript as DOCX (standard manuscript format)
- One-page synopsis (user-written, stored as a research note)
- Author bio
- `metadata.json` with all publishing metadata fields

This is the foundation for a future publisher account type that can receive these packages from authors directly in the app.

---

## 7. Community Surface

### 7.1 Feed (`/community`)

- Activity feed of authors the user follows: new books published, new chapters posted, Hive completions, Sparks wins.
- "Reading shelf" tab — books the user is currently reading or has bookmarked.

### 7.2 Author Profiles (`/u/[username]`)

- Avatar, bio, follower/following count.
- Published books grid.
- Writing stats (total words published, books completed).
- Follow button.
- Privacy-respecting: only public books are shown.

### 7.3 Sparks — Writing Contests

Inherited from v1. Authors create prompt-based contests with deadlines. Community votes on entries. Winners get a profile badge. Free feature — drives engagement.

---

## 8. Discover Surface

Competes directly with RoyalRoad and Wattpad for reader retention.

### 8.1 Discover Page (`/discover`)

- **Genre filter bar** — primary browse path. Tags: Fantasy, Romance, Sci-Fi, Thriller, Horror, Mystery, Literary, YA, etc.
- **Trending This Week** — books ranked by likes + comments + new reads in the last 7 days.
- **New Chapters Today** — chapter-first feed showing the most recently posted chapters. Rewards active writers and gives readers a daily reason to return. Each entry shows: book title, chapter number, author, genre tag, word count.
- **Editor's Picks** — manually curated by admin.
- **New Releases** — recently published books.

### 8.2 Book Page (`/books/[bookId]`)

- Cover, title, author, genre tags, synopsis.
- Like + comment + bookmark.
- Chapter list (clicking a chapter opens the reader).
- "More by this author" row of the author's other published books.

### 8.3 Chapter Reader (`/read/[bookId]/[chapterId]`)

- Distraction-free layout: max-width column (~65ch), clean typography, no sidebar.
- Reader top bar: back to book title, chapter progress (Ch N of M), Follow author button.
- Chapter navigation: ← previous / next → at the bottom.
- Pinned engagement bar: ❤ likes · 💬 comments · 🔖 bookmark · Report.
- **Ads for free users** — banner between chapters or below the engagement bar. Premium removes ads entirely.
- Reading progress tracked server-side for "continue reading" resumption.

---

## 9. Monetization

### 9.1 Tiers

**Free**
- Ad-supported (ads in reader view and community feed).
- Up to 3 active books.
- Full TipTap editor, Binder, Inspector (basic).
- Plain text export only.
- Up to 3 active Hives, 5 members each.
- All community and discovery features.
- Sparks contests.

**Premium (~$X/month, price TBD)**
- No ads — ever.
- Premium badge on profile.
- Everything in free, plus all Studio and Hive premium features listed in sections 4 and 5.
- Publishing prep tools and all export formats.
- Full data export / project archive (ZIP of all books).

### 9.2 Premium Pitch

The emotional core of the upgrade prompt is the solo dev angle:
- "Beehive Studio is built and maintained by one person."
- "By subscribing, you're backing a solo dev who built this for writers like you."
- "Help the hive thrive."

Upgrade prompts appear at natural friction points (hitting a book/Hive cap, trying to export, accessing version history) — not as interstitial popups.

### 9.3 Ads

- **Placement:** Reader view (between chapters), community feed.
- **Implementation:** TBD — standard ad network (e.g. Google AdSense) or direct sponsorships.
- **Premium removes all ads** across all surfaces.

### 9.4 Billing

- Stripe Checkout + Customer Portal (same as v1).
- Stripe webhook keeps `users.premium` in sync.
- `user_billing` table (split from `users`) holds all Stripe fields.

---

## 10. Database Schema — Key Tables

### Auth & Identity

```
users             — id, email, email_verified, created_at, updated_at, banned, banned_at
user_profiles     — user_id (1:1), username, display_name, bio, avatar_url, onboarding_complete, role
user_billing      — user_id (1:1), premium, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_current_period_end
session           — id, user_id, token, expires_at, ip_address, user_agent
account           — id, user_id, provider_id, account_id, password (hashed)
verification      — id, identifier, value, expires_at
```

### Books & Content

```
books             — id, user_id, title, genre, visibility (PRIVATE/PUBLIC), status (DRAFT/PUBLISHED), cover_url, explorable, created_at, updated_at
book_publishing_metadata — book_id (1:1), isbn, subtitle, trim_size, author_bio, dedication, publisher_name, edition
binder_items      — id, book_id, parent_id, type, order, title, content (nullable JSON for research/character nodes)
chapters          — id, book_id, binder_item_id, content (TipTap JSON), word_count, status, notes, created_at, updated_at
chapter_snapshots — id, chapter_id, content, word_count, created_at (version history)
```

### Collaboration (Hive)

```
hives             — id, book_id, owner_id, name, description, visibility, status (ACTIVE/COMPLETED)
hive_members      — id, hive_id, user_id, role (OWNER/CONTRIBUTOR/EDITOR/BETA_READER/PROOFREADER)
hive_invites      — id, hive_id, invitee_id, role, status (PENDING/ACCEPTED/DECLINED)
hive_submissions  — id, hive_id, chapter_id, submitter_id, status (PENDING/APPROVED/REJECTED), reviewer_note
hive_suggestions  — id, hive_id, chapter_id, author_id, original_text, suggested_text, status, diff
hive_comments     — id, hive_id, chapter_id, author_id, anchor_start, anchor_end, content, resolved
```

### Social

```
follows           — follower_id, followee_id, created_at
book_likes        — user_id, book_id, created_at
book_comments     — id, book_id, user_id, content, parent_id (threading), created_at
bookmarks         — user_id, book_id, created_at
reading_progress  — user_id, book_id, chapter_id, last_opened_at
notifications     — id, user_id, type, actor_id, resource_type, resource_id, read, created_at
sparks            — id, creator_id, title, description, deadline, rules
spark_entries     — id, spark_id, user_id, chapter_id, votes, created_at
```

### Publishing

```
export_presets    — id, name, format (EPUB/PDF/DOCX), config (JSON), is_system_preset, created_at
book_templates    — id, name, genre, structure (JSON), is_system_template
```

---

## 11. Route Structure

```
app/[locale]/
├── (public)/
│   ├── /                  Landing page (marketing)
│   ├── /privacy           Privacy policy
│   ├── /terms             Terms of service
│   ├── /cookies           Cookie policy
│   └── /dmca              DMCA policy
├── (auth)/
│   ├── /sign-in
│   ├── /sign-up
│   ├── /forgot-password
│   ├── /reset-password
│   └── /onboarding        Username → bio → avatar
├── (app)/                 Auth-gated, onboarding-gated
│   ├── /studio            Projects dashboard
│   ├── /studio/[bookId]   Three-panel writing workspace
│   ├── /community         Following feed + reading shelf
│   ├── /discover          Book discovery (trending, new chapters, genres)
│   ├── /books/[bookId]    Public book page
│   ├── /read/[bookId]/[chapterId]  Chapter reader
│   ├── /hive              User's Hives list
│   ├── /hive/[hiveId]/…   Hive workspace (outline, wiki, buzz, submissions, etc.)
│   ├── /u/[username]      Author profile
│   ├── /notifications
│   ├── /settings
│   ├── /premium           Pricing page (solo dev pitch)
│   ├── /premium/success   Post-Stripe confirmation
│   ├── /sparks/…          Writing contests
│   ├── /search            Unified search
│   └── /admin/…           Admin dashboard (role-gated)
├── api/
│   ├── /api/auth/[...all] better-auth catch-all
│   ├── /api/stripe/webhook
│   ├── /api/stripe/checkout
│   ├── /api/stripe/portal
│   └── /api/cron/cleanup
```

---

## 12. Auth & Middleware

Carried forward from v1 with the schema split applied:

- **better-auth** — email/password + Google OAuth. Session: 30-day expiry, 1-day refresh, HTTP-only cookies.
- **Onboarding gate** — middleware redirects to `/onboarding` until `user_profiles.onboarding_complete = true`.
- **`requireAuth()`** — checks session + ban status. Used in every server action.
- **`getOptionalUserId()`** — for endpoints that work for both signed-in and signed-out users.
- **Rate limiters (Upstash):** signUp, signIn, checkout, api, action, search, page buckets.

---

## 13. Key Architectural Decisions

| Decision | Choice | Reason |
|---|---|---|
| Workspace layout | Scrivener-style three-panel | Most powerful for long-form; distinct from Google Docs |
| Collaboration | Async (Hive model) | Zero extra infra cost; proven in v1 |
| Real-time | None | WebSocket servers don't run on Vercel serverless; cost |
| AI features | None | Keeps costs predictable; competes on craft |
| Export presets | Data rows, not hardcoded | Publisher-extensible without code changes |
| Publisher metadata | Separate `book_publishing_metadata` table | Clean separation; future publisher account type ready |
| Binder tree | Single `binder_items` table with parent_id | Flexible for chapters, parts, research, notes |
| User schema | Split into `users` + `user_profiles` + `user_billing` | Fixes v1's fat users table |
| Premium pitch | Solo dev sympathy angle | Authentic; resonates with creative community |
| Ad placement | Reader view between chapters | Least intrusive; premium removes entirely |
| Social graph | One-directional follows (not mutual friends) | Matches Wattpad/RoyalRoad model; simpler schema; authors build audiences, not friend lists |

---

## 14. Out of Scope for v1

**New features deferred:**
- Real-time collaboration (WebSockets / CRDT)
- AI writing assistance of any kind
- Native iOS / Android apps (web-first; mobile-responsive)
- Publisher / small press account type (schema is ready; UI is future)
- Offline mode / service worker
- Light mode (dark only, same as v1)
- Internationalization (defer — focus on English first)

**V1 features intentionally dropped in v2:**
- **Book Clubs** — reading clubs with discussion threads. Dropped to keep scope focused on writing and discovery. May return in a future update.
- **Reading Lists** — curated user lists of books. Dropped; bookmarks cover the basic use case.
- **Mutual Friends system** — v1 had friend requests and a bidirectional friend graph. v2 replaces this with one-directional follows (Wattpad/Twitter model) — simpler, more appropriate for a publishing platform.
