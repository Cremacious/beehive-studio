/**
 * Smoke-test data seeder.
 *
 * Creates 1 primary test user + 5 supporting cast, then populates every
 * major surface (books, chapters, friends, follows, sparks, reading lists,
 * hives, clubs, discussions, notifications, activity feed) with enough
 * data that you can sign in as the primary user and see what each page
 * looks like with real content.
 *
 * SAFETY: refuses to run if NODE_ENV=production OR DATABASE_URL host
 * contains 'prod', 'production', 'live'. The wipe-and-reseed is scoped
 * to test-user emails only — never touches your real data.
 *
 * Credentials echoed at the end.
 *
 * Run: npm run seed:smoketest
 */

import 'dotenv/config'
import { db } from '../db'
import {
  users,
  userProfiles,
  userBilling,
  books,
  binderItems,
  chapters,
  friendships,
  follows,
  bookLikes,
  bookmarks,
  bookComments,
  readingProgress,
  sparks,
  sparkEntries,
  sparkVotes,
  readingLists,
  readingListBooks,
  readingListFollows,
  notifications,
  socialActivity,
  hives,
  hiveMembers,
  hiveBuzzPosts,
  hiveWordGoals,
  hiveSubmissions,
  hiveAnnotations,
  hiveSuggestions,
  bookClubs,
  bookClubMembers,
  bookClubBooks,
  bookClubDiscussions,
  bookClubDiscussionReplies,
  bookClubScheduleItems,
} from '../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { auth } from '../lib/auth'

// ─── 1. SAFETY ──────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  console.error('REFUSED: NODE_ENV=production. Aborting smoke-test seed.')
  process.exit(1)
}
const dbUrl = process.env.DATABASE_URL ?? ''
if (/prod|production|live/i.test(dbUrl)) {
  console.error('REFUSED: DATABASE_URL looks production-y. Aborting.')
  process.exit(1)
}
if (!dbUrl) {
  console.error('REFUSED: DATABASE_URL not set.')
  process.exit(1)
}

// ─── 2. CONSTANTS ────────────────────────────────────────────────────────────

const DEFAULT_PASSWORD = 'Test12345!'
const TEST_USERS = [
  {
    email: 'smoketest@beehive.local',
    name: 'Chris Smoketest',
    username: 'smoketest',
    displayName: 'Chris (Smoketest)',
    bio: 'The primary smoke-test account. Premium-tier. Has data on every page.',
    avatarUrl: null,
    isPrimary: true,
  },
  {
    email: 'maya@beehive.local',
    name: 'Maya Rivera',
    username: 'maya',
    displayName: 'Maya Rivera',
    bio: 'Cozy fantasy. Slow plots, warm magic.',
    avatarUrl: 'https://api.dicebear.com/8.x/notionists/svg?seed=maya',
    isPrimary: false,
  },
  {
    email: 'dorian@beehive.local',
    name: 'Dorian Vale',
    username: 'dorian',
    displayName: 'Dorian Vale',
    bio: 'Gothic thriller writer. Tea and shadows.',
    avatarUrl: 'https://api.dicebear.com/8.x/notionists/svg?seed=dorian',
    isPrimary: false,
  },
  {
    email: 'vesper@beehive.local',
    name: 'Vesper Nox',
    username: 'vesper',
    displayName: 'Vesper Nox',
    bio: 'Sci-fi novellas. Lots of moons.',
    avatarUrl: 'https://api.dicebear.com/8.x/notionists/svg?seed=vesper',
    isPrimary: false,
  },
  {
    email: 'june@beehive.local',
    name: 'June Hale',
    username: 'june',
    displayName: 'June Hale',
    bio: 'Literary fiction. Quiet endings.',
    avatarUrl: 'https://api.dicebear.com/8.x/notionists/svg?seed=june',
    isPrimary: false,
  },
  {
    email: 'atlas@beehive.local',
    name: 'Atlas Park',
    username: 'atlas',
    displayName: 'Atlas Park',
    bio: 'Worldbuilding nerd. Hive-curious.',
    avatarUrl: 'https://api.dicebear.com/8.x/notionists/svg?seed=atlas',
    isPrimary: false,
  },
] as const

const TEST_EMAILS = TEST_USERS.map((u) => u.email)

// ─── 3. HELPERS ─────────────────────────────────────────────────────────────

function prose(...paras: string[]) {
  return {
    type: 'doc',
    content: paras.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  }
}

function plainText(...lines: string[]) {
  return { type: 'doc', content: lines.map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] })) }
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400_000)
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 3600_000)
}

// ─── 4. WIPE ────────────────────────────────────────────────────────────────

async function wipe() {
  console.log('→ Wiping prior smoke-test data…')
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, [...TEST_EMAILS]))
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) {
    console.log('  (nothing to wipe)')
    return
  }
  console.log(`  Found ${ids.length} prior test users — deleting…`)
  // Cascade-delete via users (FKs are ON DELETE CASCADE for most owned tables).
  await db.delete(users).where(inArray(users.id, ids))
  console.log(`  ✓ wiped ${ids.length} users + cascaded data`)
}

// ─── 5. USERS + PROFILES + BILLING ──────────────────────────────────────────

type SeededUser = {
  id: string
  email: string
  username: string
  displayName: string
  isPrimary: boolean
}

async function seedUsers(): Promise<Record<string, SeededUser>> {
  console.log('→ Seeding users…')
  const out: Record<string, SeededUser> = {}
  for (const u of TEST_USERS) {
    const result = await auth.api.signUpEmail({
      body: { email: u.email, password: DEFAULT_PASSWORD, name: u.name },
    })
    const userId = result.user.id
    await db.insert(userProfiles).values({
      userId,
      username: u.username,
      displayName: u.displayName,
      bio: u.bio,
      avatarUrl: u.avatarUrl,
      onboardingComplete: true,
    })
    if (u.isPrimary) {
      await db.insert(userBilling).values({
        userId,
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      })
    }
    out[u.username] = {
      id: userId,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      isPrimary: u.isPrimary,
    }
    console.log(`  ✓ ${u.username} (${u.email})`)
  }
  return out
}

// ─── 6. FRIENDSHIPS + FOLLOWS ────────────────────────────────────────────────

async function seedSocialGraph(u: Record<string, SeededUser>) {
  console.log('→ Seeding friendships + follows…')
  const now = new Date()
  // 3 accepted friendships
  await db.insert(friendships).values([
    {
      requesterId: u.smoketest.id,
      recipientId: u.maya.id,
      status: 'ACCEPTED',
      acceptedAt: daysAgo(20),
    },
    {
      requesterId: u.dorian.id,
      recipientId: u.smoketest.id,
      status: 'ACCEPTED',
      acceptedAt: daysAgo(14),
    },
    {
      requesterId: u.smoketest.id,
      recipientId: u.vesper.id,
      status: 'ACCEPTED',
      acceptedAt: daysAgo(7),
    },
    // 1 pending incoming (june → smoketest)
    {
      requesterId: u.june.id,
      recipientId: u.smoketest.id,
      status: 'PENDING',
    },
    // 1 pending outgoing (smoketest → atlas)
    {
      requesterId: u.smoketest.id,
      recipientId: u.atlas.id,
      status: 'PENDING',
    },
  ])

  // Follows: primary follows all 5; 3 follow back
  const followRows = [
    ['smoketest', 'maya'],
    ['smoketest', 'dorian'],
    ['smoketest', 'vesper'],
    ['smoketest', 'june'],
    ['smoketest', 'atlas'],
    ['maya', 'smoketest'],
    ['dorian', 'smoketest'],
    ['vesper', 'smoketest'],
  ]
  await db.insert(follows).values(
    followRows.map(([follower, followee]) => ({
      followerId: u[follower].id,
      followeeId: u[followee].id,
      createdAt: now,
    })),
  )
  console.log(`  ✓ 5 friendships (3 ACCEPTED, 2 PENDING), 8 follow rows`)
}

// ─── 7. BOOKS + CHAPTERS ────────────────────────────────────────────────────

type SeededBook = {
  id: string
  binderItemIds: string[] // chapter binder item ids in order
  chapterIds: string[]
}

async function seedBooks(u: Record<string, SeededUser>): Promise<Record<string, SeededBook>> {
  console.log('→ Seeding books + chapters…')
  const out: Record<string, SeededBook> = {}

  async function makeBook(opts: {
    key: string
    userId: string
    title: string
    description: string
    genre?: string
    visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
    discoverable?: boolean
    status?: 'DRAFT' | 'PUBLISHED' | 'STANDALONE_HIVE_SHADOW'
    seriesName?: string
    seriesNumber?: number
    chapters: { title: string; content: ReturnType<typeof prose>; status: 'FIRST_DRAFT' | 'REVISED' | 'FINAL' }[]
    coverUrl?: string
  }) {
    const bookId = createId()
    await db.insert(books).values({
      id: bookId,
      userId: opts.userId,
      title: opts.title,
      synopsis: opts.description,
      genre: opts.genre ?? null,
      visibility: opts.visibility,
      discoverable: opts.discoverable ?? (opts.visibility === 'PUBLIC'),
      status: opts.status ?? 'DRAFT',
      seriesName: opts.seriesName ?? null,
      seriesNumber: opts.seriesNumber ?? null,
      coverUrl: opts.coverUrl ?? null,
    })
    const binderItemIds: string[] = []
    const chapterIds: string[] = []
    for (let i = 0; i < opts.chapters.length; i++) {
      const ch = opts.chapters[i]
      const binderItemId = createId()
      await db.insert(binderItems).values({
        id: binderItemId,
        bookId,
        type: 'chapter',
        title: ch.title,
        parentId: null,
        order: i,
        authorId: opts.userId,
        lastEditedBy: opts.userId,
      })
      const chapterId = createId()
      const wordCount = ch.content.content.reduce(
        (sum, p: any) => sum + (p.content?.[0]?.text?.split(/\s+/).length ?? 0),
        0,
      )
      await db.insert(chapters).values({
        id: chapterId,
        bookId,
        binderItemId,
        content: ch.content,
        wordCount,
        status: ch.status,
        authorUserId: opts.userId,
      })
      binderItemIds.push(binderItemId)
      chapterIds.push(chapterId)
    }
    out[opts.key] = { id: bookId, binderItemIds, chapterIds }
  }

  // Primary's 3 books
  await makeBook({
    key: 'primaryPublic',
    userId: u.smoketest.id,
    title: 'The Honeyed Path',
    description:
      'A traveling beekeeper learns that the bees of an old forest have been carrying messages between long-lost friends.',
    genre: 'Cozy Fantasy',
    visibility: 'PUBLIC',
    discoverable: true,
    status: 'PUBLISHED',
    seriesName: 'The Hive Chronicles',
    seriesNumber: 1,
    chapters: [
      { title: 'The First Swarm', content: prose('The cottage smelled of beeswax and rain.', 'Elena had been a beekeeper for thirty-two years, and never once had a single bee surprised her — until this morning.'), status: 'FINAL' },
      { title: 'A Letter in the Comb', content: prose('Sealed inside the seventh frame was a folded scrap of parchment, no larger than a thumbnail.', 'In neat, looping script: "If you found this, then you are the one I have been searching for."'), status: 'FINAL' },
      { title: 'The Apiarist of Marin', content: prose('Word travels strangely in the valley.', 'By Tuesday, a stranger in a long brown coat had walked seven miles to her gate.'), status: 'REVISED' },
      { title: 'The Cartographer\'s Garden', content: prose('The map was made of pollen.', 'It bloomed beneath her fingertips when she traced the rivers.'), status: 'REVISED' },
      { title: 'What the Queens Remember', content: prose('Every queen remembers her mother.', 'Elena had not yet learned that this is true of beekeepers as well.'), status: 'FIRST_DRAFT' },
    ],
  })
  await makeBook({
    key: 'primaryFriends',
    userId: u.smoketest.id,
    title: 'Notes from the Backyard Hive',
    description: 'A friends-only journal of beekeeping observations.',
    genre: 'Memoir',
    visibility: 'FRIENDS',
    discoverable: false,
    status: 'DRAFT',
    chapters: [
      { title: 'Spring', content: prose('Hive check #1. Queen present. Brood pattern strong.'), status: 'FIRST_DRAFT' },
      { title: 'Summer', content: prose('Harvest weighed in at 47 pounds. A good year.'), status: 'FIRST_DRAFT' },
    ],
  })
  await makeBook({
    key: 'primaryDraft',
    userId: u.smoketest.id,
    title: 'Untitled (in-progress)',
    description: 'Working title — figure out the plot first.',
    visibility: 'PRIVATE',
    discoverable: false,
    status: 'DRAFT',
    chapters: [
      { title: 'Chapter 1', content: prose('Placeholder paragraph. To be replaced.'), status: 'IDEA' as any },
    ],
  })

  // Supporting cast: 1 published book each, some in series
  await makeBook({
    key: 'mayaBook',
    userId: u.maya.id,
    title: 'The Lantern Garden',
    description: 'A retired gardener tends a glass conservatory where every plant remembers its first owner.',
    genre: 'Cozy Fantasy',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    chapters: [{ title: 'Opening', content: prose('She wound the brass key, and the lantern bloomed.'), status: 'FINAL' }],
  })
  await makeBook({
    key: 'dorianBook',
    userId: u.dorian.id,
    title: 'The House Without Mirrors',
    description: 'Three sisters, one staircase, one rule.',
    genre: 'Gothic Thriller',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    chapters: [{ title: 'Arrival', content: prose('The driveway had been raked. That was the first wrong thing.'), status: 'FINAL' }],
  })
  await makeBook({
    key: 'vesperBook',
    userId: u.vesper.id,
    title: 'Sleep in the Long Shadow',
    description: 'A generation ship\'s gardener wakes up forty years early.',
    genre: 'Science Fiction',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    seriesName: 'The Hive Chronicles',
    seriesNumber: 2,
    chapters: [{ title: 'Wake', content: prose('The hibernation tank exhaled her into the cold.'), status: 'FINAL' }],
  })
  await makeBook({
    key: 'juneBook',
    userId: u.june.id,
    title: 'The Quiet Hours',
    description: 'A series of vignettes about a small bookshop on a quiet street.',
    genre: 'Literary Fiction',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    chapters: [{ title: 'Tuesday', content: prose('On Tuesday, no one came in until almost noon.'), status: 'FINAL' }],
  })
  await makeBook({
    key: 'atlasBook',
    userId: u.atlas.id,
    title: 'The Cartographer\'s Atlas',
    description: 'Worldbuilding notes from an imaginary kingdom.',
    genre: 'Fantasy',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    chapters: [{ title: 'Foreword', content: prose('Every map is a guess.'), status: 'FINAL' }],
  })

  console.log(`  ✓ ${Object.keys(out).length} books with chapters`)
  return out
}

// ─── 8. SOCIAL (likes, comments, bookmarks, reading progress) ────────────────

async function seedSocial(u: Record<string, SeededUser>, b: Record<string, SeededBook>) {
  console.log('→ Seeding likes / comments / bookmarks / reads…')
  // Likes on the primary's PUBLIC book
  await db.insert(bookLikes).values(
    [u.maya, u.dorian, u.vesper, u.june, u.atlas].map((user) => ({
      userId: user.id,
      bookId: b.primaryPublic.id,
      createdAt: daysAgo(Math.floor(Math.random() * 10) + 1),
    })),
  )
  // Comments on the primary's PUBLIC book
  await db.insert(bookComments).values([
    { id: createId(), bookId: b.primaryPublic.id, userId: u.maya.id, content: 'Loved chapter 2 — that parchment line gave me chills.' },
    { id: createId(), bookId: b.primaryPublic.id, userId: u.dorian.id, content: 'The atmosphere is so warm. Subscribed.' },
    { id: createId(), bookId: b.primaryPublic.id, userId: u.vesper.id, content: 'Bee POV when?' },
  ])
  // Bookmarks (primary bookmarks 2 friends' books)
  await db.insert(bookmarks).values([
    { userId: u.smoketest.id, bookId: b.mayaBook.id },
    { userId: u.smoketest.id, bookId: b.juneBook.id },
  ])
  // Reading progress (primary reading Maya's book)
  await db.insert(readingProgress).values({
    userId: u.smoketest.id,
    bookId: b.mayaBook.id,
    chapterId: b.mayaBook.chapterIds[0],
  })
  console.log('  ✓ likes + comments + bookmarks + reading progress')
}

// ─── 9. SPARKS ───────────────────────────────────────────────────────────────

async function seedSparks(u: Record<string, SeededUser>) {
  console.log('→ Seeding sparks…')
  const sparkRows = [
    {
      key: 'open1',
      title: 'Write a 150-word scene about a key that opens nothing.',
      status: 'OPEN' as const,
      creator: u.maya.id,
      daysAgo: 2,
    },
    {
      key: 'open2',
      title: 'A character meets their younger self at a bus stop. No dialogue.',
      status: 'OPEN' as const,
      creator: u.dorian.id,
      daysAgo: 1,
    },
    {
      key: 'voting',
      title: 'The last bee in the garden has a story to tell.',
      status: 'VOTING' as const,
      creator: u.smoketest.id,
      daysAgo: 5,
    },
    {
      key: 'closed',
      title: 'A letter that was never sent.',
      status: 'CLOSED' as const,
      creator: u.vesper.id,
      daysAgo: 30,
    },
  ]
  const sparkIds: Record<string, string> = {}
  for (const s of sparkRows) {
    const id = createId()
    sparkIds[s.key] = id
    const deadline = s.status === 'OPEN' ? new Date(Date.now() + 3 * 86400_000) : daysAgo(s.daysAgo - 3)
    const votingEndsAt = s.status === 'OPEN' ? null : daysAgo(s.daysAgo - 5)
    await db.insert(sparks).values({
      id,
      creatorId: s.creator,
      title: s.title,
      deadline,
      visibility: 'PUBLIC',
      discoverable: true,
      status: s.status,
      votingEndsAt,
      wordLimit: 200,
      createdAt: daysAgo(s.daysAgo),
    })
  }

  // Entries for the VOTING spark (3 from supporting cast)
  const votingEntries = [
    { author: u.maya.id, title: 'Hum', content: 'She landed on the marigold and the world held its breath.' },
    { author: u.dorian.id, title: 'The Last Witness', content: 'Everything I have seen, I have hummed into the comb.' },
    { author: u.june.id, title: null as string | null, content: 'Listen carefully. The garden is empty now, but the air still remembers.' },
  ]
  const votingEntryIds: string[] = []
  for (const e of votingEntries) {
    const id = createId()
    votingEntryIds.push(id)
    await db.insert(sparkEntries).values({
      id,
      sparkId: sparkIds.voting,
      userId: e.author,
      title: e.title,
      content: e.content,
      wordCount: e.content.split(/\s+/).length,
      likeCount: Math.floor(Math.random() * 4),
    })
  }
  // Some votes from the smoketest user on the voting spark
  await db.insert(sparkVotes).values([
    { entryId: votingEntryIds[0], userId: u.smoketest.id },
    { entryId: votingEntryIds[1], userId: u.smoketest.id },
  ])
  // Update vote counts
  await db.update(sparkEntries).set({ likeCount: 3 }).where(eq(sparkEntries.id, votingEntryIds[0]))
  await db.update(sparkEntries).set({ likeCount: 1 }).where(eq(sparkEntries.id, votingEntryIds[1]))

  // 1 entry + winner for the CLOSED spark
  const winnerEntryId = createId()
  await db.insert(sparkEntries).values({
    id: winnerEntryId,
    sparkId: sparkIds.closed,
    userId: u.smoketest.id,
    title: 'Postmark Missing',
    content: 'The envelope sat on my desk for six years before I forgave him.',
    wordCount: 14,
    likeCount: 8,
  })
  await db
    .update(sparks)
    .set({ winnerEntryId, creatorChoiceEntryId: winnerEntryId })
    .where(eq(sparks.id, sparkIds.closed))

  console.log(`  ✓ ${sparkRows.length} sparks (1 winner = smoketest)`)
  return { sparkIds, winnerEntryId }
}

// ─── 10. READING LISTS ───────────────────────────────────────────────────────

async function seedReadingLists(u: Record<string, SeededUser>, b: Record<string, SeededBook>) {
  console.log('→ Seeding reading lists…')
  // Primary's "Cozy fantasy" list (PUBLIC + discoverable)
  const list1 = createId()
  await db.insert(readingLists).values({
    id: list1,
    userId: u.smoketest.id,
    kind: 'CUSTOM',
    title: 'Cozy fantasy for rainy days',
    description: 'Slow books with warm magic.',
    tags: ['cozy', 'fantasy', 'rainyday'],
    visibility: 'PUBLIC',
    discoverable: true,
    bookCount: 2,
    followerCount: 1,
  })
  await db.insert(readingListBooks).values([
    { id: createId(), listId: list1, bookId: b.mayaBook.id, title: 'The Lantern Garden', author: 'Maya Rivera', order: 0, isRead: true, rating: 5, commentary: 'Re-read every spring.' },
    { id: createId(), listId: list1, bookId: b.juneBook.id, title: 'The Quiet Hours', author: 'June Hale', order: 1, isRead: false, rating: null, commentary: null },
  ])

  // Primary's friends-only "Currently reading"
  const list2 = createId()
  await db.insert(readingLists).values({
    id: list2,
    userId: u.smoketest.id,
    kind: 'CUSTOM',
    title: 'Currently reading',
    description: null,
    tags: [],
    visibility: 'FRIENDS',
    discoverable: false,
    bookCount: 1,
  })
  await db.insert(readingListBooks).values({
    id: createId(),
    listId: list2,
    bookId: b.dorianBook.id,
    title: 'The House Without Mirrors',
    author: 'Dorian Vale',
    order: 0,
    isRead: false,
  })

  // Primary's auto-Liked list (kind=LIKED, never materializes rows)
  await db.insert(readingLists).values({
    id: createId(),
    userId: u.smoketest.id,
    kind: 'LIKED',
    title: 'Liked',
    description: null,
    tags: [],
    visibility: 'PRIVATE',
    discoverable: false,
    bookCount: 0,
  })

  // Maya owns a list the primary follows
  const mayaList = createId()
  await db.insert(readingLists).values({
    id: mayaList,
    userId: u.maya.id,
    kind: 'CUSTOM',
    title: 'Best of the indie sci-fi crop',
    description: null,
    tags: ['sci-fi', 'indie'],
    visibility: 'PUBLIC',
    discoverable: true,
    bookCount: 1,
    followerCount: 1,
  })
  await db.insert(readingListBooks).values({
    id: createId(),
    listId: mayaList,
    bookId: b.vesperBook.id,
    title: 'Sleep in the Long Shadow',
    author: 'Vesper Nox',
    order: 0,
    isRead: true,
    rating: 4,
  })
  await db.insert(readingListFollows).values({
    listId: mayaList,
    userId: u.smoketest.id,
  })
  console.log('  ✓ 3 primary lists (custom × 2 + Liked) + 1 followed list')
  return { primaryList: list1 }
}

// ─── 11. HIVES ───────────────────────────────────────────────────────────────

async function seedHives(u: Record<string, SeededUser>, b: Record<string, SeededBook>) {
  console.log('→ Seeding hives…')
  // Hive 1: primary owns, linked to their PUBLIC book
  const hive1 = createId()
  await db.insert(hives).values({
    id: hive1,
    name: 'The Honey Workshop',
    description: 'Beta readers + co-conspirators on The Honeyed Path.',
    bookId: b.primaryPublic.id,
    ownerId: u.smoketest.id,
    visibility: 'PUBLIC',
    discoverable: true,
    status: 'ACTIVE',
  })
  await db.insert(hiveMembers).values([
    { hiveId: hive1, userId: u.smoketest.id, role: 'OWNER' },
    { hiveId: hive1, userId: u.maya.id, role: 'MODERATOR' },
    { hiveId: hive1, userId: u.dorian.id, role: 'CONTRIBUTOR' },
    { hiveId: hive1, userId: u.vesper.id, role: 'BETA_READER' },
  ])

  // Buzz posts
  await db.insert(hiveBuzzPosts).values([
    {
      id: createId(),
      hiveId: hive1,
      authorId: u.smoketest.id,
      type: 'TEXT',
      body: 'Pushed chapter 5 draft! Looking for feedback on pacing.',
      likeCount: 2,
    },
    {
      id: createId(),
      hiveId: hive1,
      authorId: u.maya.id,
      type: 'LINK',
      body: 'Found this article on apiarist culture in 1800s Slovenia — really useful background.',
      linkUrl: 'https://example.com/apiarists',
      likeCount: 1,
    },
  ])

  // Word goal
  await db.insert(hiveWordGoals).values({
    id: createId(),
    hiveId: hive1,
    createdBy: u.smoketest.id,
    type: 'WEEKLY',
    targetWords: 5000,
    startDate: daysAgo(3),
    endDate: new Date(Date.now() + 4 * 86400_000),
    isActive: true,
  })

  // 1 PENDING submission
  await db.insert(hiveSubmissions).values({
    id: createId(),
    hiveId: hive1,
    userId: u.dorian.id,
    title: 'The Letter Returns',
    content: prose('The bees brought it back, somehow. The parchment was now warm, and the script had shifted.'),
    wordCount: 17,
    draftStatus: 'PENDING',
    targetChapterOrder: 6,
  })

  // 1 annotation on chapter 1 of the primary's public book
  await db.insert(hiveAnnotations).values({
    id: createId(),
    hiveId: hive1,
    chapterId: b.primaryPublic.chapterIds[0],
    authorId: u.maya.id,
    parentId: null,
    layer: 'TONE',
    selectionStart: 0,
    selectionEnd: 30,
    selectedText: 'The cottage smelled of beeswax',
    body: 'Love this opening — sets the sensory hook immediately.',
    resolved: false,
  })

  // 1 suggestion on chapter 2
  await db.insert(hiveSuggestions).values({
    id: createId(),
    hiveId: hive1,
    chapterId: b.primaryPublic.chapterIds[1],
    authorId: u.dorian.id,
    parentId: null,
    selectionStart: 0,
    selectionEnd: 25,
    originalExcerpt: 'Sealed inside the seventh',
    suggestedText: 'Tucked behind the seventh',
    body: 'Reads warmer without losing the surprise.',
    resolved: false,
  })

  // Hive 2: Dorian owns (standalone — needs a shadow book)
  const shadowBookId = createId()
  await db.insert(books).values({
    id: shadowBookId,
    userId: u.dorian.id,
    title: '__shadow_for_hive',
    synopsis: null,
    visibility: 'PRIVATE',
    discoverable: false,
    status: 'STANDALONE_HIVE_SHADOW',
  })
  const hive2 = createId()
  await db.insert(hives).values({
    id: hive2,
    name: 'Gothic Sprint Club',
    description: 'Weekly word sprints. No spoilers.',
    bookId: shadowBookId,
    ownerId: u.dorian.id,
    visibility: 'PUBLIC',
    discoverable: true,
    status: 'ACTIVE',
  })
  await db.insert(hiveMembers).values([
    { hiveId: hive2, userId: u.dorian.id, role: 'OWNER' },
    { hiveId: hive2, userId: u.smoketest.id, role: 'CONTRIBUTOR' },
    { hiveId: hive2, userId: u.june.id, role: 'CONTRIBUTOR' },
  ])

  console.log('  ✓ 2 hives (1 linked, 1 standalone) + members + buzz + word goal + submission + annotation + suggestion')
  return { primaryHive: hive1, standaloneHive: hive2 }
}

// ─── 12. CLUBS ───────────────────────────────────────────────────────────────

async function seedClubs(u: Record<string, SeededUser>, b: Record<string, SeededBook>) {
  console.log('→ Seeding clubs…')
  // Club 1: primary owns, public, open join
  const club1 = createId()
  await db.insert(bookClubs).values({
    id: club1,
    ownerId: u.smoketest.id,
    name: 'Cozy Reads After Dark',
    description: 'A laid-back club for cozy fantasy + literary slow burns. One book a month.',
    rules: 'Be kind. No spoilers in chapter threads.',
    tags: ['cozy', 'fantasy', 'literary'],
    visibility: 'PUBLIC',
    discoverable: true,
    openJoin: true,
    currentBookId: null,
    memberCount: 4,
  })
  await db.insert(bookClubMembers).values([
    { id: createId(), clubId: club1, userId: u.smoketest.id, role: 'OWNER' },
    { id: createId(), clubId: club1, userId: u.maya.id, role: 'MODERATOR' },
    { id: createId(), clubId: club1, userId: u.june.id, role: 'MEMBER' },
    { id: createId(), clubId: club1, userId: u.atlas.id, role: 'MEMBER' },
  ])

  // 1 CURRENT + 2 QUEUE + 1 PAST club books
  const currentBookId = createId()
  await db.insert(bookClubBooks).values([
    { id: currentBookId, clubId: club1, bookId: b.mayaBook.id, title: 'The Lantern Garden', author: 'Maya Rivera', status: 'CURRENT', order: 0, startedAt: daysAgo(7) },
    { id: createId(), clubId: club1, bookId: b.juneBook.id, title: 'The Quiet Hours', author: 'June Hale', status: 'QUEUE', order: 0 },
    { id: createId(), clubId: club1, bookId: null, title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin', status: 'QUEUE', order: 1 },
    { id: createId(), clubId: club1, bookId: null, title: 'The Night Circus', author: 'Erin Morgenstern', status: 'PAST', order: 0, startedAt: daysAgo(40), finishedAt: daysAgo(14) },
  ])
  // Update the club's currentBookId pointer
  await db.update(bookClubs).set({ currentBookId }).where(eq(bookClubs.id, club1))

  // 2 discussion threads + replies
  const disc1 = createId()
  const disc2 = createId()
  await db.insert(bookClubDiscussions).values([
    { id: disc1, clubId: club1, authorId: u.smoketest.id, title: 'First impressions of The Lantern Garden', content: 'I love the conservatory metaphor. The brass key opening felt earned. Thoughts?', isPinned: true, likeCount: 2, replyCount: 2 },
    { id: disc2, clubId: club1, authorId: u.maya.id, title: 'Pacing — does Chapter 3 work for you?', content: 'I felt it dragged a bit on second read. Curious if anyone else noticed.', isPinned: false, likeCount: 1, replyCount: 1 },
  ])
  await db.insert(bookClubDiscussionReplies).values([
    { id: createId(), discussionId: disc1, authorId: u.june.id, content: 'Yes! That opening image is one of my favorites of the year.', likeCount: 1 },
    { id: createId(), discussionId: disc1, authorId: u.atlas.id, content: 'Brass key as a magical license — chef\'s kiss.', likeCount: 0 },
    { id: createId(), discussionId: disc2, authorId: u.smoketest.id, content: 'Agreed — but I thought it was an intentional breath before the second act.', likeCount: 1 },
  ])

  // 1 schedule milestone
  await db.insert(bookClubScheduleItems).values({
    id: createId(),
    clubId: club1,
    bookId: currentBookId,
    chapterStart: 1,
    chapterEnd: 3,
    targetDate: new Date(Date.now() + 5 * 86400_000),
    label: 'Reach end of Act I by next Sunday',
  })

  // Club 2: Dorian owns, primary is a member
  const club2 = createId()
  await db.insert(bookClubs).values({
    id: club2,
    ownerId: u.dorian.id,
    name: 'Gothic Monthly',
    description: 'One gothic novel a month. Lights out at 9.',
    tags: ['gothic'],
    visibility: 'PUBLIC',
    discoverable: true,
    openJoin: false,
    memberCount: 2,
  })
  await db.insert(bookClubMembers).values([
    { id: createId(), clubId: club2, userId: u.dorian.id, role: 'OWNER' },
    { id: createId(), clubId: club2, userId: u.smoketest.id, role: 'MEMBER' },
  ])

  console.log('  ✓ 2 clubs (primary owns 1, member of 1) + books + discussions + schedule')
  return { primaryClub: club1 }
}

// ─── 13. SOCIAL ACTIVITY (feed) ──────────────────────────────────────────────

async function seedActivity(u: Record<string, SeededUser>, b: Record<string, SeededBook>) {
  console.log('→ Seeding activity feed…')
  await db.insert(socialActivity).values([
    { id: createId(), actorId: u.maya.id, type: 'book_published', subjectType: 'book', subjectId: b.mayaBook.id, payload: { title: 'The Lantern Garden' }, createdAt: daysAgo(12) },
    { id: createId(), actorId: u.dorian.id, type: 'book_published', subjectType: 'book', subjectId: b.dorianBook.id, payload: { title: 'The House Without Mirrors' }, createdAt: daysAgo(10) },
    { id: createId(), actorId: u.vesper.id, type: 'book_published', subjectType: 'book', subjectId: b.vesperBook.id, payload: { title: 'Sleep in the Long Shadow' }, createdAt: daysAgo(8) },
    { id: createId(), actorId: u.smoketest.id, type: 'chapter_posted', subjectType: 'chapter', subjectId: b.primaryPublic.binderItemIds[2], payload: { bookId: b.primaryPublic.id, status: 'REVISED' }, createdAt: daysAgo(5) },
    { id: createId(), actorId: u.maya.id, type: 'book_liked', subjectType: 'book', subjectId: b.primaryPublic.id, payload: {}, createdAt: daysAgo(4) },
    { id: createId(), actorId: u.dorian.id, type: 'book_commented', subjectType: 'book', subjectId: b.primaryPublic.id, payload: { excerpt: 'The atmosphere is so warm.' }, createdAt: daysAgo(3) },
    { id: createId(), actorId: u.smoketest.id, type: 'reading_list_created', subjectType: 'reading_list', subjectId: 'placeholder', payload: { listTitle: 'Cozy fantasy for rainy days' }, createdAt: daysAgo(2) },
  ])
  console.log('  ✓ 7 feed events')
}

// ─── 14. NOTIFICATIONS ───────────────────────────────────────────────────────

async function seedNotifications(
  u: Record<string, SeededUser>,
  b: Record<string, SeededBook>,
  sparkData: { sparkIds: Record<string, string>; winnerEntryId: string },
  hiveData: { primaryHive: string },
  clubData: { primaryClub: string },
) {
  console.log('→ Seeding notifications for primary user…')
  await db.insert(notifications).values([
    { id: createId(), userId: u.smoketest.id, type: 'NEW_FOLLOWER', actorId: u.atlas.id, resourceType: 'user', resourceId: u.atlas.id, read: false, createdAt: hoursAgo(1) },
    { id: createId(), userId: u.smoketest.id, type: 'NEW_LIKE', actorId: u.maya.id, resourceType: 'book', resourceId: b.primaryPublic.id, read: false, createdAt: hoursAgo(2) },
    { id: createId(), userId: u.smoketest.id, type: 'NEW_COMMENT', actorId: u.dorian.id, resourceType: 'book', resourceId: b.primaryPublic.id, read: false, createdAt: hoursAgo(3) },
    { id: createId(), userId: u.smoketest.id, type: 'NEW_CHAPTER', actorId: u.maya.id, resourceType: 'chapter', resourceId: b.mayaBook.chapterIds[0], read: false, createdAt: hoursAgo(4) },
    { id: createId(), userId: u.smoketest.id, type: 'SPARK_WIN', actorId: u.vesper.id, resourceType: 'spark', resourceId: sparkData.sparkIds.closed, read: false, createdAt: hoursAgo(6) },
    { id: createId(), userId: u.smoketest.id, type: 'FRIEND_REQUEST', actorId: u.june.id, resourceType: 'friendship', resourceId: null, read: false, createdAt: hoursAgo(8) },
    { id: createId(), userId: u.smoketest.id, type: 'FRIEND_ACCEPTED', actorId: u.dorian.id, resourceType: 'friendship', resourceId: null, read: true, createdAt: daysAgo(2) },
    { id: createId(), userId: u.smoketest.id, type: 'HIVE_INVITE', actorId: u.atlas.id, resourceType: 'hive_invite', resourceId: null, read: true, createdAt: daysAgo(3) },
    { id: createId(), userId: u.smoketest.id, type: 'HIVE_SUBMISSION', actorId: u.dorian.id, resourceType: 'hive_submission', resourceId: null, read: false, createdAt: hoursAgo(5) },
    { id: createId(), userId: u.smoketest.id, type: 'CLUB_INVITE', actorId: u.maya.id, resourceType: 'book_club_invite', resourceId: null, read: true, createdAt: daysAgo(4) },
    { id: createId(), userId: u.smoketest.id, type: 'CLUB_JOIN_REQUEST', actorId: u.atlas.id, resourceType: 'book_club_join_request', resourceId: null, read: false, createdAt: hoursAgo(10) },
  ])
  console.log('  ✓ 11 notifications spanning every wired type')
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌼 Beehive Studio — Smoke-test seed\n')
  await wipe()
  const u = await seedUsers()
  await seedSocialGraph(u)
  const b = await seedBooks(u)
  await seedSocial(u, b)
  const sparkData = await seedSparks(u)
  await seedReadingLists(u, b)
  const hiveData = await seedHives(u, b)
  const clubData = await seedClubs(u, b)
  await seedActivity(u, b)
  await seedNotifications(u, b, sparkData, hiveData, clubData)

  console.log('\n✓ Seed complete.\n')
  console.log('────────────────────────────────────────────')
  console.log('  Sign in at  http://localhost:3000/en/sign-in')
  console.log(`  Email      ${TEST_USERS[0].email}`)
  console.log(`  Password   ${DEFAULT_PASSWORD}`)
  console.log('────────────────────────────────────────────\n')
  console.log('Supporting cast (same password):')
  for (const u of TEST_USERS.slice(1)) {
    console.log(`  • @${u.username.padEnd(10)} ${u.email}`)
  }
  console.log()
  process.exit(0)
}

main().catch((err) => {
  console.error('\nSeed failed:', err)
  process.exit(1)
})
