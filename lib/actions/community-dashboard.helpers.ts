// lib/actions/community-dashboard.helpers.ts
// NOT a 'use server' file — sync + async helpers for the aggregator.
//
// Schema reality notes (mirror precedent from community.actions.ts):
// - chapters has NO publishedAt column. "Published" = status IN ('REVISED', 'FINAL')
//   per isChapterReaderVisible() precedent; recency proxy = chapters.updatedAt.
// - books has no publishedAt either; recency = books.createdAt for "new book"
//   semantics (book row creation), books.updatedAt for "published" surface.

import { and, desc, eq, gt, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  books, chapters, follows, sparks, sparkEntries, hives, hiveMembers,
  userProfiles, bookLikes, bookComments, chapterReads,
  hiveSubmissions, hiveAnnotations,
  readingLists, readingListFollows, readingListBooks,
  bookClubs, bookClubBooks, bookClubMembers, bookClubDiscussions,
  socialActivity,
} from '@/db/schema';
import type { DashboardFallbacks, HeroSignal, PanelRow, PulseStat, PulseStats } from './community-dashboard.shared';
import { EMPTY_PULSE } from './community-dashboard.shared';

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

function firstQuoteFromContent(content: unknown): string | null {
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

// --- Kind 1: NEW_CHAPTER_FROM_FOLLOWED ---
// "Published" semantics: chapter.status IN ('REVISED', 'FINAL') AND updatedAt within 24h.
// chapters table has no publishedAt — updatedAt is the recency proxy (matches
// community.actions.ts comment).
async function tryNewChapterFromFollowed(viewerId: string): Promise<HeroSignal | null> {
  const ids = await followedUserIds(viewerId);
  if (ids.length === 0) return null;
  const since = new Date(Date.now() - MS_DAY);
  const row = await db
    .select({
      chapterId: chapters.id,
      bookId: books.id,
      bookTitle: books.title,
      bookCover: books.coverUrl,
      authorUsername: userProfiles.username,
      recencyAt: chapters.updatedAt,
      content: chapters.content,
      likes: sql<number>`(SELECT COUNT(*)::int FROM ${bookLikes} WHERE ${bookLikes.bookId} = ${books.id})`,
      comments: sql<number>`(SELECT COUNT(*)::int FROM ${bookComments} WHERE ${bookComments.bookId} = ${books.id})`,
      chapterIdx: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${chapters} c2 WHERE c2.book_id = ${books.id} AND c2.status IN ('REVISED', 'FINAL') AND c2.updated_at <= ${chapters.updatedAt}), 1)`,
    })
    .from(chapters)
    .innerJoin(books, eq(books.id, chapters.bookId))
    .innerJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(and(
      inArray(books.userId, ids),
      inArray(chapters.status, ['REVISED', 'FINAL']),
      gte(chapters.updatedAt, since),
    ))
    .orderBy(desc(chapters.updatedAt))
    .limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  const quote = firstQuoteFromContent(r.content);
  return {
    kind: 'NEW_CHAPTER_FROM_FOLLOWED',
    label: '★ FRESH FROM A FRIEND',
    metaInline: `${relTime(r.recencyAt)} · ♥ ${r.likes} · 💬 ${r.comments}`,
    headline: `@${r.authorUsername} just published Chapter ${r.chapterIdx}`,
    quote,
    coverUrl: r.bookCover,
    coverAuthor: `@${r.authorUsername}`,
    coverTitle: r.bookTitle,
    primaryCta: { label: 'Read chapter →', href: `/books/${r.bookId}/read/${r.chapterId}` },
    secondaryCta: { label: 'Open book', href: `/books/${r.bookId}` },
  };
}

// --- Kind 2: FRIEND_SPARK_WIN ---
async function tryFriendSparkWin(viewerId: string): Promise<HeroSignal | null> {
  const ids = await followedUserIds(viewerId);
  if (ids.length === 0) return null;
  const since = new Date(Date.now() - MS_DAY);
  // sparks has no updatedAt; use createdAt as recency proxy for "recently won".
  // (Spark wins fire on lazy finalization; createdAt is a loose proxy but the
  // only timestamp available. Acceptable for hero pick — verify with smoke.)
  const row = await db
    .select({
      sparkId: sparks.id,
      sparkTitle: sparks.title,
      entryId: sparks.winnerEntryId,
      authorUsername: userProfiles.username,
      wonAt: sparks.createdAt,
    })
    .from(sparks)
    .innerJoin(sparkEntries, eq(sparkEntries.id, sparks.winnerEntryId))
    .innerJoin(userProfiles, eq(userProfiles.userId, sparkEntries.userId))
    .where(and(
      isNotNull(sparks.winnerEntryId),
      inArray(sparkEntries.userId, ids),
      gte(sparks.createdAt, since),
    ))
    .orderBy(desc(sparks.createdAt))
    .limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  return {
    kind: 'FRIEND_SPARK_WIN',
    label: '★ A FRIEND JUST WON',
    metaInline: relTime(r.wonAt),
    headline: `@${r.authorUsername} won "${r.sparkTitle}"`,
    quote: null,
    coverUrl: null,
    coverAuthor: `@${r.authorUsername}`,
    coverTitle: r.sparkTitle,
    primaryCta: { label: 'Read entry →', href: `/community/sparks/${r.sparkId}/entry/${r.entryId}` },
    secondaryCta: { label: 'See entry', href: `/community/sparks/${r.sparkId}/entry/${r.entryId}` },
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
    metaInline: relTime(r.createdAt),
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
    metaInline: relTime(r.joinedAt),
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
    primaryCta: { label: 'Write now →', href: `/community/sparks/new?prompt=${r.id}` },
    secondaryCta: { label: 'See prompt', href: `/community/sparks/${r.id}` },
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
    metaInline: relTime(r.createdAt),
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

// =====================================================
// T4 — Pulse stats with 7-day daily sparklines
// =====================================================

// Build a 7-element array of daily counts, oldest first.
function pad7DaySeries(rows: { day: string; count: number }[]): number[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * MS_DAY);
    days.push(d.toISOString().slice(0, 10));
  }
  const map = new Map(rows.map((r) => [r.day, r.count]));
  return days.map((d) => map.get(d) ?? 0);
}

// Helper to normalize drizzle's execute return shape across versions.
function executeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) return (result as { rows: T[] }).rows;
  return [];
}

async function pulseWords(viewerId: string): Promise<PulseStat> {
  const rows = executeRows<{ day: string; count: number }>(await db.execute(sql`
    SELECT to_char(date_trunc('day', ${chapters.updatedAt}), 'YYYY-MM-DD') AS day,
           COALESCE(SUM(${chapters.wordCount}), 0)::int AS count
    FROM ${chapters}
    INNER JOIN ${books} ON ${books.id} = ${chapters.bookId}
    WHERE ${books.userId} = ${viewerId}
      AND ${chapters.updatedAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
    ORDER BY day ASC
  `));
  const series = pad7DaySeries(rows);
  const total = series.reduce((a, b) => a + b, 0);
  if (total === 0) return EMPTY_PULSE.words;
  const priorRows = executeRows<{ s: number }>(await db.execute(sql`
    SELECT COALESCE(SUM(${chapters.wordCount}), 0)::int AS s
    FROM ${chapters}
    INNER JOIN ${books} ON ${books.id} = ${chapters.bookId}
    WHERE ${books.userId} = ${viewerId}
      AND ${chapters.updatedAt} >= NOW() - INTERVAL '14 days'
      AND ${chapters.updatedAt} <  NOW() - INTERVAL '7 days'
  `));
  const prior = priorRows[0]?.s ?? 0;
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
  const rows = executeRows<{ day: string; count: number }>(await db.execute(sql`
    SELECT to_char(date_trunc('day', ${follows.createdAt}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM ${follows}
    WHERE ${follows.followeeId} = ${viewerId}
      AND ${follows.createdAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
    ORDER BY day ASC
  `));
  const series = pad7DaySeries(rows);
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
  // Find viewer's latest reader-visible chapter (REVISED or FINAL).
  // Schema reality: no chapters.publishedAt — use updatedAt + status filter.
  const latest = await db
    .select({
      chapterId: chapters.id,
      binderItemId: chapters.binderItemId,
      updatedAt: chapters.updatedAt,
      bookId: chapters.bookId,
      chapterIdx: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${chapters} c2 WHERE c2.book_id = ${chapters.bookId} AND c2.status IN ('REVISED', 'FINAL') AND c2.updated_at <= ${chapters.updatedAt}), 1)`,
    })
    .from(chapters)
    .innerJoin(books, eq(books.id, chapters.bookId))
    .where(and(
      eq(books.userId, viewerId),
      inArray(chapters.status, ['REVISED', 'FINAL']),
    ))
    .orderBy(desc(chapters.updatedAt))
    .limit(1);
  if (latest.length === 0) return { ...EMPTY_PULSE.reads, chapterNumber: null };
  const l = latest[0];
  const readsRows = executeRows<{ day: string; count: number }>(await db.execute(sql`
    SELECT to_char(date_trunc('day', ${chapterReads.readAt}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM ${chapterReads}
    WHERE ${chapterReads.chapterBinderItemId} = ${l.binderItemId}
      AND ${chapterReads.readAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
    ORDER BY day ASC
  `));
  const series = pad7DaySeries(readsRows);
  const total = series.reduce((a, b) => a + b, 0);
  const hours = Math.max(1, Math.floor((Date.now() - new Date(l.updatedAt!).getTime()) / MS_HOUR));
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
  const likeRows = executeRows<{ day: string; count: number }>(await db.execute(sql`
    SELECT to_char(date_trunc('day', ${bookLikes.createdAt}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM ${bookLikes}
    INNER JOIN ${books} ON ${books.id} = ${bookLikes.bookId}
    WHERE ${books.userId} = ${viewerId}
      AND ${bookLikes.createdAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
  `));
  const commentRows = executeRows<{ day: string; count: number }>(await db.execute(sql`
    SELECT to_char(date_trunc('day', ${bookComments.createdAt}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM ${bookComments}
    INNER JOIN ${books} ON ${books.id} = ${bookComments.bookId}
    WHERE ${books.userId} = ${viewerId}
      AND ${bookComments.createdAt} >= NOW() - INTERVAL '7 days'
    GROUP BY day
  `));
  const likeMap = new Map(likeRows.map((r) => [r.day, r.count]));
  const cmtMap  = new Map(commentRows.map((r) => [r.day, r.count]));
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

// =====================================================
// T5 — Panel-row projection helpers
// =====================================================

const initialFor = (s: string | null): string => (s ?? '?').trim().charAt(0).toUpperCase() || '?';

// --- HIVES ---
export async function getHivesPanelRows(viewerId: string): Promise<PanelRow[]> {
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
    .where(inArray(hives.id, ids))
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
      href: `/community/sparks/${s.id}`,
    });
    if (rows.length === 3) return rows;
  }
  // Sparks ending in next 12h
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
      href: `/community/sparks/${s.id}`,
    });
    if (rows.length === 3) return rows;
  }
  return rows;
}

// --- LISTS ---
export async function getListsPanelRows(viewerId: string): Promise<PanelRow[]> {
  const ids = await followedUserIds(viewerId);
  if (ids.length === 0) return [];
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
      inArray(readingLists.userId, ids),
    ))
    .orderBy(desc(sql`(SELECT COUNT(*) FROM ${readingListFollows} WHERE ${readingListFollows.listId} = ${readingLists.id} AND ${readingListFollows.createdAt} >= NOW() - INTERVAL '7 days')`))
    .limit(3);
  return lists.filter((l) => l.followers7d > 0).slice(0, 3).map((l) => ({
    id: `list:${l.id}`,
    leading: { kind: 'cover-stack' as const, covers: (l.covers ?? []).slice(0, 3) },
    t1: l.title,
    t2: `@${l.ownerUsername} · +${l.followers7d} followers`,
    trailingPill: null,
    href: `/community/reading-lists/${l.id}`,
  }));
}

// --- CLUBS ---
// NOTE: Schema reality — there's no `bookClubDiscussionPosts`; the discussions
// table is `bookClubDiscussions` with `clubId` + `createdAt` (same fields needed).
export async function getClubsPanelRows(viewerId: string): Promise<PanelRow[]> {
  const memberClubs = await db
    .select({
      id: bookClubs.id,
      name: bookClubs.name,
      currentBookId: bookClubs.currentBookId,
      currentBookTitle: bookClubBooks.title,
      currentBookCover: bookClubBooks.coverUrl,
      newDiscussions7d: sql<number>`(SELECT COUNT(*)::int FROM ${bookClubDiscussions} WHERE ${bookClubDiscussions.clubId} = ${bookClubs.id} AND ${bookClubDiscussions.createdAt} >= NOW() - INTERVAL '7 days')`,
    })
    .from(bookClubs)
    .innerJoin(bookClubMembers, and(
      eq(bookClubMembers.clubId, bookClubs.id),
      eq(bookClubMembers.userId, viewerId),
    ))
    .leftJoin(bookClubBooks, eq(bookClubBooks.id, bookClubs.currentBookId))
    .orderBy(desc(sql`(SELECT MAX(created_at) FROM ${bookClubDiscussions} WHERE ${bookClubDiscussions.clubId} = ${bookClubs.id})`))
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
    href: `/community/clubs/${c.id}`,
  }));
}

// --- FRIENDS' DESK (chronological river) ---
// NOTE: Schema reality — socialActivityTypeEnum values differ from the plan code:
//   - 'chapter_posted' (not 'chapter_published')
//   - 'spark_won_community' + 'spark_won_creator_choice' (not 'spark_won')
//   - no 'spark_created' event (sparks have no creation event in social_activity)
//   - no 'follow' event
// Switch branches reworked to use the real enum values; unknown/unmapped types
// fall through to a generic "did <type>" rendering.
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
      case 'chapter_posted':
        t1 = `**@${e.actorUsername}** published Chapter ${p.chapterIdx ?? '?'} of *"${p.bookTitle ?? '?'}"*`;
        href = `/books/${p.bookId}/read/${p.chapterId}`;
        trailingPill = { label: '📝 WRITING', tone: 'mono' };
        break;
      case 'book_published':
        t1 = `**@${e.actorUsername}** published *"${p.bookTitle ?? '?'}"*`;
        href = `/books/${p.bookId}`;
        break;
      case 'spark_entry_submitted':
        t1 = `**@${e.actorUsername}** entered *"${p.sparkTitle ?? '?'}"*`;
        href = `/community/sparks/${p.sparkId}`;
        break;
      case 'spark_won_community':
      case 'spark_won_creator_choice':
        t1 = `**@${e.actorUsername}** won *"${p.sparkTitle ?? '?'}"*`;
        href = `/community/sparks/${p.sparkId}`;
        trailingPill = { label: '★ WON', tone: 'brand' };
        break;
      case 'hive_created':
        t1 = `**@${e.actorUsername}** created hive *"${p.hiveName ?? '?'}"*`;
        href = `/hive/${p.hiveId}`;
        break;
      case 'hive_joined':
        t1 = `**@${e.actorUsername}** joined hive *"${p.hiveName ?? '?'}"*`;
        href = `/hive/${p.hiveId}`;
        break;
      case 'reading_list_created':
        t1 = `**@${e.actorUsername}** created list *"${p.listTitle ?? '?'}"*`;
        href = `/community/reading-lists/${p.listId}`;
        break;
      case 'book_club_created':
        t1 = `**@${e.actorUsername}** started book club *"${p.clubName ?? '?'}"*`;
        href = `/community/clubs/${p.clubId}`;
        break;
      default:
        t1 = `**@${e.actorUsername}** ${String(e.type).replace(/_/g, ' ')}`;
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

// =====================================================
// T6 — Dashboard fallbacks (pre-fetched data for empty panels)
// =====================================================

export async function loadDashboardFallbacks(_viewerId: string): Promise<DashboardFallbacks> {
  const [
    todaysSparkRow,
    trendingHiveRow,
    votingSparkRow,
    trendingListRow,
    topClubRows,
    openHivesCountRows,
    openClubsCountRows,
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
    }).from(sparks).where(and(eq(sparks.status, 'VOTING'), eq(sparks.visibility, 'PUBLIC'))).orderBy(desc(sparks.createdAt)).limit(1),

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

    db.execute(sql`SELECT COUNT(*)::int AS count FROM ${hives} WHERE ${hives.visibility} = 'PUBLIC' AND ${hives.discoverable} = true`),
    db.execute(sql`SELECT COUNT(*)::int AS count FROM ${bookClubs} WHERE ${bookClubs.openJoin} = true`),
  ]);

  const ts = todaysSparkRow[0];
  const th = trendingHiveRow[0];
  const vs = votingSparkRow[0];
  const tl = trendingListRow[0];
  const openHivesCount = executeRows<{ count: number }>(openHivesCountRows)[0]?.count ?? 0;
  const openClubsCount = executeRows<{ count: number }>(openClubsCountRows)[0]?.count ?? 0;

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
    openHivesCount,
    openClubsCount,
  };
}
