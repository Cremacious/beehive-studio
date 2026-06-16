// lib/actions/community-dashboard.helpers.ts
// NOT a 'use server' file — sync + async helpers for the aggregator.
//
// Schema reality notes (mirror precedent from community.actions.ts):
// - chapters has NO publishedAt column. "Published" = status IN ('REVISED', 'FINAL')
//   per isChapterReaderVisible() precedent; recency proxy = chapters.updatedAt.
// - books has no publishedAt either; recency = books.createdAt for "new book"
//   semantics (book row creation), books.updatedAt for "published" surface.

import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  books, chapters, follows, sparks, sparkEntries, hives, hiveMembers,
  userProfiles, bookLikes, bookComments,
} from '@/db/schema';
import type { HeroSignal } from './community-dashboard.shared';

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
