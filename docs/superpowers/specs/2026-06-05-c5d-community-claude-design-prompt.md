# Beehive Studio — Community Surfaces Design Pass

> Paste this entire document into a fresh claude.ai/design session as your starting prompt. Iterate with the model across 22 surfaces + ~12 shared components.
>
> This is the C5d deliverable closing the Community phase of Beehive Studio. Companion sub-deliverables (engineering spec, plan, mechanical port) ship AFTER you iterate with claude.ai/design and export the bundle.

---

## 1. Project Context

**Beehive Studio** is a solo-developer writing platform that sits at the intersection of a Scrivener-style book editor (Studio), persistent collaborative writing groups (Hives), and a community-discovery social layer. Dark-only. Bee-themed (yellow `#FFC300` accent restraint, paper-warm cover artwork on book cards). Next.js 16 App Router + Tailwind v4 + shadcn/ui.

The **Community phase** is the social-media-hub layer that turns scattered writers into a real community. Five sub-projects have shipped functionally:

1. **C1 Foundation** — friends + follows graph + `/community` hub + activity feed event store + global cascading blocks + invite-by-link tokens + nav user-avatar dropdown.
2. **C2 Sparks Refresh** — writing prompt contests with 3-tier visibility + status state machine + likes on entries + threaded comments + `/sparks` canonical routes.
3. **C3 Reading Lists** — curated book lists + lazy-created "Liked" auto-list + follower counts + activity feed events + `/reading-lists` canonical routes.
4. **C4 Book Clubs** — persistent multi-member groups around current book + queue + past reads + discussions + reading schedule + invite by username AND by link + `/clubs` canonical routes.
5. **C5a @-Mentions + C5b Notification Prefs + Feed Ranking + Cleanup** — engineering polish: @-mentions across 12 social text surfaces; per-type notification opt-out at `/settings/notifications`; friend-first feed ordering; bell deep-link precision.

Your job (this design pass) is **the final piece: C5d**. Apply a unified visual treatment across every Community surface so the phase reads as cohesive instead of accreted-across-five-sub-projects.

**Engineering decisions you should NOT disturb:**

- Routes + URL shapes are locked. Don't propose new routes or moved routes.
- Backend data shapes are locked. Don't propose new fields or restructured server-action returns.
- IA tweaks already locked (see §6 per-surface table) — Books panel position, profile section order, Friends tab consolidation. Other IA stays as shipped.
- Dark-mode-only. Cream paper appears ONLY on the studio chapter editor (out of scope here).
- AppNav is the persistent top chrome on every `(app)` route.

---

## 2. Design System Reference

These tokens are live in `app/globals.css`. Use them verbatim. You may propose ~8 new categorical accent tokens with rationale (see §8). Alpha tints via `oklch(from var(--token) l c h / 0.X)` are free.

### 2.1 Chrome scale (cool-gray walnut canvas — load-bearing)

```css
--canvas-dark-100: #262728;                       /* app-bg base — backdrop */
--canvas-dark-150: oklch(0.275 0.003 256);
--canvas-dark-200: oklch(0.295 0.003 256);        /* panel base */
--canvas-dark-250: oklch(0.325 0.003 256);        /* panel highlight */
--canvas-dark-300: oklch(0.360 0.003 256);        /* tile base + recessed-input bg */
--canvas-dark-350: oklch(0.400 0.003 256);        /* tile highlight */
--canvas-dark-400: oklch(0.450 0.003 256);        /* hover lift base */
```

### 2.2 Ink scale

```css
--canvas-dark-ink-faint:  oklch(0.500 0.003 256); /* placeholder, disabled */
--canvas-dark-ink-muted:  oklch(0.680 0.003 256); /* secondary, meta lines */
--canvas-dark-ink:        oklch(0.880 0.003 256); /* body text */
--canvas-dark-ink-strong: oklch(0.965 0.003 256); /* emphasized text, headings on chrome */
```

### 2.3 Brand (restraint rule — see §8)

```css
--brand:        #FFC300;
--brand-hover:  #FFD040;
--brand-active: #E0AC01;
--brand-soft:   oklch(0.85 0.18 90 / 0.18);
--brand-ink:    oklch(0.20 0.05 75);              /* dark text on brand-yellow bg */
```

### 2.4 Status palette (chapter + submission status)

```css
--status-idea:        oklch(0.74 0.045 245);      /* slate blue — drafting */
--status-outline:     oklch(0.74 0.070 295);      /* lavender — outlined */
--status-first-draft: oklch(0.80 0.140 88);       /* warm gold — first draft */
--status-revised:     oklch(0.74 0.080 155);      /* mint — revised */
--status-final:       oklch(0.68 0.130 35);       /* coral — final */

--status-warning: oklch(0.78 0.13 70);            /* warm gold — pending review */
--status-success: oklch(0.74 0.12 145);           /* mint — approved */
--status-error:   oklch(0.66 0.18 25);            /* coral — rejected */
```

### 2.5 Role palette (currently used by hive members)

```css
--role-owner:       oklch(0.78 0.13 70);          /* warm gold */
--role-moderator:   oklch(0.72 0.11 250);         /* slate blue */
--role-contributor: oklch(0.74 0.12 145);         /* mint */
--role-reader:      oklch(0.66 0.04 240);         /* cool gray */
```

> Note: book clubs currently piggyback on `--status-*` for role pills. Candidate for new tokens — see §8.

### 2.6 Layer palette (hive annotation/suggestion accents)

```css
--layer-grammar:    oklch(0.78 0.13 70);          /* gold */
--layer-plot:       oklch(0.66 0.18 25);          /* coral */
--layer-tone:       oklch(0.72 0.11 280);         /* lilac */
--layer-continuity: oklch(0.74 0.12 145);         /* mint */
--layer-general:    oklch(0.66 0.04 240);         /* cool gray */
```

### 2.7 Font scale

```css
--font-display: var(--font-comfortaa), system-ui, sans-serif;     /* Comfortaa — headings + brand */
--font-ui:      var(--font-geist-sans), ui-sans-serif, system-ui;  /* Geist — body UI text */
--font-prose:   var(--font-newsreader), 'Source Serif 4', Georgia, serif; /* Newsreader — long prose */
--font-mono:    var(--font-jetbrains-mono), 'JetBrains Mono', monospace;  /* JetBrains Mono — labels, eyebrows, code */
```

### 2.8 Radius scale (load-bearing)

```css
--r-card: 20px;   /* outer panels — section cards, modals */
--r-row:  14px;   /* inset rows — list items, inputs */
--r-btn:  12px;   /* square-ish buttons */
--r-pill: 999px;  /* fully rounded — status pills, brand-pill CTAs */
--r-nav:  20px;   /* app nav bar */
```

### 2.9 Depth recipes

```css
/* Outer panel chrome */
background: linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200));
box-shadow: var(--sh-card);          /* multi-layer drop + inner top highlight */
border-top: var(--br-card);          /* 0.5px solid oklch(1 0 0 / 0.04) — hairline highlight */
border-radius: var(--r-card);

/* Inset tile chrome (rows, secondary buttons) */
background: linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300));
box-shadow: var(--sh-tile);
border-radius: var(--r-row);  /* or --r-btn for square */

/* Recessed input */
background: var(--canvas-dark-100);
box-shadow: var(--sh-inset);
border-radius: var(--r-row);
```

---

## 3. Universal Page Shell DOM

Every `(app)`-route page sits inside this shell. Don't restyle the shell — design content WITHIN it.

```html
<body class="bg-[#262728] text-[var(--canvas-dark-ink)]">
  <header class="AppNav">
    <!-- Persistent top chrome — logo + Discover + Studio + Community + bell + avatar-dropdown -->
  </header>
  <main class="flex-1">
    <div class="max-w-{N} mx-auto px-4 py-6 sm:px-6">
      <!-- Per-surface content -->
    </div>
  </main>
</body>
```

Max-width per surface type:
- **Hub / index / detail pages**: `max-w-5xl` (1024px) — most surfaces.
- **Settings pages**: `max-w-3xl` (768px).
- **Single-prose pages** (discussion thread, comments): `max-w-3xl`.
- **Profile + 2-column layouts**: `max-w-5xl`.

---

## 4. Pill Convention

Every categorical tag in the system uses the same alpha-tint shape:

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 2px 10px;
  border-radius: var(--r-pill);
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: oklch(from var(--token) l c h / 0.14);
  color: var(--token);
  border: 1px solid oklch(from var(--token) l c h / 0.30);
}
```

Per-pill token mapping table:

| Pill type | Token family | Example values |
|---|---|---|
| Chapter status | `--status-{idea/outline/first-draft/revised/final}` | "Drafting", "Outlined", "Final" |
| Submission status | `--status-{warning/success/error}` | "Pending", "Approved", "Rejected" |
| Visibility (book/list/club/spark) | `--list-visibility-{public/friends/private}` (CANDIDATE NEW — see §8) | "Public", "Friends", "Private" |
| Role (club + hive) | `--role-{owner/moderator/contributor/reader}` OR `--club-role-{owner/mod/member}` CANDIDATE | "Owner", "Mod", "Member" |
| Spark status | `--spark-status-{open/voting/closed}` CANDIDATE | "Open", "Voting", "Closed" |
| Discussion topic | `--topic-{general/worldbuilding/feedback/off-topic}` (already exists for hive — verify) | "General", "Feedback" |
| Annotation layer | `--layer-{grammar/plot/tone/continuity/general}` | "Grammar", "Plot" |
| Word goal type | `--goal-{daily/weekly/monthly/custom}` | "Daily", "Weekly" |

Use the LucideReact icon library for inline iconography (Globe / Users / Lock / Pin / etc.). Icons in pills are 12px.

---

## 5. Row Shapes — Forum-Table vs Card-Stack

Two row layouts cover ~95% of lists in the system. Pick per surface based on content shape.

### 5.1 Forum-table (when rows have parallel meta columns)

Used by: discussion list, outline index, submissions list, chapters index, members list, suggestions list.

```html
<section class="panel">
  <!-- Column-header strip -->
  <div class="strip" style="background: var(--canvas-dark-100); border-top: var(--br-card); border-bottom: var(--br-card);">
    <ul class="grid grid-cols-[1fr_90px_130px] font-mono text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] px-6 py-2">
      <li>Discussion</li>
      <li>Replies</li>
      <li>Last activity</li>
    </ul>
  </div>
  <!-- Flat divide-y rows (no per-row tile chrome) -->
  <ul class="divide-y divide-[var(--canvas-dark-300)]/40">
    <li class="grid grid-cols-[1fr_90px_130px] px-6 py-3 hover:bg-[var(--canvas-dark-300)]">
      <div>... row content ...</div>
      <div class="text-right">12</div>
      <div class="text-right text-[var(--canvas-dark-ink-muted)]">2h ago</div>
    </li>
  </ul>
</section>
```

NO `translate-y` jitter on hover; only background flip.

### 5.2 Card-stack (when rows are self-contained posts)

Used by: buzz board, suggestions per-chapter group, word goals contributors, activity feed, comment list.

```html
<section class="panel">
  <ul class="space-y-3 px-6 pb-6">
    <li class="tile" style="background: linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300)); box-shadow: var(--sh-tile); border-radius: var(--r-row); padding: 1rem;">
      <!-- Self-contained card content -->
    </li>
  </ul>
</section>
```

---

## 6. 22-Surface Specification Table

Produce one HTML mockup per row. Use realistic example data (book titles, usernames, timestamps). DO NOT use Lorem Ipsum.

| # | Surface (route) | Width | Layout | Key chrome + content |
|---|---|---|---|---|
| 1 | `/community` (hub) | max-w-5xl | 2-col with 280px right rail | **Section rail**: 5 tile-buttons (Friends / Hives / Sparks / Lists / Clubs) — keep order, do not restructure. **Center**: `<ActivityFeed>` with Load more. **Right rail**: `<RequestsCard>` (pending friend requests) + `<MyHivesPanel>` + `<ActiveSparksPanel>`. Tile gradient on rail buttons + alpha brand-yellow on active. |
| 2 | `/friends` | max-w-3xl | Single-column, sticky tab strip | **TWEAKED IA**: 3 tabs *Friends / Pending / Suggested*. Pending tab has sub-segments *Received / Sent*. Friends tab: forum-table with Avatar / @username / Mutual count / Unfriend kebab. Suggested: card-stack with Mutual cluster + Add CTA. + Floating "+ Invite by link" pill in top-right. |
| 3 | `/discover` | max-w-5xl | Sticky 5-tab strip + grid | Tabs: *Books / Sparks / Hives / Lists / Clubs* — keep order. Each tab content is a responsive grid of the appropriate Card component. Search input top of page. |
| 4 | `/sparks` | max-w-5xl | 3 stacked sections | Header + Active sparks (3-col grid OPEN) + Voting sparks (stacked list) + Past sparks (2-col grid CLOSED). + "+ New Spark" brand-pill CTA. Empty state: "No active sparks. Be the first to start one." |
| 5 | `/sparks/[sparkId]` | max-w-3xl | Header + body + entries | Spark prompt header (Comfortaa h1 + status pill + visibility pill + countdown if VOTING) + deadline meta + entries list (forum-table style for VOTING/CLOSED sorted by likes; card-stack for OPEN) + SparkSubmitPanel (composer for non-creators, gated by status) + comments at bottom. |
| 6 | `/sparks/[sparkId]/entry/[entryId]` | max-w-3xl | Single-prose reader | Back link "← Spark" mono + entry title (Comfortaa h1 from `deriveTitle`) + author header (avatar + @username + relTime) + prose body Newsreader + LikeButton + threaded comments (one-level replies). |
| 7 | `/reading-lists` | max-w-5xl | 2 stacked sections | Header + "+ New List" brand-pill + My lists section (3-col grid of `<ListCard>`) + Lists I follow section (3-col grid) + "Discover more lists →" link. Empty states per-section. |
| 8 | `/reading-lists/[listId]` | max-w-5xl | Header + body | `<ListDetailHeader>`: title Comfortaa + visibility pill + tag chips + description + owner card + follower + book counts + `<FollowListButton>` + ⋯ kebab Edit/Delete (owner). Then stats strip. Then `<BookList>` of `<BookRow>` (cover + meta + rating + commentary + isRead toggle) with drag-reorder for owner. "+ Add Book" CTA for owner. |
| 9 | `/clubs` | max-w-5xl | 1 section | Header + "+ New Club" brand-pill + My clubs grid (3-col `<ClubCard>` grid) + "Discover more →" link. Empty state. |
| 10 | `/clubs/[clubId]` | max-w-5xl | Header + 6-panel tab strip | **TWEAKED IA**: tab order is *About / Books / Discussions / Members / Schedule / Settings*. `<ClubHeader>` always visible: name Comfortaa h1 brand-yellow + visibility pill + open-join pill + owner card + member count + smart CTA (Join / Request / Leave / Invite + kebab Settings/Delete). Default tab: members → Discussions; non-members → About. |
| 10a | `/clubs/[clubId]?tab=about` panel | inside detail page | — | About panel: description + rules (`<pre>` whitespace-pre-wrap) + tag chips + currentBook card + founded date. |
| 10b | `/clubs/[clubId]?tab=books` panel | inside detail page | 3 sections | Currently reading single row OR empty state + Up next QUEUE list (dnd-kit reorder for MOD+) + Past reads collapsed `<details>` accordion. "+ Add Book" CTA for MOD+. |
| 10c | `/clubs/[clubId]?tab=discussions` panel | inside detail page | List | Pinned-first sort feed of `<DiscussionCard>` (title Comfortaa + author + relTime + like/reply counts + 📌 pinned indicator). "+ New Discussion" CTA for members. |
| 10d | `/clubs/[clubId]?tab=members` panel | inside detail page | Forum-table | Avatar / @username / role pill (OWNER brand / MOD blue / MEMBER muted) / joined date / ⋯ kebab. Members ordered OWNER → MOD → MEMBER. |
| 10e | `/clubs/[clubId]?tab=schedule` panel | inside detail page | Timeline list | Schedule items ordered by targetDate ASC. Each row: date pill (past/today/future indicator) + chapter range + label + ⋯ kebab MOD+. "+ Add milestone" CTA. |
| 10f | `/clubs/[clubId]?tab=settings` panel (OWNER+MOD) | inside detail page | Stacked sub-sections | Metadata edit + Pending invites panel + Join requests panel + Invite by link + Transfer ownership (OWNER) + Danger zone Delete (OWNER). |
| 11 | `/clubs/[clubId]/discussions/[discussionId]` | max-w-3xl | Single-prose thread | Back link "← Discussions" mono + post body (Comfortaa h1 title + author header + content + LikeButton + Pin toggle MOD+) + Replies list (one-level) + Reply composer (members). |
| 12 | `/u/[username]` (profile) | max-w-5xl | **TWEAKED IA**: 1 header + 6 ordered sections | Sticky header: cover banner + avatar + display name Comfortaa + @username + bio + friendship UI (smart-CTA status pill + mutual cluster) + stats strip (followers/following/books/lists/clubs). Then sections in order: **(1) Lists** (3-col `<ListCard>` row, hidden empty), **(2) Clubs** (3-col `<ClubCard>` row, hidden empty), **(3) Published books** (card grid), **(4) Sparks + Activity feed** (merged single column, sparks above activity events). |
| 13 | `/settings/notifications` | max-w-3xl | 4 grouped sections | Header Comfortaa "Notification preferences" + subtitle. Then 4 panels (Friends / Mentions / Activity on your work / Group invites and requests). Each panel: section header Comfortaa h2 brand-yellow + description muted + divide-y rows. Each row: label + sublabel + shadcn Switch (ON = receiving). Persist immediately. |
| 14 | `/friend-invite/[token]` | max-w-md | Centered card | Auth gate or claim landing. 6 error states (TOKEN_NOT_FOUND / TOKEN_EXPIRED / TOKEN_ALREADY_CLAIMED / SELF_INVITE / BLOCKED / ALREADY_MEMBER) each with lucide icon + Comfortaa heading + brand-pill back CTA. Success redirects out with `?invite_claimed=1`. |
| 15 | `/clubs/[clubId]/invite/[token]` | max-w-md | Centered card | Same shape as #14 but club-flavored. BLOCKED masquerades as TOKEN_NOT_FOUND. ALREADY_MEMBER silent-redirects. |
| 16 | Empty state — `/community` no friends/follows | max-w-5xl | Hero block | Centered illustration + Comfortaa headline "Your feed is quiet for now" + "Find friends" + "Discover hives" brand-pill CTAs. |
| 17 | Empty state — `/reading-lists` no lists | max-w-5xl | Hero block | "Your reading shelves are empty" + "Create your first list" brand-pill. |
| 18 | Empty state — `/clubs` no clubs | max-w-5xl | Hero block | Similar shape. "Start a book club" CTA. |
| 19 | Empty state — `/u/[username]` (own profile, fresh) | max-w-5xl | Inline section empty states | Each profile section shows a muted "No X yet" line with optional CTA where the user is the owner. |
| 20 | Empty state — `/sparks` no active | max-w-5xl | Inline section | "No active sparks. Be the first to start one." + "+ New Spark" brand-pill. |
| 21 | Access denied — `/u/[username]` blocked | max-w-md | Centered card | "This profile is unavailable" + lucide Lock + back CTA. No information leak about block existence. |
| 22 | Notifications bell dropdown (popover, not a route) | width 380px | Floating panel | Triggered from AppNav. Recent notifications list with `renderLabel(n)` per type. MENTION rows show loading spinner on click during deep-link resolution. "Mark all read" link at bottom. Empty state. |

---

## 7. Shared Components Spec (~12 components)

Each gets one HTML mockup at canonical dimensions. Reused inside the page mockups above.

| Component | Purpose | Key elements |
|---|---|---|
| `<SparkCard>` | Spark prompt card on /sparks + /discover | Cover OR placeholder gradient + title Comfortaa + status pill + visibility pill + deadline + entry count + likes |
| `<ListCard>` | Reading list card on /reading-lists + profile + /discover | Title Comfortaa + visibility pill + tag chips first 3 + "+N more" + owner avatar/handle + book count + follower count + currentBook teaser. Liked variant gets 🤍 Auto pill. |
| `<ClubCard>` | Book club card on /clubs + profile + /discover | Name Comfortaa + visibility pill + open-join pill + tag chips + owner avatar + member count + currentBook line "📖 Reading <i>Title</i>" |
| `<ClubHeader>` | Detail page sticky header | Cover banner + name Comfortaa h1 brand-yellow + pills (visibility + open-join) + owner card + member count + smart CTA matrix |
| `<ListDetailHeader>` | Reading list detail page header | Title + visibility pill + tags + description + owner card + counts + follow button + kebab |
| `<ActivityEventRow>` | Single feed event row on /community | Avatar 32px + verb-mapped sentence "@actor [verb] <subject>" + relTime + subject card (book/list/club/hive/spark) on right. Friend events get brand-yellow 3px left border. |
| `<RequestsCard>` | Right-rail pending requests on /community | Card panel + N items each: avatar + @username + Accept/Reject buttons. Empty state |
| `<MyHivesPanel>` + `<ActiveSparksPanel>` | Right-rail context panels | Compact list of joined hives or your active sparks |
| `<NotificationBell>` | AppNav bell + dropdown | Bell icon + unread count badge brand-yellow + dropdown panel with recent items |
| `<InviteClaimedToast>` | Sonner toast styling | Brand-pill background with checkmark + "You and @x are now friends." / "Welcome to <Club>!" |
| `<DiscussionCard>` | Discussion list row | Title Comfortaa + author + relTime + like/reply counts + 📌 pinned indicator |
| `<BookRow>` | Per-book row in reading list detail | Thumb 96px 2:3 + title + author + rating display click-to-edit + commentary excerpt + Show more + isRead toggle owner + ⋯ kebab |
| `<FollowListButton>` | Follow/unfollow CTA on list detail | Brand-pill at rest "Follow" → tile-gradient at active "Following" with hover → "Unfollow" |
| `<VisibilityPicker>` | 3-card radio for create modals | Generic over visibility T. 3 cards Public/Friends/Private + Globe/Users/Lock + active brand-yellow border ring. |

---

## 8. Hard Constraints (recap)

1. **Dark mode only.** No light-mode variants. Cream paper is studio-chapter-editor-only.
2. **Brand-yellow restraint.** Sanctioned 12-place usage: chrome headings + app logo + active nav link + active toolbar tile + active status pill + premium badge + word-goal progress fill + save indicator + + Add CTA + Go to Hive footer + unsaved dot + layer accents. Propose a 13th brand-yellow surface ONLY with explicit rationale.
3. **Pure black banned from chrome.** Darkest legitimate surface = `#262728` (`--canvas-dark-100`).
4. **AppNav stays.** Don't redesign it (separate scope).
5. **No `<a>` inside `<a>`.** Mention rendering inside discussion-row excerpts is intentionally inert text.
6. **Radius scale fixed** per §2.8.
7. **Depth recipes fixed** per §2.9.
8. **Newsreader for prose only** (chapter content, long-form discussion). Comfortaa for headings. Geist for UI. JetBrains Mono for eyebrows + meta + code.
9. **Token additions allowed up to ~8 new categorical accent tokens** with rationale + scoped semantic name. Top candidates:
   - `--club-role-owner/-mod/-member` (currently piggyback on `--status-*`).
   - `--spark-status-open/-voting/-closed` (currently use generic `--status-*`).
   - `--list-visibility-public/-friends/-private` (currently no dedicated accent).
   Other category families are possible. Propose with rationale; we'll merge selectively into `globals.css`.
10. **Alpha tints free** via `oklch(from var(--token) l c h / 0.X)` — no token churn.
11. **Hover lift convention**: tile rows get `translateY(-1px)` + brand-tinted border ring on hover. Forum-table rows do NOT lift (only background flip).
12. **Iconography**: LucideReact icons only. Inline icon sizes: 12px (in pills), 14-16px (in buttons), 20-24px (in larger CTAs).
13. **Mockup must work with real-ish data.** No Lorem Ipsum. Use plausible book titles, usernames, club names, list names. Use timestamps like "2h ago", "Mar 14", "Apr 2, 2026".

---

## 9. Deliverable Expectations

You produce:

1. **22 standalone HTML files** (one per row in §6), each self-contained with inline `<style>` referencing the tokens from §2. Filename convention: `<NN>-<surface>.html` (e.g. `01-community-hub.html`, `10c-clubs-discussions-panel.html`).
2. **`community.css`** — shared stylesheet containing the universal tokens + page-shell + pill convention + forum-table + card-stack + universal hover/focus states. This gets ported back to `app/globals.css` (additive) + `components/` shared CSS during the mechanical port phase.
3. **`shared-components.html`** — single page with one canonical render of each component from §7, side-by-side for review.
4. **`tokens.md`** — list of new tokens you proposed (with rationale) + the rationale doc for any rule you bent.

Iterate freely — Chris is your reviewer in the chat session. Expect 10-15 rounds of polish across surfaces. Reference earlier mockups for cohesion ("the spark detail's countdown ring should match the club detail's deadline display").

When you're done, Chris will export the bundle + open a new engineering thread for the mechanical port.

---

## 10. Don't Disturb (load-bearing engineering)

- Route shapes per §6 table — don't move surfaces or rename routes.
- The TWEAKED IA items (clubs panel order, profile section order, friends tab consolidation) are EXPECTED — design with them.
- Data flow: `getCommunityFeedAction`, `getClubAction`, `getListAction`, etc. are server actions returning fixed shapes. Don't propose richer data than they return.
- Brand-yellow 12-place rule.
- Cream-paper-is-studio-only rule.
- Dark-mode-only.
- AppNav stays.
- Notification bell click-router resolves deep links asynchronously (loading spinner needed).
- `@-mentions` are notifications-only, never feed events.
- Profile bio mentions render as links but don't fire notifications.
