# Community Dashboard Bento Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the just-shipped T1-T4 `/community` page with a 7-panel bento dashboard (hero, pulse, 3 mid-tiles, friends' desks, clubs) per spec `docs/superpowers/specs/2026-06-16-community-dashboard-bento-redesign-design.md`.

**Architecture:** One new aggregator action (`getCommunityDashboardAction`) wrapped in React `cache()` with `safe()` per sub-query (T1 precedent). 8 panel components colocated under `app/[locale]/(app)/community/_components/`. NO DB schema changes. New `/community/feed` route for chronological deep-destination.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM, Tailwind v4, server components + minimal client components, existing chrome tokens (`--canvas-dark-*` / `--brand` / `--sh-card` / `--r-card`).

**Visual fidelity source of truth:** `.superpowers/brainstorm/34275-1781636500/content/bento-v6.html` (hero + pulse) and `.superpowers/brainstorm/34275-1781636500/content/bento-v2.html` (mid-tiles + friends + clubs + empty states). When in doubt about a token, padding, or radius, read those files first.

---

### Task 1: Shared types module

**Files:**
- Create: `lib/actions/community-dashboard.shared.ts`

- [ ] **Step 1: Write the file**

```ts
// lib/actions/community-dashboard.shared.ts
// NOT a 'use server' file — exports types + constants for cross-import.

export type HeroKind =
  | 'NEW_CHAPTER_FROM_FOLLOWED'
  | 'FRIEND_SPARK_WIN'
  | 'FRIEND_NEW_BOOK'
  | 'FRIEND_JOINED_HIVE_WITH_VIEWER'
  | 'TODAYS_SPARK'
  | 'FEATURED_DISCOVERABLE_BOOK';

export type HeroSignal = {
  kind: HeroKind;
  label: string;              // "★ FRESH FROM A FRIEND" etc.
  metaInline: string;         // "2h ago · ♥ 24 · 💬 6"
  headline: string;
  quote: string | null;
  coverUrl: string | null;    // null when kind === 'TODAYS_SPARK' → glyph fallback rendered client-side
  coverAuthor: string | null; // shown in cover footer
  coverTitle: string | null;  // shown in cover header
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string } | null;
};

export type PulseStat = {
  value: number;              // -1 sentinel = render "—" placeholder
  delta: string;              // "↑ 12%" or "↑ 3 today" or "2h since"
  deltaTone: 'green' | 'dim';
  sparkline: number[];        // 7 elements, oldest first; all-zero array on empty
  hint: string | null;        // helper text (empty state); when set num grays out
};

export type PulseStats = {
  words: PulseStat;
  followers: PulseStat;
  reads: PulseStat & { chapterNumber: number | null };
  engagement: PulseStat;
};

export type PillTone = 'brand' | 'mono' | 'green' | 'blue' | 'purple';

export type RowLeading =
  | { kind: 'avatar'; avatarUrl: string | null; fallbackInitial: string }
  | { kind: 'icon'; glyph: string; tone: PillTone }
  | { kind: 'cover-stack'; covers: { coverUrl: string | null; title: string }[] }
  | { kind: 'cover'; coverUrl: string | null; fallbackInitial: string };

export type PanelRow = {
  id: string;
  leading: RowLeading;
  t1: string;                 // may contain **bold** markers parsed client-side
  t2: string;
  trailingPill: { label: string; tone: PillTone } | null;
  href: string;
};

export type MidPanelData = {
  label: string;              // "🐝 HIVES · 3 ACTIVE"
  seeAllHref: string;
  rows: PanelRow[];           // length <= 3
  isEmpty: boolean;           // when true, rows = nudge rows
};

export type FriendsDeskData = {
  label: string;
  seeAllHref: string;
  rows: PanelRow[];           // first page ~4-6 rows
  nextCursor: string | null;
  isEmpty: boolean;
};

export type DashboardFallbacks = {
  todaysSpark: { id: string; prompt: string; wordLimit: number | null; entriesCount: number; deadlineLabel: string } | null;
  trendingHive: { id: string; name: string; memberCount: number } | null;
  votingSpark: { id: string; title: string; entriesCount: number } | null;
  trendingList: { id: string; title: string; covers: { coverUrl: string | null; title: string }[] } | null;
  topClubs: { id: string; name: string; bookTitle: string | null; coverUrl: string | null; memberCount: number }[];
  openHivesCount: number;
  openClubsCount: number;
};

export type CommunityDashboardData = {
  hero: HeroSignal | null;
  pulse: PulseStats;
  hives: MidPanelData;
  sparks: MidPanelData;
  lists: MidPanelData;
  friends: FriendsDeskData;
  clubs: MidPanelData;
  fallbacks: DashboardFallbacks;
};

export const EMPTY_PULSE: PulseStats = {
  words: { value: -1, delta: '', deltaTone: 'dim', sparkline: [0,0,0,0,0,0,0], hint: 'Start a book to begin tracking' },
  followers: { value: 0, delta: '', deltaTone: 'dim', sparkline: [0,0,0,0,0,0,0], hint: 'Publish a chapter to start' },
  reads: { value: -1, delta: '', deltaTone: 'dim', sparkline: [0,0,0,0,0,0,0], hint: 'No published chapter yet', chapterNumber: null },
  engagement: { value: 0, delta: '', deltaTone: 'dim', sparkline: [0,0,0,0,0,0,0], hint: 'Share work to receive feedback' },
};

export const EMPTY_DASHBOARD: CommunityDashboardData = {
  hero: null,
  pulse: EMPTY_PULSE,
  hives:  { label: '🐝 HIVES',  seeAllHref: '/hives',         rows: [], isEmpty: true },
  sparks: { label: '✨ SPARKS', seeAllHref: '/sparks',        rows: [], isEmpty: true },
  lists:  { label: '📚 LISTS',  seeAllHref: '/reading-lists', rows: [], isEmpty: true },
  friends:{ label: 'FRIENDS\' DESKS · CHRONOLOGICAL', seeAllHref: '/community/feed', rows: [], nextCursor: null, isEmpty: true },
  clubs:  { label: '📖 CLUBS',  seeAllHref: '/clubs',         rows: [], isEmpty: true },
  fallbacks: {
    todaysSpark: null, trendingHive: null, votingSpark: null, trendingList: null,
    topClubs: [], openHivesCount: 0, openClubsCount: 0,
  },
};
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/community-dashboard.shared.ts
git commit -m "feat(community-dashboard): T1 shared types module."
```

---

### Task 2: Sparkline component

**Files:**
- Create: `app/[locale]/(app)/community/_components/sparkline.tsx`

- [ ] **Step 1: Write the file**

```tsx
// app/[locale]/(app)/community/_components/sparkline.tsx
// Pure presentational SVG polyline. NOT a client component (no hooks).

type Props = {
  values: number[];           // 7 elements (or any length)
  width?: number;
  height?: number;
  stroke?: string;
};

export function Sparkline({ values, width = 64, height = 28, stroke = 'var(--brand)' }: Props) {
  if (values.length === 0 || values.every((v) => v === 0)) {
    // Render a flat line on empty/zero data
    const y = height / 2;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <line x1={0} y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />
      </svg>
    );
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(app\)/community/_components/sparkline.tsx
git commit -m "feat(community-dashboard): T2 sparkline component."
```

---

### Task 3: Hero signal resolver

**Files:**
- Create: `lib/actions/community-dashboard.helpers.ts`

- [ ] **Step 1: Write the file**

Implementation note: 6 helpers, one per hero kind, each returning `HeroSignal | null`. Priority resolver tries them in order and returns the first non-null. Reuse existing `getCommunityFeedAction` source data shape patterns (social_activity table). For author profile + book joins, follow the `community-hub.actions.ts` precedent — column names: `userProfiles.username / displayName / avatarUrl`, `books.coverUrl / title / userId`, `sparks.creatorId / title / wordLimit / deadline`, `hives.name / ownerId`.

```ts
// lib/actions/community-dashboard.helpers.ts
// NOT a 'use server' file — sync + async helpers for the aggregator.

import { and, desc, eq, gt, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  books, chapters, follows, sparks, sparkEntries, hives, hiveMembers,
  userProfiles, socialActivity, bookLikes, bookComments, chapterReads, binderItems,
} from '@/db/schema';
import type { HeroSignal, PulseStats, PulseStat } from './community-dashboard.shared';

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY  = 24 * MS_HOUR;

function relTime(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < MS_HOUR) return `${Math.max(1, Math.floor(ms / 60000))}m ago`;
  if (ms < MS_DAY)  return `${Math.floor(ms / MS_HOUR)}h ago`;
  return `${Math.floor(ms / MS_DAY)}d ago`;
}

async function followedUserIds(viewerId: string): Promise<string[]> {
  const rows = await db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, viewerId));
  return rows.map((r) => r.id);
}

// --- Kind 1 ---
async function tryNewChapterFromFollowed(viewerId: string): Promise<HeroSignal | null> {
  const ids = await followedUserIds(viewerId);
  if (ids.length === 0) return null;
  const since = new Date(Date.now() - MS_DAY);
  const row = await db
    .select({
      chapterId: chapters.id,
      chapterTitle: binderItems.title,
      bookId: books.id,
      bookTitle: books.title,
      bookCover: books.coverUrl,
      authorUsername: userProfiles.username,
      publishedAt: chapters.publishedAt,
      content: chapters.content,
      likes: sql<number>`(SELECT COUNT(*)::int FROM ${bookLikes} WHERE ${bookLikes.bookId} = ${books.id})`,
      comments: sql<number>`(SELECT COUNT(*)::int FROM ${bookComments} WHERE ${bookComments.bookId} = ${books.id})`,
      chapterIdx: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${chapters} c2 WHERE c2.book_id = ${books.id} AND c2.published_at IS NOT NULL AND c2.published_at <= ${chapters.publishedAt}), 1)`,
    })
    .from(chapters)
    .innerJoin(binderItems, eq(binderItems.id, chapters.binderItemId))
    .innerJoin(books, eq(books.id, chapters.bookId))
    .innerJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(and(
      inArray(books.userId, ids),
      isNotNull(chapters.publishedAt),
      gte(chapters.publishedAt, since),
      inArray(chapters.status, ['REVISED', 'FINAL']),
    ))
    .orderBy(desc(chapters.publishedAt))
    .limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  const quote = firstQuoteFromContent(r.content);
  return {
    kind: 'NEW_CHAPTER_FROM_FOLLOWED',
    label: '★ FRESH FROM A FRIEND',
    metaInline: `${relTime(r.publishedAt!)} · ♥ ${r.likes} · 💬 ${r.comments}`,
    headline: `@${r.authorUsername} just published Chapter ${r.chapterIdx}`,
    quote,
    coverUrl: r.bookCover,
    coverAuthor: `@${r.authorUsername}`,
    coverTitle: r.bookTitle,
    primaryCta: { label: 'Read chapter →', href: `/books/${r.bookId}/read/${r.chapterId}` },
    secondaryCta: { label: 'Open book', href: `/books/${r.bookId}` },
  };
}

function firstQuoteFromContent(content: unknown): string | null {
  // TipTap JSON doc → first non-empty paragraph text, slice 280 chars, wrap in quotes.
  if (!content || typeof content !== 'object') return null;
  const doc = content as { content?: { type: string; content?: { type: string; text?: string }[] }[] };
  for (const node of doc.content ?? []) {
    if (node.type !== 'paragraph') continue;
    const text = (node.content ?? []).map((c) => c.text ?? '').join('').trim();
    if (text.length === 0) continue;
    const sliced = text.length > 280 ? `${text.slice(0, 277)}...` : text;
    return `"${sliced}"`;
  }
  return null;
}

// --- Kind 2: FRIEND_SPARK_WIN ---
async function tryFriendSparkWin(viewerId: string): Promise<HeroSignal | null> {
  const ids = await followedUserIds(viewerId);
  if (ids.length === 0) return null;
  const since = new Date(Date.now() - MS_DAY);
  // Find sparks where winnerEntryId is set + winner entry's author is followed + spark's updated_at recent.
  const row = await db
    .select({
      sparkId: sparks.id,
      sparkTitle: sparks.title,
      entryId: sparks.winnerEntryId,
      authorUsername: userProfiles.username,
      wonAt: sparks.updatedAt,
    })
    .from(sparks)
    .innerJoin(sparkEntries, eq(sparkEntries.id, sparks.winnerEntryId))
    .innerJoin(userProfiles, eq(userProfiles.userId, sparkEntries.userId))
    .where(and(
      isNotNull(sparks.winnerEntryId),
      inArray(sparkEntries.userId, ids),
      gte(sparks.updatedAt, since),
    ))
    .orderBy(desc(sparks.updatedAt))
    .limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  return {
    kind: 'FRIEND_SPARK_WIN',
    label: '★ A FRIEND JUST WON',
    metaInline: relTime(r.wonAt!),
    headline: `@${r.authorUsername} won "${r.sparkTitle}"`,
    quote: null,
    coverUrl: null,
    coverAuthor: `@${r.authorUsername}`,
    coverTitle: r.sparkTitle,
    primaryCta: { label: 'Read entry →', href: `/sparks/${r.sparkId}/entry/${r.entryId}` },
    secondaryCta: { label: 'See entry', href: `/sparks/${r.sparkId}/entry/${r.entryId}` },
  };
}

// --- Kind 3: FRIEND_NEW_BOOK ---
async function tryFriendNewBook(viewerId: string): Promise<HeroSignal | null> {
  const ids = await followedUserIds(viewerId);
  if (ids.length === 0) return null;
  const since = new Date(Date.now() - 7 * MS_DAY);
  const row = await db
    .select({
      bookId: books.id,
      bookTitle: books.title,
      bookCover: books.coverUrl,
      bookSynopsis: books.synopsis,
      authorUsername: userProfiles.username,
      createdAt: books.createdAt,
    })
    .from(books)
    .innerJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(and(
      inArray(books.userId, ids),
      eq(books.visibility, 'PUBLIC'),
      eq(books.discoverable, true),
      gte(books.createdAt, since),
    ))
    .orderBy(desc(books.createdAt))
    .limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  const synopsis = (r.bookSynopsis ?? '').trim();
  const quote = synopsis.length > 0 ? `"${synopsis.length > 280 ? `${synopsis.slice(0, 277)}...` : synopsis}"` : null;
  return {
    kind: 'FRIEND_NEW_BOOK',
    label: '★ A FRIEND HAS A NEW BOOK',
    metaInline: relTime(r.createdAt!),
    headline: `@${r.authorUsername} published "${r.bookTitle}"`,
    quote,
    coverUrl: r.bookCover,
    coverAuthor: `@${r.authorUsername}`,
    coverTitle: r.bookTitle,
    primaryCta: { label: 'Read book →', href: `/books/${r.bookId}` },
    secondaryCta: { label: 'Open book', href: `/books/${r.bookId}` },
  };
}

// --- Kind 4: FRIEND_JOINED_HIVE_WITH_VIEWER ---
async function tryFriendJoinedHive(viewerId: string): Promise<HeroSignal | null> {
  const ids = await followedUserIds(viewerId);
  if (ids.length === 0) return null;
  // Hives viewer is in
  const viewerHiveIdRows = await db.select({ id: hiveMembers.hiveId }).from(hiveMembers).where(eq(hiveMembers.userId, viewerId));
  const viewerHiveIds = viewerHiveIdRows.map((r) => r.id);
  if (viewerHiveIds.length === 0) return null;
  const since = new Date(Date.now() - 2 * MS_DAY);
  const row = await db
    .select({
      hiveId: hives.id,
      hiveName: hives.name,
      authorUsername: userProfiles.username,
      joinedAt: hiveMembers.joinedAt,
    })
    .from(hiveMembers)
    .innerJoin(hives, eq(hives.id, hiveMembers.hiveId))
    .innerJoin(userProfiles, eq(userProfiles.userId, hiveMembers.userId))
    .where(and(
      inArray(hiveMembers.hiveId, viewerHiveIds),
      inArray(hiveMembers.userId, ids),
      gte(hiveMembers.joinedAt, since),
    ))
    .orderBy(desc(hiveMembers.joinedAt))
    .limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  return {
    kind: 'FRIEND_JOINED_HIVE_WITH_VIEWER',
    label: '★ A NEW WRITER IN YOUR HIVE',
    metaInline: relTime(r.joinedAt!),
    headline: `@${r.authorUsername} joined "${r.hiveName}"`,
    quote: null,
    coverUrl: null,
    coverAuthor: `@${r.authorUsername}`,
    coverTitle: r.hiveName,
    primaryCta: { label: 'Visit hive →', href: `/hive/${r.hiveId}` },
    secondaryCta: { label: 'Visit hive', href: `/hive/${r.hiveId}` },
  };
}

// --- Kind 5: TODAYS_SPARK (empty fallback) ---
async function tryTodaysSpark(): Promise<HeroSignal | null> {
  const row = await db
    .select({
      id: sparks.id,
      prompt: sparks.prompt,
      title: sparks.title,
      wordLimit: sparks.wordLimit,
      deadline: sparks.deadline,
      entries: sql<number>`(SELECT COUNT(*)::int FROM ${sparkEntries} WHERE ${sparkEntries.sparkId} = ${sparks.id})`,
    })
    .from(sparks)
    .where(and(eq(sparks.status, 'OPEN'), eq(sparks.visibility, 'PUBLIC')))
    .orderBy(desc(sparks.createdAt))
    .limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  const deadlineLabel = r.deadline
    ? `ends in ${Math.max(1, Math.floor((new Date(r.deadline).getTime() - Date.now()) / MS_HOUR))}h`
    : 'no deadline';
  return {
    kind: 'TODAYS_SPARK',
    label: '★ TODAY\'S SPARK',
    metaInline: `${r.entries} entries · ${deadlineLabel}`,
    headline: `"${r.prompt}"`,
    quote: r.wordLimit ? `${r.wordLimit}-word flash. ${r.entries} writers entered. Add yours before the deadline.` : null,
    coverUrl: null,
    coverAuthor: null,
    coverTitle: r.title,
    primaryCta: { label: 'Write now →', href: `/sparks/new?prompt=${r.id}` },
    secondaryCta: { label: 'See prompt', href: `/sparks/${r.id}` },
  };
}

// --- Kind 6: FEATURED_DISCOVERABLE_BOOK ---
async function tryFeaturedBook(): Promise<HeroSignal | null> {
  const since = new Date(Date.now() - 14 * MS_DAY);
  const row = await db
    .select({
      bookId: books.id,
      bookTitle: books.title,
      bookCover: books.coverUrl,
      bookSynopsis: books.synopsis,
      authorUsername: userProfiles.username,
      createdAt: books.createdAt,
    })
    .from(books)
    .innerJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(and(
      eq(books.visibility, 'PUBLIC'),
      eq(books.discoverable, true),
      gte(books.createdAt, since),
    ))
    .orderBy(desc(books.createdAt))
    .limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  const synopsis = (r.bookSynopsis ?? '').trim();
  const quote = synopsis.length > 0 ? `"${synopsis.length > 280 ? `${synopsis.slice(0, 277)}...` : synopsis}"` : null;
  return {
    kind: 'FEATURED_DISCOVERABLE_BOOK',
    label: '★ FRESH FROM THE COMMUNITY',
    metaInline: relTime(r.createdAt!),
    headline: `Discover "${r.bookTitle}" by @${r.authorUsername}`,
    quote,
    coverUrl: r.bookCover,
    coverAuthor: `@${r.authorUsername}`,
    coverTitle: r.bookTitle,
    primaryCta: { label: 'Read book →', href: `/books/${r.bookId}` },
    secondaryCta: { label: 'Open book', href: `/books/${r.bookId}` },
  };
}

export async function resolveHeroSignal(viewerId: string): Promise<HeroSignal | null> {
  const resolvers = [
    () => tryNewChapterFromFollowed(viewerId),
    () => tryFriendSparkWin(viewerId),
    () => tryFriendNewBook(viewerId),
    () => tryFriendJoinedHive(viewerId),
    () => tryTodaysSpark(),
    () => tryFeaturedBook(),
  ];
  for (const r of resolvers) {
    const result = await r();
    if (result) return result;
  }
  return null;
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/community-dashboard.helpers.ts
git commit -m "feat(community-dashboard): T3 hero signal resolver."
```

---

### Task 4: Pulse stats helper

**Files:**
- Modify: `lib/actions/community-dashboard.helpers.ts` (append)

- [ ] **Step 1: Append the helper**

```ts
// (appended to community-dashboard.helpers.ts)

import type { PulseStats, PulseStat } from './community-dashboard.shared';
import { EMPTY_PULSE } from './community-dashboard.shared';

// Build a 7-element array of daily counts, oldest first.
// Input rows: { day: 'YYYY-MM-DD'; count: number }
function pad7DaySeries(rows: { day: string; count: number }[]): number[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * MS_DAY);
    days.push(d.toISOString().slice(0, 10));
  }
  const map = new Map(rows.map((r) => [r.day, r.count]));
  return days.map((d) => map.get(d) ?? 0);
}

async function pulseWords(viewerId: string): Promise<PulseStat> {
  const rows = await db.execute<{ day: string; count: number }>(sql`
    SELECT to_char(date_trunc('day', ${chapters.updatedAt}), 'YYYY-MM-DD') AS day,
           COALESCE(SUM(${chapters.wordCount}), 0)::int AS count
    FROM ${chapters}
    INNER JOIN ${books} ON ${books.id} = ${chapters.bookId}
    WHERE ${books.userId} = ${viewerId}
      AND ${chapters.updatedAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
    ORDER BY day ASC
  `);
  const series = pad7DaySeries(rows.rows ?? rows);
  const total = series.reduce((a, b) => a + b, 0);
  if (total === 0) return EMPTY_PULSE.words;
  const priorRows = await db.execute<{ s: number }>(sql`
    SELECT COALESCE(SUM(${chapters.wordCount}), 0)::int AS s
    FROM ${chapters}
    INNER JOIN ${books} ON ${books.id} = ${chapters.bookId}
    WHERE ${books.userId} = ${viewerId}
      AND ${chapters.updatedAt} >= NOW() - INTERVAL '14 days'
      AND ${chapters.updatedAt} <  NOW() - INTERVAL '7 days'
  `);
  const prior = (priorRows.rows ?? priorRows)[0]?.s ?? 0;
  const pct = prior > 0 ? Math.round(((total - prior) / prior) * 100) : 100;
  return {
    value: total,
    delta: `↑ ${pct}%`,
    deltaTone: 'green',
    sparkline: series,
    hint: null,
  };
}

async function pulseFollowers(viewerId: string): Promise<PulseStat> {
  const rows = await db.execute<{ day: string; count: number }>(sql`
    SELECT to_char(date_trunc('day', ${follows.createdAt}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM ${follows}
    WHERE ${follows.followeeId} = ${viewerId}
      AND ${follows.createdAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
    ORDER BY day ASC
  `);
  const series = pad7DaySeries(rows.rows ?? rows);
  const total = series.reduce((a, b) => a + b, 0);
  if (total === 0) return EMPTY_PULSE.followers;
  const today = series[6] ?? 0;
  return {
    value: total,
    delta: `↑ ${today} today`,
    deltaTone: 'green',
    sparkline: series,
    hint: null,
  };
}

async function pulseReads(viewerId: string): Promise<PulseStat & { chapterNumber: number | null }> {
  // Find viewer's latest published chapter
  const latest = await db
    .select({
      chapterId: chapters.id,
      publishedAt: chapters.publishedAt,
      bookId: chapters.bookId,
      chapterIdx: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${chapters} c2 WHERE c2.book_id = ${chapters.bookId} AND c2.published_at IS NOT NULL AND c2.published_at <= ${chapters.publishedAt}), 1)`,
    })
    .from(chapters)
    .innerJoin(books, eq(books.id, chapters.bookId))
    .where(and(
      eq(books.userId, viewerId),
      isNotNull(chapters.publishedAt),
      inArray(chapters.status, ['REVISED', 'FINAL']),
    ))
    .orderBy(desc(chapters.publishedAt))
    .limit(1);
  if (latest.length === 0) return { ...EMPTY_PULSE.reads, chapterNumber: null };
  const l = latest[0];
  const readsRows = await db.execute<{ day: string; count: number }>(sql`
    SELECT to_char(date_trunc('day', ${chapterReads.readAt}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM ${chapterReads}
    WHERE ${chapterReads.chapterBinderItemId} = (SELECT binder_item_id FROM chapters WHERE id = ${l.chapterId})
      AND ${chapterReads.readAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
    ORDER BY day ASC
  `);
  const series = pad7DaySeries(readsRows.rows ?? readsRows);
  const total = series.reduce((a, b) => a + b, 0);
  const hours = Math.max(1, Math.floor((Date.now() - new Date(l.publishedAt!).getTime()) / MS_HOUR));
  return {
    value: total,
    delta: `${hours}h since`,
    deltaTone: 'dim',
    sparkline: series,
    hint: null,
    chapterNumber: l.chapterIdx,
  };
}

async function pulseEngagement(viewerId: string): Promise<PulseStat> {
  const likeRows = await db.execute<{ day: string; count: number }>(sql`
    SELECT to_char(date_trunc('day', ${bookLikes.createdAt}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM ${bookLikes}
    INNER JOIN ${books} ON ${books.id} = ${bookLikes.bookId}
    WHERE ${books.userId} = ${viewerId}
      AND ${bookLikes.createdAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
  `);
  const commentRows = await db.execute<{ day: string; count: number }>(sql`
    SELECT to_char(date_trunc('day', ${bookComments.createdAt}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM ${bookComments}
    INNER JOIN ${books} ON ${books.id} = ${bookComments.bookId}
    WHERE ${books.userId} = ${viewerId}
      AND ${bookComments.createdAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
  `);
  const likeMap = new Map((likeRows.rows ?? likeRows).map((r) => [r.day, r.count]));
  const cmtMap  = new Map((commentRows.rows ?? commentRows).map((r) => [r.day, r.count]));
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(new Date(Date.now() - i * MS_DAY).toISOString().slice(0, 10));
  const series = days.map((d) => (likeMap.get(d) ?? 0) + (cmtMap.get(d) ?? 0));
  const total = series.reduce((a, b) => a + b, 0);
  if (total === 0) return EMPTY_PULSE.engagement;
  const today = series[6] ?? 0;
  return {
    value: total,
    delta: `↑ ${today} today`,
    deltaTone: 'green',
    sparkline: series,
    hint: null,
  };
}

export async function getViewerPulseStats(viewerId: string): Promise<PulseStats> {
  const [words, followers, reads, engagement] = await Promise.all([
    pulseWords(viewerId),
    pulseFollowers(viewerId),
    pulseReads(viewerId),
    pulseEngagement(viewerId),
  ]);
  return { words, followers, reads, engagement };
}
```

- [ ] **Step 2: Verify tsc + dev console**

Run: `npx tsc --noEmit` (clean) + `npm run dev` and hit any DB-querying page (verifies the import side-effects don't break).

- [ ] **Step 3: Commit**

```bash
git add lib/actions/community-dashboard.helpers.ts
git commit -m "feat(community-dashboard): T4 viewer pulse stats with 7d sparklines."
```

---

### Task 5: Panel-row projection helpers

**Files:**
- Modify: `lib/actions/community-dashboard.helpers.ts` (append)

The 5 helpers below each return `PanelRow[]` (length <= 3) and an `isEmpty` flag, OR an empty array. Aggregator handles emptiness. Each row uses `RowLeading` shape from `.shared.ts`.

- [ ] **Step 1: Append all 5 helpers**

```ts
// (appended to community-dashboard.helpers.ts)

import type { PanelRow, RowLeading } from './community-dashboard.shared';
import { hiveSubmissions, hiveAnnotations, readingLists, readingListFollows, readingListBooks } from '@/db/schema/hive';
import { bookClubs, bookClubBooks, bookClubMembers, bookClubDiscussionPosts } from '@/db/schema/book-club';
import { socialActivity } from '@/db/schema/social';

const initialFor = (s: string | null): string => (s ?? '?').trim().charAt(0).toUpperCase() || '?';

// --- HIVES ---
export async function getHivesPanelRows(viewerId: string): Promise<PanelRow[]> {
  // Top-3 viewer-relevant signals: pending submissions for review, recent annotations, recent word-goal hits.
  const rows: PanelRow[] = [];
  const viewerHiveIdRows = await db.select({ id: hiveMembers.hiveId }).from(hiveMembers).where(eq(hiveMembers.userId, viewerId));
  const ids = viewerHiveIdRows.map((r) => r.id);
  if (ids.length === 0) return [];

  // Pending submissions where viewer is OWNER/MODERATOR
  const subs = await db
    .select({
      id: hiveSubmissions.id,
      hiveName: hives.name,
      hiveId: hives.id,
      authorUsername: userProfiles.username,
      title: hiveSubmissions.title,
      createdAt: hiveSubmissions.createdAt,
    })
    .from(hiveSubmissions)
    .innerJoin(hives, eq(hives.id, hiveSubmissions.hiveId))
    .innerJoin(userProfiles, eq(userProfiles.userId, hiveSubmissions.userId))
    .innerJoin(hiveMembers, and(
      eq(hiveMembers.hiveId, hives.id),
      eq(hiveMembers.userId, viewerId),
      inArray(hiveMembers.role, ['OWNER', 'MODERATOR']),
    ))
    .where(and(
      inArray(hiveSubmissions.hiveId, ids),
      eq(hiveSubmissions.draftStatus, 'PENDING'),
    ))
    .orderBy(desc(hiveSubmissions.createdAt))
    .limit(3);

  for (const s of subs) {
    rows.push({
      id: `sub:${s.id}`,
      leading: { kind: 'avatar', avatarUrl: null, fallbackInitial: initialFor(s.authorUsername) },
      t1: `@${s.authorUsername} submitted ${s.title}`,
      t2: `${s.hiveName} · ${relTime(s.createdAt)}`,
      trailingPill: { label: 'REVIEW', tone: 'brand' },
      href: `/hive/${s.hiveId}/submissions/${s.id}`,
    });
    if (rows.length === 3) return rows;
  }
  // Backfill with recent annotations
  const annos = await db
    .select({
      id: hiveAnnotations.id,
      hiveId: hives.id,
      hiveName: hives.name,
      authorUsername: userProfiles.username,
      chapterId: hiveAnnotations.chapterId,
      createdAt: hiveAnnotations.createdAt,
    })
    .from(hiveAnnotations)
    .innerJoin(chapters, eq(chapters.id, hiveAnnotations.chapterId))
    .innerJoin(books, eq(books.id, chapters.bookId))
    .innerJoin(hives, eq(hives.bookId, books.id))
    .innerJoin(userProfiles, eq(userProfiles.userId, hiveAnnotations.authorId))
    .where(and(inArray(hives.id, ids)))
    .orderBy(desc(hiveAnnotations.createdAt))
    .limit(3 - rows.length);
  for (const a of annos) {
    rows.push({
      id: `anno:${a.id}`,
      leading: { kind: 'avatar', avatarUrl: null, fallbackInitial: initialFor(a.authorUsername) },
      t1: `@${a.authorUsername} left an annotation`,
      t2: `${a.hiveName} · ${relTime(a.createdAt)}`,
      trailingPill: null,
      href: `/hive/${a.hiveId}/chapters/${a.chapterId}`,
    });
    if (rows.length === 3) return rows;
  }
  return rows;
}

// --- SPARKS ---
export async function getSparksPanelRows(viewerId: string): Promise<PanelRow[]> {
  const rows: PanelRow[] = [];
  // Viewer's sparks with new entries this week
  const yours = await db
    .select({
      id: sparks.id,
      title: sparks.title,
      newEntries: sql<number>`(SELECT COUNT(*)::int FROM ${sparkEntries} WHERE ${sparkEntries.sparkId} = ${sparks.id} AND ${sparkEntries.createdAt} >= NOW() - INTERVAL '7 days')`,
      status: sparks.status,
    })
    .from(sparks)
    .where(eq(sparks.creatorId, viewerId))
    .orderBy(desc(sparks.createdAt))
    .limit(3);
  for (const s of yours) {
    if (s.newEntries === 0) continue;
    rows.push({
      id: `myspark:${s.id}`,
      leading: { kind: 'icon', glyph: '★', tone: 'purple' },
      t1: `Your spark "${s.title}"`,
      t2: `${s.newEntries} new entries · ${s.status === 'VOTING' ? 'voting' : 'open'}`,
      trailingPill: { label: 'YOURS', tone: 'purple' },
      href: `/sparks/${s.id}`,
    });
    if (rows.length === 3) return rows;
  }
  // Sparks ending soon (next 12h)
  const ending = await db
    .select({
      id: sparks.id,
      title: sparks.title,
      deadline: sparks.deadline,
      entries: sql<number>`(SELECT COUNT(*)::int FROM ${sparkEntries} WHERE ${sparkEntries.sparkId} = ${sparks.id})`,
    })
    .from(sparks)
    .where(and(
      eq(sparks.status, 'OPEN'),
      eq(sparks.visibility, 'PUBLIC'),
      isNotNull(sparks.deadline),
      gt(sparks.deadline, new Date()),
      sql`${sparks.deadline} <= NOW() + INTERVAL '12 hours'`,
    ))
    .orderBy(sparks.deadline)
    .limit(3 - rows.length);
  for (const s of ending) {
    const hrs = Math.max(1, Math.floor((new Date(s.deadline!).getTime() - Date.now()) / MS_HOUR));
    rows.push({
      id: `endsoon:${s.id}`,
      leading: { kind: 'icon', glyph: '✨', tone: 'brand' },
      t1: s.title,
      t2: `${s.entries} entries · ends ${hrs}h`,
      trailingPill: { label: `${hrs}H`, tone: 'mono' },
      href: `/sparks/${s.id}`,
    });
    if (rows.length === 3) return rows;
  }
  return rows;
}

// --- LISTS ---
export async function getListsPanelRows(viewerId: string): Promise<PanelRow[]> {
  // Trending lists in viewer's network (followed curators with growing lists).
  const ids = await followedUserIds(viewerId);
  const idsOrNull = ids.length > 0 ? ids : [''];   // sentinel to avoid empty inArray
  const lists = await db
    .select({
      id: readingLists.id,
      title: readingLists.title,
      ownerUsername: userProfiles.username,
      followers7d: sql<number>`(SELECT COUNT(*)::int FROM ${readingListFollows} WHERE ${readingListFollows.listId} = ${readingLists.id} AND ${readingListFollows.createdAt} >= NOW() - INTERVAL '7 days')`,
      covers: sql<{ coverUrl: string | null; title: string }[]>`COALESCE((
        SELECT json_agg(json_build_object('coverUrl', cover_url, 'title', title))
        FROM (
          SELECT cover_url, title
          FROM ${readingListBooks}
          WHERE list_id = ${readingLists.id}
          ORDER BY added_at DESC
          LIMIT 3
        ) sub
      ), '[]'::json)`,
    })
    .from(readingLists)
    .innerJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
    .where(and(
      eq(readingLists.kind, 'CUSTOM'),
      eq(readingLists.visibility, 'PUBLIC'),
      ids.length > 0
        ? inArray(readingLists.userId, ids)
        : sql`1=0`,
    ))
    .orderBy(desc(sql`(SELECT COUNT(*) FROM ${readingListFollows} WHERE ${readingListFollows.listId} = ${readingLists.id} AND ${readingListFollows.createdAt} >= NOW() - INTERVAL '7 days')`))
    .limit(3);
  return lists.filter((l) => l.followers7d > 0).slice(0, 3).map((l) => ({
    id: `list:${l.id}`,
    leading: { kind: 'cover-stack' as const, covers: (l.covers ?? []).slice(0, 3) },
    t1: l.title,
    t2: `@${l.ownerUsername} · +${l.followers7d} followers`,
    trailingPill: null,
    href: `/reading-lists/${l.id}`,
  }));
}

// --- CLUBS ---
export async function getClubsPanelRows(viewerId: string): Promise<PanelRow[]> {
  // Clubs viewer is in, ranked by recent discussion + current book set.
  const memberClubs = await db
    .select({
      id: bookClubs.id,
      name: bookClubs.name,
      currentBookId: bookClubs.currentBookId,
      currentBookTitle: bookClubBooks.title,
      currentBookCover: bookClubBooks.coverUrl,
      newDiscussions7d: sql<number>`(SELECT COUNT(*)::int FROM ${bookClubDiscussionPosts} WHERE ${bookClubDiscussionPosts.clubId} = ${bookClubs.id} AND ${bookClubDiscussionPosts.createdAt} >= NOW() - INTERVAL '7 days')`,
    })
    .from(bookClubs)
    .innerJoin(bookClubMembers, and(
      eq(bookClubMembers.clubId, bookClubs.id),
      eq(bookClubMembers.userId, viewerId),
    ))
    .leftJoin(bookClubBooks, eq(bookClubBooks.id, bookClubs.currentBookId))
    .orderBy(desc(sql`(SELECT MAX(created_at) FROM ${bookClubDiscussionPosts} WHERE ${bookClubDiscussionPosts.clubId} = ${bookClubs.id})`))
    .limit(3);
  return memberClubs.map((c) => ({
    id: `club:${c.id}`,
    leading: {
      kind: 'cover' as const,
      coverUrl: c.currentBookCover,
      fallbackInitial: initialFor(c.name),
    },
    t1: c.name,
    t2: c.currentBookTitle
      ? `Reading ${c.currentBookTitle}${c.newDiscussions7d > 0 ? ` · ${c.newDiscussions7d} new posts` : ''}`
      : 'No current book set',
    trailingPill: c.newDiscussions7d > 0
      ? { label: `${c.newDiscussions7d} NEW`, tone: 'blue' }
      : null,
    href: `/clubs/${c.id}`,
  }));
}

// --- FRIENDS' DESK (chronological river) ---
export async function getFriendsDeskRows(viewerId: string, limit = 6, cursor?: string): Promise<{ rows: PanelRow[]; nextCursor: string | null }> {
  const ids = await followedUserIds(viewerId);
  if (ids.length === 0) return { rows: [], nextCursor: null };

  const cursorClause = cursor ? sql`AND ${socialActivity.createdAt} < ${new Date(cursor)}` : sql``;
  const events = await db
    .select({
      id: socialActivity.id,
      type: socialActivity.type,
      actorId: socialActivity.actorId,
      subjectType: socialActivity.subjectType,
      subjectId: socialActivity.subjectId,
      payload: socialActivity.payload,
      createdAt: socialActivity.createdAt,
      actorUsername: userProfiles.username,
    })
    .from(socialActivity)
    .innerJoin(userProfiles, eq(userProfiles.userId, socialActivity.actorId))
    .where(and(inArray(socialActivity.actorId, ids), cursorClause))
    .orderBy(desc(socialActivity.createdAt))
    .limit(limit + 1);

  const hasMore = events.length > limit;
  const slice = events.slice(0, limit);
  const rows: PanelRow[] = slice.map((e) => {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    let t1 = `@${e.actorUsername} did something`;
    let href = '/community';
    let trailingPill: PanelRow['trailingPill'] = null;
    switch (e.type) {
      case 'chapter_published':
        t1 = `**@${e.actorUsername}** published Chapter ${p.chapterIdx ?? '?'} of *"${p.bookTitle ?? '?'}"*`;
        href = `/books/${p.bookId}/read/${p.chapterId}`;
        trailingPill = { label: '📝 WRITING', tone: 'mono' };
        break;
      case 'book_published':
        t1 = `**@${e.actorUsername}** published *"${p.bookTitle ?? '?'}"*`;
        href = `/books/${p.bookId}`;
        break;
      case 'spark_created':
        t1 = `**@${e.actorUsername}** started a Spark: *"${p.sparkTitle ?? '?'}"*`;
        href = `/sparks/${p.sparkId}`;
        break;
      case 'spark_won':
        t1 = `**@${e.actorUsername}** won *"${p.sparkTitle ?? '?'}"*`;
        href = `/sparks/${p.sparkId}`;
        trailingPill = { label: '★ WON', tone: 'brand' };
        break;
      case 'follow':
        t1 = `**@${e.actorUsername}** followed **@${p.targetUsername ?? '?'}**`;
        href = `/u/${p.targetUsername}`;
        break;
      default:
        t1 = `**@${e.actorUsername}** ${e.type.replace(/_/g, ' ')}`;
    }
    return {
      id: `act:${e.id}`,
      leading: { kind: 'avatar', avatarUrl: null, fallbackInitial: initialFor(e.actorUsername) },
      t1,
      t2: relTime(e.createdAt),
      trailingPill,
      href,
    };
  });
  const nextCursor = hasMore ? slice[slice.length - 1].createdAt.toISOString() : null;
  return { rows, nextCursor };
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/community-dashboard.helpers.ts
git commit -m "feat(community-dashboard): T5 panel-row projection helpers."
```

---

### Task 6: Dashboard fallbacks helper

**Files:**
- Modify: `lib/actions/community-dashboard.helpers.ts` (append)

- [ ] **Step 1: Append**

```ts
// (appended to community-dashboard.helpers.ts)

import type { DashboardFallbacks } from './community-dashboard.shared';

export async function loadDashboardFallbacks(viewerId: string): Promise<DashboardFallbacks> {
  const [
    todaysSparkRow,
    trendingHiveRow,
    votingSparkRow,
    trendingListRow,
    topClubRows,
    openHivesCountRow,
    openClubsCountRow,
  ] = await Promise.all([
    db.select({
      id: sparks.id,
      prompt: sparks.prompt,
      wordLimit: sparks.wordLimit,
      deadline: sparks.deadline,
      entries: sql<number>`(SELECT COUNT(*)::int FROM ${sparkEntries} WHERE ${sparkEntries.sparkId} = ${sparks.id})`,
    }).from(sparks).where(and(eq(sparks.status, 'OPEN'), eq(sparks.visibility, 'PUBLIC'))).orderBy(desc(sparks.createdAt)).limit(1),

    db.select({
      id: hives.id,
      name: hives.name,
      memberCount: hives.memberCount,
    }).from(hives).where(and(eq(hives.visibility, 'PUBLIC'), eq(hives.discoverable, true))).orderBy(desc(hives.lastActivityAt)).limit(1),

    db.select({
      id: sparks.id,
      title: sparks.title,
      entries: sql<number>`(SELECT COUNT(*)::int FROM ${sparkEntries} WHERE ${sparkEntries.sparkId} = ${sparks.id})`,
    }).from(sparks).where(and(eq(sparks.status, 'VOTING'), eq(sparks.visibility, 'PUBLIC'))).orderBy(desc(sparks.updatedAt)).limit(1),

    db.select({
      id: readingLists.id,
      title: readingLists.title,
      covers: sql<{ coverUrl: string | null; title: string }[]>`COALESCE((
        SELECT json_agg(json_build_object('coverUrl', cover_url, 'title', title))
        FROM (
          SELECT cover_url, title FROM ${readingListBooks}
          WHERE list_id = ${readingLists.id}
          ORDER BY added_at DESC LIMIT 3
        ) sub
      ), '[]'::json)`,
    }).from(readingLists).where(and(eq(readingLists.kind, 'CUSTOM'), eq(readingLists.visibility, 'PUBLIC'))).orderBy(desc(readingLists.followerCount)).limit(1),

    db.select({
      id: bookClubs.id,
      name: bookClubs.name,
      bookTitle: bookClubBooks.title,
      coverUrl: bookClubBooks.coverUrl,
      memberCount: sql<number>`(SELECT COUNT(*)::int FROM ${bookClubMembers} WHERE ${bookClubMembers.clubId} = ${bookClubs.id})`,
    }).from(bookClubs).leftJoin(bookClubBooks, eq(bookClubBooks.id, bookClubs.currentBookId)).where(eq(bookClubs.openJoin, true)).orderBy(desc(bookClubs.lastActivityAt)).limit(3),

    db.execute<{ count: number }>(sql`SELECT COUNT(*)::int AS count FROM ${hives} WHERE ${hives.visibility} = 'PUBLIC' AND ${hives.discoverable} = true`),
    db.execute<{ count: number }>(sql`SELECT COUNT(*)::int AS count FROM ${bookClubs} WHERE ${bookClubs.openJoin} = true`),
  ]);

  const ts = todaysSparkRow[0];
  const th = trendingHiveRow[0];
  const vs = votingSparkRow[0];
  const tl = trendingListRow[0];

  return {
    todaysSpark: ts ? {
      id: ts.id, prompt: ts.prompt, wordLimit: ts.wordLimit,
      entriesCount: ts.entries,
      deadlineLabel: ts.deadline ? `${Math.max(1, Math.floor((new Date(ts.deadline).getTime() - Date.now()) / MS_HOUR))}h` : 'open',
    } : null,
    trendingHive: th ?? null,
    votingSpark: vs ? { id: vs.id, title: vs.title, entriesCount: vs.entries } : null,
    trendingList: tl ? { id: tl.id, title: tl.title, covers: tl.covers ?? [] } : null,
    topClubs: topClubRows,
    openHivesCount: ((openHivesCountRow.rows ?? openHivesCountRow)[0]?.count ?? 0) as number,
    openClubsCount: ((openClubsCountRow.rows ?? openClubsCountRow)[0]?.count ?? 0) as number,
  };
}
```

- [ ] **Step 2: Verify tsc + commit**

```bash
npx tsc --noEmit
git add lib/actions/community-dashboard.helpers.ts
git commit -m "feat(community-dashboard): T6 dashboard fallbacks helper."
```

---

### Task 7: Aggregator action

**Files:**
- Create: `lib/actions/community-dashboard.actions.ts`

- [ ] **Step 1: Write the file**

```ts
'use server';

import { cache } from 'react';
import { getOptionalUserId } from '@/lib/auth-helpers';
import {
  resolveHeroSignal,
  getViewerPulseStats,
  getHivesPanelRows,
  getSparksPanelRows,
  getListsPanelRows,
  getClubsPanelRows,
  getFriendsDeskRows,
  loadDashboardFallbacks,
} from './community-dashboard.helpers';
import { EMPTY_DASHBOARD, EMPTY_PULSE } from './community-dashboard.shared';
import type { CommunityDashboardData, PanelRow } from './community-dashboard.shared';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error('[community-dashboard] sub-query failed:', e);
    return fallback;
  }
}

const buildDashboardData = cache(async (viewerId: string): Promise<CommunityDashboardData> => {
  const [hero, pulse, hivesRows, sparksRows, listsRows, friends, clubsRows, fallbacks] = await Promise.all([
    safe(() => resolveHeroSignal(viewerId), null),
    safe(() => getViewerPulseStats(viewerId), EMPTY_PULSE),
    safe(() => getHivesPanelRows(viewerId), [] as PanelRow[]),
    safe(() => getSparksPanelRows(viewerId), [] as PanelRow[]),
    safe(() => getListsPanelRows(viewerId), [] as PanelRow[]),
    safe(() => getFriendsDeskRows(viewerId, 6), { rows: [], nextCursor: null }),
    safe(() => getClubsPanelRows(viewerId), [] as PanelRow[]),
    safe(() => loadDashboardFallbacks(viewerId), EMPTY_DASHBOARD.fallbacks),
  ]);
  return {
    hero,
    pulse,
    hives:  { label: `🐝 HIVES${hivesRows.length > 0 ? ` · ${hivesRows.length} ACTIVE` : ''}`, seeAllHref: '/hives',         rows: hivesRows,  isEmpty: hivesRows.length === 0 },
    sparks: { label: `✨ SPARKS · LIVE NOW`,                                                   seeAllHref: '/sparks',        rows: sparksRows, isEmpty: sparksRows.length === 0 },
    lists:  { label: `📚 LISTS · TRENDING`,                                                    seeAllHref: '/reading-lists', rows: listsRows,  isEmpty: listsRows.length === 0 },
    friends:{ label: `FRIENDS' DESKS · CHRONOLOGICAL`, seeAllHref: '/community/feed', rows: friends.rows, nextCursor: friends.nextCursor, isEmpty: friends.rows.length === 0 },
    clubs:  { label: `📖 CLUBS · YOU'RE IN`,                                                   seeAllHref: '/clubs',         rows: clubsRows,  isEmpty: clubsRows.length === 0 },
    fallbacks,
  };
});

export async function getCommunityDashboardAction(): Promise<CommunityDashboardData> {
  const viewerId = await getOptionalUserId();
  if (!viewerId) return EMPTY_DASHBOARD;
  return buildDashboardData(viewerId);
}

export async function getFriendsDeskNextPageAction(cursor: string): Promise<{ rows: PanelRow[]; nextCursor: string | null }> {
  const viewerId = await getOptionalUserId();
  if (!viewerId) return { rows: [], nextCursor: null };
  return safe(() => getFriendsDeskRows(viewerId, 10, cursor), { rows: [], nextCursor: null });
}
```

- [ ] **Step 2: Verify tsc + commit**

```bash
npx tsc --noEmit
git add lib/actions/community-dashboard.actions.ts
git commit -m "feat(community-dashboard): T7 aggregator action."
```

---

### Task 8: Pulse panel component

**Files:**
- Create: `app/[locale]/(app)/community/_components/pulse-panel.tsx`

Visual fidelity: `bento-v6.html` pulse panel (172px min-height, 12px 14px padding, 2×2 grid, 8px gap; stat tile = 3-row CSS grid with sparkline spanning right, num 30px brand-yellow, delta 11px green Courier mono).

- [ ] **Step 1: Write the file**

```tsx
import type { PulseStats } from '@/lib/actions/community-dashboard.shared';
import { Sparkline } from './sparkline';

type Props = { pulse: PulseStats };

const tileBase: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  borderRadius: 11,
  boxShadow: 'var(--sh-tile)',
  padding: '10px 12px',
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gridTemplateRows: 'auto 1fr auto',
  gridTemplateAreas: '"label spark" "num spark" "num delta"',
  columnGap: 8,
  rowGap: 2,
};

function StatTile({ label, value, delta, sparkline, hint, deltaTone, chapterNumber }: {
  label: string; value: number; delta: string; sparkline: number[]; hint: string | null;
  deltaTone: 'green' | 'dim'; chapterNumber?: number | null;
}) {
  const numDisplay = value === -1
    ? '—'
    : value >= 1000
      ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
      : `${value}`;
  const fullLabel = chapterNumber !== undefined && chapterNumber !== null
    ? `${label} · CH ${chapterNumber}`
    : label;
  return (
    <div style={tileBase}>
      <div style={{
        gridArea: 'label', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono, monospace)',
        fontWeight: 700, lineHeight: 1, alignSelf: 'start',
      }}>{fullLabel}</div>
      <div style={{ gridArea: 'spark', alignSelf: 'center', justifySelf: 'end' }}>
        <Sparkline values={sparkline} width={64} height={28} />
      </div>
      <div style={{
        gridArea: 'num', fontSize: 30, color: hint ? 'var(--canvas-dark-ink-muted)' : 'var(--brand)',
        fontWeight: 700, lineHeight: 1, alignSelf: 'center',
      }}>{numDisplay}</div>
      <div style={{
        gridArea: 'delta', fontSize: hint ? 10 : 11,
        color: hint ? 'var(--canvas-dark-ink-muted)' : (deltaTone === 'green' ? '#4ade80' : 'var(--canvas-dark-ink-muted)'),
        fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
        textAlign: 'right', alignSelf: 'end', lineHeight: 1,
      }}>{hint ?? delta}</div>
    </div>
  );
}

export function PulsePanel({ pulse }: Props) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      borderRadius: 18,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      padding: '12px 14px',
      minHeight: 172,
      display: 'flex',
      flexDirection: 'column',
      gridColumn: 'span 4',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', fontWeight: 700 }}>YOUR PULSE</span>
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontSize: 10,
          fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
          letterSpacing: '0.06em', fontWeight: 700,
          background: 'rgba(255,195,0,0.15)', color: 'var(--brand)',
        }}>7D</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
        <StatTile label="WORDS"           {...pulse.words}     />
        <StatTile label="FOLLOWERS"       {...pulse.followers} />
        <StatTile label="READS"           {...pulse.reads}     />
        <StatTile label="LIKES + COMMENTS" {...pulse.engagement}/>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc + commit**

```bash
npx tsc --noEmit
git add "app/[locale]/(app)/community/_components/pulse-panel.tsx"
git commit -m "feat(community-dashboard): T8 pulse panel with sparklines."
```

---

### Task 9: Mid-tile panel shared component

**Files:**
- Create: `app/[locale]/(app)/community/_components/mid-tile-panel.tsx`

Visual fidelity: `bento-v2.html` mid-tile (264px min-height, panel-head with mono label + brand-yellow "All N →" link, 3 uniform 52px tile rows, empty fallback = nudge rows with brand-yellow border + brand-yellow CTA pill).

- [ ] **Step 1: Write the file**

```tsx
import Link from 'next/link';
import type { PanelRow, RowLeading } from '@/lib/actions/community-dashboard.shared';

type NudgeRow = {
  id: string;
  leading: RowLeading;
  t1: string;
  t2: string;
  cta: { label: string; href: string };
};

type Props = {
  label: string;
  seeAllHref: string;
  seeAllLabel: string;
  rows: PanelRow[];
  emptyNudges?: NudgeRow[];
  locale: string;
  gridColumn?: string;
};

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} style={{ color: 'var(--canvas-dark-ink-strong)' }}>{p}</strong> : <span key={i}>{p}</span>));
}

function Leading({ leading }: { leading: RowLeading }) {
  if (leading.kind === 'avatar') {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: 999,
        background: 'linear-gradient(135deg, #c4b5fd, #7dd3fc)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1a1b1c', fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>{leading.fallbackInitial}</div>
    );
  }
  if (leading.kind === 'icon') {
    const toneBg: Record<string, string> = {
      brand: 'rgba(255,195,0,0.12)', green: 'rgba(74,222,128,0.12)',
      blue: 'rgba(125,211,252,0.12)', purple: 'rgba(196,181,253,0.12)', mono: 'rgba(255,255,255,0.06)',
    };
    const toneColor: Record<string, string> = {
      brand: 'var(--brand)', green: '#4ade80', blue: '#7dd3fc', purple: '#c4b5fd', mono: 'var(--canvas-dark-ink-muted)',
    };
    return (
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: toneBg[leading.tone], color: toneColor[leading.tone],
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
      }}>{leading.glyph}</div>
    );
  }
  if (leading.kind === 'cover-stack') {
    return (
      <div style={{ display: 'flex', flexShrink: 0, width: 54 }}>
        {(leading.covers.slice(0, 3)).map((c, i) => (
          <div key={i} style={{
            width: 28, height: 40, padding: 3,
            background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
            borderRadius: 4, color: '#f0e5d0',
            transform: i === 0 ? 'rotate(-3deg)' : i === 2 ? 'rotate(3deg)' : 'none',
            marginLeft: i === 0 ? 0 : -14,
            fontFamily: 'Georgia, serif', fontSize: 7, lineHeight: 1.1,
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          }}>{(c.title ?? '?').charAt(0)}</div>
        ))}
      </div>
    );
  }
  // single cover
  return (
    <div style={{
      width: 36, height: 52, padding: 4,
      background: leading.coverUrl
        ? `url(${leading.coverUrl}) center / cover`
        : 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
      borderRadius: 6, color: '#f0e5d0',
      fontFamily: 'Georgia, serif', fontSize: 11, lineHeight: 1.15,
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', flexShrink: 0,
    }}>{leading.coverUrl ? '' : leading.fallbackInitial}</div>
  );
}

function Pill({ label, tone }: { label: string; tone: 'brand' | 'mono' | 'green' | 'blue' | 'purple' }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    brand:  { bg: 'var(--brand)', fg: 'var(--brand-ink, #1a1b1c)' },
    mono:   { bg: 'rgba(255,255,255,0.06)', fg: 'var(--canvas-dark-ink-muted)' },
    green:  { bg: 'rgba(74,222,128,0.15)', fg: '#4ade80' },
    blue:   { bg: 'rgba(125,211,252,0.15)', fg: '#7dd3fc' },
    purple: { bg: 'rgba(196,181,253,0.15)', fg: '#c4b5fd' },
  };
  const c = colors[tone];
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 999, fontSize: 10,
      fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
      letterSpacing: '0.06em', fontWeight: 700,
      background: c.bg, color: c.fg, flexShrink: 0,
    }}>{label}</span>
  );
}

function Row({ row, locale }: { row: PanelRow; locale: string }) {
  return (
    <Link href={`/${locale}${row.href}`} style={{
      display: 'flex', gap: 10, alignItems: 'center', minHeight: 52,
      padding: '10px 12px',
      background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
      borderRadius: 12,
      boxShadow: 'var(--sh-tile, 0 4px 12px rgba(0,0,0,0.3))',
      textDecoration: 'none',
    }}>
      <Leading leading={row.leading} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--canvas-dark-ink-strong)', fontWeight: 600, lineHeight: 1.3 }}>{renderBold(row.t1)}</div>
        <div style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', marginTop: 2, lineHeight: 1.3, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.t2}</div>
      </div>
      {row.trailingPill ? <Pill {...row.trailingPill} /> : null}
    </Link>
  );
}

function NudgeRowEl({ nudge, locale }: { nudge: NudgeRow; locale: string }) {
  return (
    <Link href={`/${locale}${nudge.cta.href}`} style={{
      display: 'flex', gap: 10, alignItems: 'center', minHeight: 52,
      padding: '10px 12px',
      background: 'linear-gradient(180deg, rgba(255,195,0,0.06), rgba(255,195,0,0.02))',
      border: '1px solid rgba(255,195,0,0.15)',
      borderRadius: 12, textDecoration: 'none',
    }}>
      <Leading leading={nudge.leading} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--canvas-dark-ink-strong)', fontWeight: 600, lineHeight: 1.3 }}>{nudge.t1}</div>
        <div style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', marginTop: 2, lineHeight: 1.3, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{nudge.t2}</div>
      </div>
      <span style={{
        background: 'var(--brand)', color: 'var(--brand-ink, #1a1b1c)',
        padding: '5px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
      }}>{nudge.cta.label}</span>
    </Link>
  );
}

export function MidTilePanel({ label, seeAllHref, seeAllLabel, rows, emptyNudges, locale, gridColumn }: Props) {
  const isEmpty = rows.length === 0;
  const displayRows = isEmpty ? (emptyNudges ?? []).slice(0, 3) : rows.slice(0, 3);
  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      borderRadius: 18,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      minHeight: 264,
      display: 'flex', flexDirection: 'column',
      gridColumn: gridColumn ?? 'span 4',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 10px' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', fontWeight: 700 }}>{label}</span>
        <Link href={`/${locale}${seeAllHref}`} style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{seeAllLabel} →</Link>
      </div>
      <div style={{ padding: '0 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isEmpty
          ? displayRows.map((n) => <NudgeRowEl key={(n as NudgeRow).id} nudge={n as NudgeRow} locale={locale} />)
          : displayRows.map((r) => <Row key={(r as PanelRow).id} row={r as PanelRow} locale={locale} />)
        }
      </div>
      <div style={{ padding: '8px 18px 14px' }} />
    </div>
  );
}

export type { NudgeRow };
```

- [ ] **Step 2: Verify tsc + commit**

```bash
npx tsc --noEmit
git add "app/[locale]/(app)/community/_components/mid-tile-panel.tsx"
git commit -m "feat(community-dashboard): T9 mid-tile panel shared component."
```

---

### Task 10: Hero panel component

**Files:**
- Create: `app/[locale]/(app)/community/_components/hero-panel.tsx`

Visual fidelity: `bento-v6.html` hero (172px min-height, 16px 20px padding, cover left 104×148 align-center, body right flex-col justify-content:center; label row with brand-yellow label + 12px mid-ink Courier meta; 18px Comfortaa headline; italic Georgia quote line-clamp 2; CTA row with brand-yellow primary + muted secondary).

- [ ] **Step 1: Write the file**

```tsx
import Link from 'next/link';
import type { HeroSignal, DashboardFallbacks } from '@/lib/actions/community-dashboard.shared';

type Props = { hero: HeroSignal | null; fallbacks: DashboardFallbacks; locale: string };

function Cover({ url, title, author }: { url: string | null; title: string | null; author: string | null }) {
  return (
    <div style={{
      width: 104, height: 148, padding: 7,
      background: url ? `url(${url}) center / cover` : 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
      borderRadius: 6,
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      color: '#f0e5d0', flexShrink: 0, alignSelf: 'center',
    }}>
      {!url && title ? <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.15 }}>{title}</div> : <div />}
      {!url && author ? <div style={{ fontSize: 8, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{author}</div> : <div />}
    </div>
  );
}

function GlyphCover() {
  return (
    <div style={{
      width: 104, height: 148, alignSelf: 'center',
      borderRadius: 8, flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(255,195,0,0.18), rgba(255,195,0,0.04))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--brand)', fontSize: 52,
    }}>✨</div>
  );
}

function todaysSparkHero(f: DashboardFallbacks['todaysSpark']): HeroSignal | null {
  if (!f) return null;
  return {
    kind: 'TODAYS_SPARK',
    label: '★ TODAY\'S SPARK',
    metaInline: `${f.entriesCount} entries · ${f.deadlineLabel === 'open' ? 'open' : `ends ${f.deadlineLabel}`}`,
    headline: `"${f.prompt}"`,
    quote: f.wordLimit ? `${f.wordLimit}-word flash. ${f.entriesCount} writers entered. Add yours before the deadline.` : 'Add your entry before the deadline.',
    coverUrl: null,
    coverAuthor: null,
    coverTitle: null,
    primaryCta: { label: 'Write now →', href: `/sparks/new?prompt=${f.id}` },
    secondaryCta: { label: 'See prompt', href: `/sparks/${f.id}` },
  };
}

export function HeroPanel({ hero, fallbacks, locale }: Props) {
  const actual = hero ?? todaysSparkHero(fallbacks.todaysSpark);
  if (!actual) {
    // Final fallback when literally no signal exists
    return (
      <div style={panelStyle}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--canvas-dark-ink-muted)' }}>
          <div style={{ fontSize: 32 }}>🐝</div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nothing fresh right now — check back soon</div>
        </div>
      </div>
    );
  }
  const useGlyph = actual.kind === 'TODAYS_SPARK';
  return (
    <div style={panelStyle}>
      {useGlyph
        ? <GlyphCover />
        : <Cover url={actual.coverUrl} title={actual.coverTitle} author={actual.coverAuthor} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', fontWeight: 700 }}>{actual.label}</span>
          <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, whiteSpace: 'nowrap' }}>{actual.metaInline}</span>
        </div>
        <div style={{ fontSize: 18, color: 'var(--canvas-dark-ink-strong)', fontWeight: 700, lineHeight: 1.28 }}>{actual.headline}</div>
        {actual.quote ? (
          <div style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            color: 'var(--canvas-dark-ink-muted)',
            fontSize: 12.5, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{actual.quote}</div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <Link href={`/${locale}${actual.primaryCta.href}`} style={{
            padding: '7px 14px', borderRadius: 999, fontWeight: 700, fontSize: 12,
            background: 'var(--brand)', color: 'var(--brand-ink, #1a1b1c)', textDecoration: 'none',
          }}>{actual.primaryCta.label}</Link>
          {actual.secondaryCta ? (
            <Link href={`/${locale}${actual.secondaryCta.href}`} style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              background: 'rgba(255,255,255,0.06)', color: 'var(--canvas-dark-ink)', textDecoration: 'none',
            }}>{actual.secondaryCta.label}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 18,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '16px 20px',
  minHeight: 172,
  display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'stretch',
  gridColumn: 'span 8',
};
```

- [ ] **Step 2: Verify tsc + commit**

```bash
npx tsc --noEmit
git add "app/[locale]/(app)/community/_components/hero-panel.tsx"
git commit -m "feat(community-dashboard): T10 hero panel with 6 kinds + Today's Spark fallback."
```

---

### Task 11: Friends desk panel

**Files:**
- Create: `app/[locale]/(app)/community/_components/friends-desk-panel.tsx`

This component is the only one with client-side state — `useTransition` + `useState` for cursor pagination. Reuses `Leading` and `Pill` patterns from mid-tile-panel — copy them in (do NOT export from mid-tile; keep components self-contained for clarity).

- [ ] **Step 1: Write the file**

```tsx
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { FriendsDeskData, PanelRow, RowLeading } from '@/lib/actions/community-dashboard.shared';
import { getFriendsDeskNextPageAction } from '@/lib/actions/community-dashboard.actions';

function Leading({ leading }: { leading: RowLeading }) {
  if (leading.kind === 'avatar') {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: 999,
        background: 'linear-gradient(135deg, #c4b5fd, #7dd3fc)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1a1b1c', fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>{leading.fallbackInitial}</div>
    );
  }
  return null;
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: 'var(--canvas-dark-ink-strong)' }}>{p}</strong>
      : <span key={i}>{p}</span>
  );
}

function Pill({ label, tone }: { label: string; tone: PanelRow['trailingPill'] extends infer T ? T extends { tone: infer X } ? X : never : never }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    brand:  { bg: 'var(--brand)', fg: 'var(--brand-ink, #1a1b1c)' },
    mono:   { bg: 'rgba(255,255,255,0.06)', fg: 'var(--canvas-dark-ink-muted)' },
    green:  { bg: 'rgba(74,222,128,0.15)', fg: '#4ade80' },
    blue:   { bg: 'rgba(125,211,252,0.15)', fg: '#7dd3fc' },
    purple: { bg: 'rgba(196,181,253,0.15)', fg: '#c4b5fd' },
  };
  const c = colors[tone];
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 999, fontSize: 10,
      fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
      letterSpacing: '0.06em', fontWeight: 700,
      background: c.bg, color: c.fg, flexShrink: 0,
    }}>{label}</span>
  );
}

function FriendRow({ row, locale }: { row: PanelRow; locale: string }) {
  return (
    <Link href={`/${locale}${row.href}`} style={{
      padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none',
      background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
      borderRadius: 12, boxShadow: 'var(--sh-tile, 0 4px 12px rgba(0,0,0,0.3))',
    }}>
      <Leading leading={row.leading} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--canvas-dark-ink)', lineHeight: 1.3 }}>{renderBold(row.t1)}</div>
        <div style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', marginTop: 2, lineHeight: 1.3, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{row.t2}</div>
      </div>
      {row.trailingPill ? <Pill {...row.trailingPill} /> : null}
    </Link>
  );
}

export function FriendsDeskPanel({ initial, locale }: { initial: FriendsDeskData; locale: string }) {
  const [rows, setRows] = useState<PanelRow[]>(initial.rows);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [isPending, startTransition] = useTransition();

  const loadOlder = () => {
    if (!cursor || isPending) return;
    startTransition(async () => {
      const next = await getFriendsDeskNextPageAction(cursor);
      setRows((prev) => [...prev, ...next.rows]);
      setCursor(next.nextCursor);
    });
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      borderRadius: 18,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      minHeight: 320, display: 'flex', flexDirection: 'column', gridColumn: 'span 7',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 10px' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', fontWeight: 700 }}>{initial.label}</span>
        <Link href={`/${locale}${initial.seeAllHref}`} style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Full feed →</Link>
      </div>
      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,195,0,0.12)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🐝</div>
          <div style={{ fontSize: 15, color: 'var(--canvas-dark-ink-strong)', fontWeight: 700 }}>Your friends' writing lives here.</div>
          <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13, color: 'var(--canvas-dark-ink-muted)', maxWidth: 340 }}>Follow other writers and you'll see their chapters, sparks, and progress fill in below, chronologically.</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Link href={`/${locale}/discover?tab=writers`} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--brand)', color: 'var(--brand-ink, #1a1b1c)', borderRadius: 999, textDecoration: 'none' }}>Find writers</Link>
            <Link href={`/${locale}/friends`} style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(255,255,255,0.06)', color: 'var(--canvas-dark-ink)', borderRadius: 999, textDecoration: 'none' }}>Invite a friend</Link>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px', flex: 1 }}>
            {rows.map((r) => <FriendRow key={r.id} row={r} locale={locale} />)}
          </div>
          <div style={{ padding: '8px 18px 14px' }}>
            {cursor ? (
              <button onClick={loadOlder} disabled={isPending} style={{
                width: '100%', background: 'rgba(255,255,255,0.04)', color: 'var(--canvas-dark-ink-muted)',
                border: 0, padding: 10, borderRadius: 8, fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{isPending ? 'Loading...' : 'Load older activity'}</button>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All caught up</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc + commit**

```bash
npx tsc --noEmit
git add "app/[locale]/(app)/community/_components/friends-desk-panel.tsx"
git commit -m "feat(community-dashboard): T11 friends desk panel with inline pagination."
```

---

### Task 12: Dashboard grid orchestrator

**Files:**
- Create: `app/[locale]/(app)/community/_components/community-dashboard-grid.tsx`

This component composes the 7 panels, supplies empty-nudge rows derived from `fallbacks`, and handles the page header. Server component (no client hooks).

- [ ] **Step 1: Write the file**

```tsx
import { HeroPanel } from './hero-panel';
import { PulsePanel } from './pulse-panel';
import { MidTilePanel } from './mid-tile-panel';
import { FriendsDeskPanel } from './friends-desk-panel';
import type { CommunityDashboardData } from '@/lib/actions/community-dashboard.shared';
import type { NudgeRow } from './mid-tile-panel';

type Props = { data: CommunityDashboardData; locale: string };

function buildHivesNudges(d: CommunityDashboardData): NudgeRow[] {
  const out: NudgeRow[] = [];
  if (d.fallbacks.openHivesCount > 0) {
    out.push({
      id: 'hive-browse', leading: { kind: 'icon', glyph: '🐝', tone: 'brand' },
      t1: `${d.fallbacks.openHivesCount} open hives looking for writers`,
      t2: 'In your genres', cta: { label: 'Browse', href: '/discover?tab=hives' },
    });
  }
  out.push({
    id: 'hive-create', leading: { kind: 'icon', glyph: '+', tone: 'brand' },
    t1: 'Start your own Hive', t2: 'Invite collaborators to your book',
    cta: { label: 'Create', href: '/studio?createHive=1' },
  });
  if (d.fallbacks.trendingHive) {
    out.push({
      id: 'hive-trending', leading: { kind: 'icon', glyph: '★', tone: 'brand' },
      t1: `${d.fallbacks.trendingHive.name} is active`,
      t2: `${d.fallbacks.trendingHive.memberCount} members · Fantasy worldbuilding`,
      cta: { label: 'Visit', href: `/hive/${d.fallbacks.trendingHive.id}` },
    });
  }
  return out.slice(0, 3);
}

function buildSparksNudges(d: CommunityDashboardData): NudgeRow[] {
  const out: NudgeRow[] = [];
  if (d.fallbacks.todaysSpark) {
    out.push({
      id: 'spark-today', leading: { kind: 'icon', glyph: '✨', tone: 'brand' },
      t1: `Today's prompt: "${d.fallbacks.todaysSpark.prompt.slice(0, 60)}${d.fallbacks.todaysSpark.prompt.length > 60 ? '...' : ''}"`,
      t2: `${d.fallbacks.todaysSpark.wordLimit ?? ''}${d.fallbacks.todaysSpark.wordLimit ? ' words · ' : ''}${d.fallbacks.todaysSpark.entriesCount} entries · ends ${d.fallbacks.todaysSpark.deadlineLabel}`,
      cta: { label: 'Enter', href: `/sparks/${d.fallbacks.todaysSpark.id}` },
    });
  }
  out.push({
    id: 'spark-create', leading: { kind: 'icon', glyph: '+', tone: 'brand' },
    t1: 'Run your own Spark', t2: 'Pick a prompt, set a deadline',
    cta: { label: 'Create', href: '/sparks/new' },
  });
  if (d.fallbacks.votingSpark) {
    out.push({
      id: 'spark-vote', leading: { kind: 'icon', glyph: '⚡', tone: 'brand' },
      t1: `${d.fallbacks.votingSpark.title} voting now`,
      t2: `${d.fallbacks.votingSpark.entriesCount} entries`,
      cta: { label: 'Vote', href: `/sparks/${d.fallbacks.votingSpark.id}` },
    });
  }
  return out.slice(0, 3);
}

function buildListsNudges(d: CommunityDashboardData): NudgeRow[] {
  const out: NudgeRow[] = [];
  if (d.fallbacks.trendingList) {
    out.push({
      id: 'list-trending',
      leading: { kind: 'cover-stack', covers: d.fallbacks.trendingList.covers },
      t1: d.fallbacks.trendingList.title,
      t2: 'Trending with curators in your taste',
      cta: { label: 'Open', href: `/reading-lists/${d.fallbacks.trendingList.id}` },
    });
  }
  out.push({
    id: 'list-create', leading: { kind: 'icon', glyph: '+', tone: 'brand' },
    t1: 'Build your first list', t2: 'Curate books from your reading',
    cta: { label: 'Create', href: '/reading-lists' },
  });
  out.push({
    id: 'list-browse', leading: { kind: 'icon', glyph: '📚', tone: 'brand' },
    t1: 'Discover lists', t2: 'Tuned to what you\'ve liked',
    cta: { label: 'Browse', href: '/discover?tab=lists' },
  });
  return out.slice(0, 3);
}

function buildClubsNudges(d: CommunityDashboardData): NudgeRow[] {
  const out: NudgeRow[] = [];
  for (const c of d.fallbacks.topClubs.slice(0, 2)) {
    out.push({
      id: `club-${c.id}`,
      leading: { kind: 'cover', coverUrl: c.coverUrl, fallbackInitial: (c.name ?? '?').charAt(0).toUpperCase() },
      t1: c.name,
      t2: c.bookTitle ? `Reading ${c.bookTitle} · ${c.memberCount} readers` : `${c.memberCount} readers`,
      cta: { label: 'Join', href: `/clubs/${c.id}` },
    });
  }
  out.push({
    id: 'club-create', leading: { kind: 'icon', glyph: '+', tone: 'brand' },
    t1: 'Start your own club', t2: 'Pick a book, invite readers',
    cta: { label: 'Create', href: '/clubs' },
  });
  return out.slice(0, 3);
}

export function CommunityDashboardGrid({ data, locale }: Props) {
  return (
    <div style={{ maxWidth: 1680, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: 'var(--brand)', fontWeight: 700, fontFamily: 'var(--font-display, Comfortaa, sans-serif)' }}>Community</h1>
          <div style={{ color: 'var(--canvas-dark-ink-muted)', fontSize: 12, marginTop: 3 }}>Your dashboard</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
        <HeroPanel hero={data.hero} fallbacks={data.fallbacks} locale={locale} />
        <PulsePanel pulse={data.pulse} />

        <MidTilePanel
          label={data.hives.label}
          seeAllHref={data.hives.seeAllHref}
          seeAllLabel="All"
          rows={data.hives.rows}
          emptyNudges={data.hives.isEmpty ? buildHivesNudges(data) : undefined}
          locale={locale}
          gridColumn="span 4"
        />
        <MidTilePanel
          label={data.sparks.label}
          seeAllHref={data.sparks.seeAllHref}
          seeAllLabel="All"
          rows={data.sparks.rows}
          emptyNudges={data.sparks.isEmpty ? buildSparksNudges(data) : undefined}
          locale={locale}
          gridColumn="span 4"
        />
        <MidTilePanel
          label={data.lists.label}
          seeAllHref={data.lists.seeAllHref}
          seeAllLabel="All"
          rows={data.lists.rows}
          emptyNudges={data.lists.isEmpty ? buildListsNudges(data) : undefined}
          locale={locale}
          gridColumn="span 4"
        />

        <FriendsDeskPanel initial={data.friends} locale={locale} />

        <MidTilePanel
          label={data.clubs.label}
          seeAllHref={data.clubs.seeAllHref}
          seeAllLabel="All"
          rows={data.clubs.rows}
          emptyNudges={data.clubs.isEmpty ? buildClubsNudges(data) : undefined}
          locale={locale}
          gridColumn="span 5"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc + commit**

```bash
npx tsc --noEmit
git add "app/[locale]/(app)/community/_components/community-dashboard-grid.tsx"
git commit -m "feat(community-dashboard): T12 dashboard grid orchestrator."
```

---

### Task 13: Rewrite page.tsx

**Files:**
- Modify: `app/[locale]/(app)/community/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import { CommunityDashboardGrid } from './_components/community-dashboard-grid';
import { getCommunityDashboardAction } from '@/lib/actions/community-dashboard.actions';

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await getCommunityDashboardAction();
  return <CommunityDashboardGrid data={data} locale={locale} />;
}
```

- [ ] **Step 2: Verify dev server**

Run: `npm run dev` and open `http://localhost:3000/en/community`. Should render the new bento layout. Smoke at this point will reveal data-mapping issues.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(app)/community/page.tsx"
git commit -m "feat(community-dashboard): T13 rewrite /community page to bento layout."
```

---

### Task 14: New /community/feed route

**Files:**
- Create: `app/[locale]/(app)/community/feed/page.tsx`
- Create: `app/[locale]/(app)/community/feed/_components/activity-feed-full.tsx`

- [ ] **Step 1: Write activity-feed-full.tsx**

```tsx
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { PanelRow, RowLeading } from '@/lib/actions/community-dashboard.shared';
import { getFriendsDeskNextPageAction } from '@/lib/actions/community-dashboard.actions';

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--canvas-dark-ink-strong)' }}>{p}</strong> : <span key={i}>{p}</span>);
}

function Avatar({ leading }: { leading: RowLeading }) {
  if (leading.kind !== 'avatar') return null;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 999,
      background: 'linear-gradient(135deg, #c4b5fd, #7dd3fc)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#1a1b1c', fontWeight: 700, fontSize: 14, flexShrink: 0,
    }}>{leading.fallbackInitial}</div>
  );
}

export function ActivityFeedFull({ initialRows, initialCursor, locale }: { initialRows: PanelRow[]; initialCursor: string | null; locale: string }) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(initialCursor);
  const [isPending, startTransition] = useTransition();
  const loadOlder = () => {
    if (!cursor || isPending) return;
    startTransition(async () => {
      const next = await getFriendsDeskNextPageAction(cursor);
      setRows((prev) => [...prev, ...next.rows]);
      setCursor(next.nextCursor);
    });
  };
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <Link href={`/${locale}/community`} style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>← Back to dashboard</Link>
      <h1 style={{ fontSize: 24, margin: '12px 0 18px', color: 'var(--brand)', fontWeight: 700 }}>Friends' Desks</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <Link key={r.id} href={`/${locale}${r.href}`} style={{
            display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none',
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            borderRadius: 12, padding: '12px 14px', boxShadow: 'var(--sh-tile, 0 4px 12px rgba(0,0,0,0.3))',
          }}>
            <Avatar leading={r.leading} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--canvas-dark-ink)', lineHeight: 1.3 }}>{renderBold(r.t1)}</div>
              <div style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', marginTop: 2, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{r.t2}</div>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ padding: '16px 0' }}>
        {cursor ? (
          <button onClick={loadOlder} disabled={isPending} style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', color: 'var(--canvas-dark-ink-muted)',
            border: 0, padding: 12, borderRadius: 10, fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>{isPending ? 'Loading...' : 'Load older activity'}</button>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All caught up</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write page.tsx**

```tsx
import { getFriendsDeskNextPageAction } from '@/lib/actions/community-dashboard.actions';
import { getCommunityDashboardAction } from '@/lib/actions/community-dashboard.actions';
import { ActivityFeedFull } from './_components/activity-feed-full';

export default async function CommunityFeedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await getCommunityDashboardAction();
  return (
    <ActivityFeedFull
      initialRows={data.friends.rows}
      initialCursor={data.friends.nextCursor}
      locale={locale}
    />
  );
}
```

- [ ] **Step 3: Verify dev + commit**

```bash
npx tsc --noEmit
git add "app/[locale]/(app)/community/feed"
git commit -m "feat(community-dashboard): T14 /community/feed route."
```

---

### Task 15: Delete legacy files

**Files:**
- Delete: `app/[locale]/(app)/community/_components/highlights-rail.tsx`
- Delete: `app/[locale]/(app)/community/_components/activity-feed.tsx`
- Delete: `lib/actions/community-hub.actions.ts`
- Delete: `lib/actions/community-hub.shared.ts`

- [ ] **Step 1: Verify no remaining consumers**

```bash
grep -rn "community-hub.actions\|community-hub.shared\|highlights-rail\|getCommunityHubHighlightsAction\|EMPTY_HIGHLIGHTS" app lib --include="*.tsx" --include="*.ts" | grep -v "_components/community-dashboard-grid"
```

Expected output: empty.

- [ ] **Step 2: git rm the 4 files**

```bash
git rm "app/[locale]/(app)/community/_components/highlights-rail.tsx" \
       "app/[locale]/(app)/community/_components/activity-feed.tsx" \
       "lib/actions/community-hub.actions.ts" \
       "lib/actions/community-hub.shared.ts"
```

- [ ] **Step 3: Verify tsc + commit**

```bash
npx tsc --noEmit
git commit -m "chore(community-dashboard): T15 delete superseded T1-T4 files."
```

---

### Task 16: Smoke + AGENTS.md + ship

- [ ] **Step 1: Smoke checklist on `npm run dev`**

Open `http://localhost:3000/en/community` as authed user. Verify:

1. Page renders the 7-panel grid at xl+ widths.
2. Hero panel: cover left + content centered right + CTAs under quote.
3. Pulse panel: 2×2 stat tiles, sparklines render, big numbers brand-yellow.
4. Hives / Sparks / Lists tiles each show ≤3 rows; `All →` link routes to deep destinations.
5. Friends' Desks shows rows + Load older button works.
6. Clubs panel shows clubs or join nudges.
7. As guest (logged out): empty state renders everywhere; Today's Spark hero appears; nudge rows in mid-tiles.
8. `/en/community/feed` renders the full feed with Load older pagination.
9. Below `xl` (resize to 1100px), grid collapses to single column in order Hero → Pulse → Hives → Sparks → Lists → Friends → Clubs.
10. Brand-yellow appears ONLY on: panel labels, see-all links, primary CTAs, pulse stat numbers, hero label, mid-tile nudge CTAs. Nowhere else.

If any check fails, log it as a follow-up commit `fix(community-dashboard): <issue>`.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 883/883 or higher pass.

- [ ] **Step 3: Update AGENTS.md Resume Here**

Edit `AGENTS.md` near the top: replace the "Resume Here" block's commit list + next-step language with the bento redesign shipping summary (16 tasks, locked v6 mockups, what was deleted, smoke passed). Reference the design spec.

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): community dashboard bento redesign shipped."
```

---

## Self-review

**Spec coverage:**
- Page header → T12 grid orchestrator ✓
- Hero kinds 1-6 + priority resolver → T3 ✓
- Pulse 4 stats + sparklines → T4 + T8 ✓
- 3 mid-tiles + nudge fallbacks → T5 + T9 + T12 ✓
- Friends' Desks + Load older → T5 + T11 ✓
- Clubs panel → T5 + T9 + T12 ✓
- Empty states per panel → T8/T9/T11/T12 ✓
- Pagination model (preview tile, deep destination) → T9 link structure + T11/T14 inline pagination ✓
- `/community/feed` route → T14 ✓
- `getCommunityDashboardAction` + `safe()` + `cache()` → T7 ✓
- Discriminated `PanelRow.leading` union → T1 + T9 Leading component ✓
- No DB schema changes → confirmed throughout ✓
- Deletion of T1-T4 files → T15 ✓
- Acceptance criteria 1-10 → covered by T13 smoke + T16 smoke ✓

**Placeholder scan:** None. Every step has runnable code or exact commands.

**Type consistency:** `CommunityDashboardData`, `PanelRow`, `RowLeading`, `HeroSignal`, `PulseStats` shapes defined in T1 are consumed in T7 / T8 / T9 / T10 / T11 / T12 / T14 verbatim.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-16-community-dashboard-bento-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Best for this plan: 16 tasks with clear boundaries, each task a self-contained file write or small set of edits.

**2. Inline Execution** — execute tasks in this session, batch with checkpoints. Faster wall-clock for short tasks but harder to recover from a bad task.

**Which approach?**
