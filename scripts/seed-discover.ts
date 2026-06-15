/**
 * Discover data seeder.
 *
 * Populates ~30 users, ~60 books, ~25 sparks, ~20 hives, ~20 reading
 * lists, ~20 book clubs — enough to fill every /discover route with
 * pagination room. All entities are PUBLIC + discoverable.
 *
 * SAFETY: refuses on NODE_ENV=production OR prod-looking DATABASE_URL.
 * Wipes only the test users this script creates (email prefix
 * `discover-seed-`), then re-seeds.
 *
 * Run: npm run seed:discover
 */

import 'dotenv/config'
import { db } from '../db'
import {
  users,
  userProfiles,
  books,
  binderItems,
  chapters,
  follows,
  sparks,
  readingLists,
  readingListBooks,
  hives,
  hiveMembers,
  bookClubs,
  bookClubMembers,
  bookClubBooks,
} from '../db/schema'
import { inArray, eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { auth } from '../lib/auth'

// ─── Safety ─────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  console.error('REFUSED: NODE_ENV=production.')
  process.exit(1)
}
const dbUrl = process.env.DATABASE_URL ?? ''
if (/prod|production|live/i.test(dbUrl)) {
  console.error('REFUSED: DATABASE_URL looks production-y.')
  process.exit(1)
}
if (!dbUrl) {
  console.error('REFUSED: DATABASE_URL not set.')
  process.exit(1)
}

// ─── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_PASSWORD = 'Test12345!'
const EMAIL_PREFIX = 'discover-seed-'

const GENRES = [
  'fantasy', 'sci-fi', 'romance', 'mystery', 'horror', 'thriller',
  'historical', 'contemporary', 'literary', 'ya', 'adventure',
  'drama', 'poetry', 'other',
] as const

const FIRST_NAMES = [
  'Maya', 'Dorian', 'Vesper', 'June', 'Atlas', 'Lyra', 'Cyrus', 'Iris',
  'Felix', 'Nova', 'Orion', 'Sage', 'Wren', 'Theo', 'Astra', 'Kai',
  'Linnea', 'Otis', 'Pippa', 'Quinn', 'Rowan', 'Soren', 'Tess', 'Ulric',
  'Vera', 'Wilder', 'Xen', 'Yara', 'Zoe', 'Bram',
] as const

const LAST_NAMES = [
  'Hale', 'Vale', 'Nox', 'Rivera', 'Park', 'Brooks', 'Wilde', 'Quill',
  'Marsh', 'Hollow', 'Stone', 'Reed', 'Frost', 'Beck', 'Lark', 'Hart',
] as const

const BOOK_TITLES = [
  'The Marrow Court', 'Silver Tongue', 'Hollow Star', 'Iron Garden',
  'Salt and Smoke', 'Bright Bones', 'Wax Wing', 'The Crown\'s Edge',
  'Lost Compass', 'Velvet Hours', 'Paper Knives', 'Glass Mountain',
  'The Long Quiet', 'Coal &amp; Cinder', 'A Map of Lies', 'Storm Folio',
  'The Last Lantern', 'Honey and Ash', 'The Bone Library',
  'Saltwater Hymn', 'Of Smoke and Stars', 'The Mirrorling', 'Cold Bloom',
  'A House of Threads', 'Tidewater Court', 'The Quiet Door',
  'Embergrass', 'The Carriage of Stones', 'Witch Window', 'Black Almanac',
  'Splintergate', 'The Final Coda', 'Echo Field', 'Crown of Wax',
  'The Lonely Forge', 'River of Owls', 'Petalblade', 'The Shallow Year',
  'Catechism of Dust', 'The Honey King', 'Tin Cathedral', 'Slow Hunger',
  'A Calendar of Storms', 'Tongue of Coral', 'The Apothecary\'s Daughter',
  'Wolfgate', 'Threadbare', 'The Last Almanac', 'Glassblood',
  'The Quiet Architect', 'Hummingbird Wars', 'Daybreak Theatre',
  'The Heretic\'s Garden', 'A Map of the Quiet World', 'Smokerose',
  'Cinder &amp; Brass', 'The Lighthouse Pact', 'Beasts of Linen',
  'Bonefire', 'The Inkwood',
] as const

const SPARK_PROMPTS = [
  'Write a heist in 1000 words.',
  'The villain\'s apology. No qualifiers.',
  'Write a lullaby for a monster.',
  'An object that grants wishes but knows your worst secret.',
  'Open with a line of dialogue. End with the same line.',
  'A library where every book lies.',
  'A god learns mortality.',
  'Two strangers meet at a vending machine at 3am.',
  'A letter never sent.',
  'The last person on earth answers the phone.',
  'A wedding interrupted by weather.',
  'A protagonist who can only lie.',
  'A diary entry from the night the world changed.',
  'Write a fairy tale set in a parking lot.',
  'The witness who can\'t testify.',
  'A reunion no one asked for.',
  'Describe a city no one has ever entered.',
  'A debt that\'s been paid three times.',
  'The interviewer was lying too.',
  'A meal cooked for someone who\'ll never eat it.',
  'Write a chase scene with no movement.',
  'A horror story disguised as a recipe.',
  'A character apologizes in the wrong language.',
  'The map was drawn by the lost.',
  'Two siblings, one secret, one kettle.',
] as const

const HIVE_NAMES = [
  'Marrow Court', 'Silver Quill', 'Late Night Writers', 'Hollow Star Circle',
  'Iron Garden Workshop', 'Salt &amp; Smoke crew', 'Honeycomb Hours',
  'The Slow Brewers', 'Quill &amp; Lantern', 'The Long Form Pact',
  'Glass Mountain Guild', 'The Bonewriters', 'Tidewater Beta',
  'The Quiet Door Society', 'Embergrass Cohort', 'The Cinder Circle',
  'Almanac Makers', 'Witchwood Workshop', 'The Mirrorling Lodge',
  'Daybreak Drafters',
] as const

const LIST_TITLES = [
  'Stories that gut me', 'Slow-burn fantasy', 'Debut novels that stuck',
  'Soft hopeful sci-fi', 'For when the world is loud',
  'Villains I\'d die for', 'Cozy reads for autumn', 'Books with maps',
  'Magic systems I think about', 'Mystery, but make it weird',
  'YA that doesn\'t feel YA', 'Romances without the trope',
  'Standalone fantasy', 'Books I cried at', 'Short reads, long shadows',
  'Worldbuilding masterclass', 'Antiheroes I\'d trust with my plants',
  'Books with terrible kings', 'Best opening lines',
  'Lost cities, sealed doors',
] as const

const CLUB_NAMES = [
  'Tea &amp; Treachery', 'Silver Tongue Society', 'Late Night Lit',
  'Hollow Star Readers', 'Iron Garden Bookclub', 'Salt &amp; Smoke club',
  'The Honeycomb Council', 'Slow Reading Society', 'The Margin Annotators',
  'Quiet Door Bookclub', 'The Cinder Reads', 'Almanac Readers',
  'Witchwood Reading Club', 'Glass Mountain Readers', 'The Saltwater Set',
  'Tidewater Reading', 'The Bone Library Club', 'Daybreak Readers',
  'The Mirrorling Society', 'Embergrass Bookclub',
] as const

const SYNOPSIS_FRAGMENTS = [
  'A reluctant heir', 'A retired soldier', 'A self-taught cartographer',
  'A grieving sister', 'A failed apothecary', 'A widowed gardener',
  'A quiet thief', 'A talented liar', 'A coastal scholar',
] as const

const SYNOPSIS_BEATS = [
  'must outwit a council of bone-mages.',
  'uncovers a city beneath the city.',
  'falls in love with the wrong moon.',
  'inherits a debt older than the kingdom.',
  'finds a door that wasn\'t there yesterday.',
  'gets one last chance to undo a war.',
  'learns the dead remember everything.',
  'discovers their grandfather wrote the law of the country.',
] as const

// ─── Helpers ────────────────────────────────────────────────────────────────

let seedCounter = 0
function pick<T>(arr: readonly T[]): T {
  // Deterministic round-robin (no Math.random per project guidance).
  const v = arr[seedCounter % arr.length]
  seedCounter++
  return v
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400_000)
}

function prose(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

// ─── Wipe ───────────────────────────────────────────────────────────────────

async function wipe() {
  console.log('→ Wiping prior discover-seed users…')
  const rows = await db.select({ id: users.id, email: users.email }).from(users)
  const ids = rows.filter((r) => r.email?.startsWith(EMAIL_PREFIX)).map((r) => r.id)
  if (ids.length === 0) {
    console.log('  (nothing to wipe)')
    return
  }
  console.log(`  Found ${ids.length} prior — deleting…`)
  await db.delete(users).where(inArray(users.id, ids))
  console.log(`  ✓ wiped ${ids.length} users + cascaded data`)
}

// ─── Users ──────────────────────────────────────────────────────────────────

type SeededUser = { id: string; username: string; displayName: string }

async function seedUsers(count: number): Promise<SeededUser[]> {
  console.log(`→ Seeding ${count} users…`)
  const out: SeededUser[] = []
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length]
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length]
    const username = `${first.toLowerCase()}${i}`
    const displayName = `${first} ${last}`
    const email = `${EMAIL_PREFIX}${username}@beehive.local`
    const result = await auth.api.signUpEmail({
      body: { email, password: DEFAULT_PASSWORD, name: displayName },
    })
    const userId = result.user.id
    await db.insert(userProfiles).values({
      userId,
      username,
      displayName,
      bio: `Writer · ${pick(GENRES)} · seed user ${i + 1}`,
      avatarUrl: `https://api.dicebear.com/8.x/notionists/svg?seed=${username}`,
      onboardingComplete: true,
    })
    out.push({ id: userId, username, displayName })
    if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${count}`)
  }
  console.log(`  ✓ ${count} users`)
  return out
}

// ─── Follows (cross-graph) ──────────────────────────────────────────────────

async function seedFollows(usersList: SeededUser[]) {
  console.log('→ Seeding follow graph…')
  const rows: { followerId: string; followeeId: string }[] = []
  for (let i = 0; i < usersList.length; i++) {
    // Each user follows the next 3-4 in the list (wrapping).
    for (let k = 1; k <= 3; k++) {
      const j = (i + k) % usersList.length
      rows.push({
        followerId: usersList[i].id,
        followeeId: usersList[j].id,
      })
    }
  }
  await db.insert(follows).values(rows)
  console.log(`  ✓ ${rows.length} follow edges`)
}

// ─── Books ──────────────────────────────────────────────────────────────────

type SeededBook = {
  id: string
  title: string
  userId: string
  authorUsername: string
  genre: string
  coverUrl: string | null
  totalWords: number
}

const COVER_PALETTES = [
  'oklch(0.45 0.18 30)',   // warm red
  'oklch(0.45 0.18 180)',  // teal
  'oklch(0.45 0.18 270)',  // violet
  'oklch(0.45 0.18 75)',   // gold
  'oklch(0.4 0.18 130)',   // green
  'oklch(0.4 0.18 220)',   // blue
]

async function seedBooks(usersList: SeededUser[]): Promise<SeededBook[]> {
  console.log('→ Seeding books…')
  const out: SeededBook[] = []
  // ~2 books per user
  let bookIdx = 0
  for (const u of usersList) {
    const bookCount = 1 + (bookIdx % 3) // 1, 2, or 3
    for (let b = 0; b < bookCount; b++) {
      const title = BOOK_TITLES[bookIdx % BOOK_TITLES.length] + (bookIdx >= BOOK_TITLES.length ? ` ${Math.floor(bookIdx / BOOK_TITLES.length) + 1}` : '')
      const genre = GENRES[bookIdx % GENRES.length]
      // Target length distribution: short / novella / novel / epic in rotation
      const lengthBucket = bookIdx % 4
      const targetWords =
        lengthBucket === 0 ? 15_000 :
        lengthBucket === 1 ? 35_000 :
        lengthBucket === 2 ? 80_000 :
                              140_000
      // Updated recency: half recent, half stale (90d+) for the Ongoing/Completed filter mix.
      const updatedAt =
        bookIdx % 2 === 0
          ? daysAgo(1 + (bookIdx % 14))   // within last 2 weeks
          : daysAgo(120 + (bookIdx % 60)) // 4-6 months ago
      const seriesNumber = bookIdx % 5 === 0 ? null : (bookIdx % 3) + 1
      const seriesName = seriesNumber === null ? null : `The ${title.split(' ').slice(-1)[0]} Cycle`
      const synopsis = `${pick(SYNOPSIS_FRAGMENTS)} ${pick(SYNOPSIS_BEATS)}`

      const bookId = createId()
      const coverUrl = `https://api.dicebear.com/8.x/shapes/svg?seed=${bookId}&backgroundColor=${COVER_PALETTES[bookIdx % COVER_PALETTES.length].replace(/[^a-z0-9]/gi, '')}`

      await db.insert(books).values({
        id: bookId,
        userId: u.id,
        title,
        synopsis,
        genre,
        tags: [genre, `topic-${bookIdx % 8}`],
        coverUrl,
        visibility: 'PUBLIC',
        discoverable: true,
        status: 'PUBLISHED',
        seriesName,
        seriesNumber,
        firstPubliclyDiscoverableAt: daysAgo(30 + (bookIdx % 90)),
        createdAt: daysAgo(60 + (bookIdx % 120)),
        updatedAt,
      })

      // 3 chapters per book with wordCount summing to targetWords.
      const chapterCount = 3
      const perChapter = Math.floor(targetWords / chapterCount)
      let totalWords = 0
      for (let c = 0; c < chapterCount; c++) {
        const binderItemId = createId()
        await db.insert(binderItems).values({
          id: binderItemId,
          bookId,
          type: 'chapter',
          title: `Chapter ${c + 1}`,
          parentId: null,
          order: c,
          authorId: u.id,
          lastEditedBy: u.id,
        })
        const wordCount =
          c === chapterCount - 1
            ? targetWords - perChapter * (chapterCount - 1)
            : perChapter
        totalWords += wordCount
        await db.insert(chapters).values({
          bookId,
          binderItemId,
          content: prose(`Chapter ${c + 1} of ${title}. ${synopsis}`),
          wordCount,
          status: 'FINAL',
          authorUserId: u.id,
        })
      }

      out.push({
        id: bookId,
        title,
        userId: u.id,
        authorUsername: u.username,
        genre,
        coverUrl,
        totalWords,
      })
      bookIdx++
    }
  }
  console.log(`  ✓ ${out.length} books (with chapters)`)
  return out
}

// ─── Sparks ─────────────────────────────────────────────────────────────────

async function seedSparks(usersList: SeededUser[], count: number) {
  console.log(`→ Seeding ${count} sparks…`)
  const rows = []
  for (let i = 0; i < count; i++) {
    const creator = usersList[i % usersList.length]
    const prompt = SPARK_PROMPTS[i % SPARK_PROMPTS.length]
    // Mix states: ~60% OPEN, ~20% VOTING, ~20% CLOSED
    const phase = i % 5
    const status: 'OPEN' | 'VOTING' | 'CLOSED' =
      phase === 0 ? 'CLOSED' : phase === 1 ? 'VOTING' : 'OPEN'
    // Word limits mixed across flash/medium/long
    const wordLimit = [300, 800, 1500, 2500][i % 4]
    const deadline =
      status === 'OPEN'
        ? new Date(Date.now() + (i % 7 + 1) * 86400_000) // 1-7 days out
        : status === 'VOTING'
          ? new Date(Date.now() - (i % 3) * 86400_000)   // recently passed
          : daysAgo(20 + (i % 30))                        // long past
    rows.push({
      id: createId(),
      creatorId: creator.id,
      title: prompt,
      description: `A spark from @${creator.username}.`,
      wordLimit,
      deadline,
      visibility: 'PUBLIC' as const,
      discoverable: true,
      status,
      genre: GENRES[i % GENRES.length],
      firstPubliclyDiscoverableAt: daysAgo(2 + (i % 30)),
      entryCount: status === 'OPEN' ? i % 8 : status === 'VOTING' ? 5 + (i % 15) : 8 + (i % 20),
      createdAt: daysAgo(5 + (i % 40)),
    })
  }
  await db.insert(sparks).values(rows)
  console.log(`  ✓ ${count} sparks`)
}

// ─── Hives ──────────────────────────────────────────────────────────────────

async function seedHives(
  usersList: SeededUser[],
  booksList: SeededBook[],
  count: number,
) {
  console.log(`→ Seeding ${count} hives…`)
  for (let i = 0; i < count; i++) {
    const owner = usersList[i % usersList.length]
    // Each hive linked to one of the owner's books, or any book as fallback.
    const ownerBooks = booksList.filter((b) => b.userId === owner.id)
    const linkedBook = ownerBooks[0] ?? booksList[i % booksList.length]
    const hiveId = createId()
    const name = HIVE_NAMES[i % HIVE_NAMES.length] + (i >= HIVE_NAMES.length ? ` ${Math.floor(i / HIVE_NAMES.length) + 1}` : '')
    const memberCount = 2 + (i % 14) // mix small / mid / large
    const lastActivityAt = daysAgo(i % 30)
    await db.insert(hives).values({
      id: hiveId,
      bookId: linkedBook.id,
      ownerId: owner.id,
      name,
      description: `A hive forming around ${linkedBook.title}.`,
      visibility: 'PUBLIC',
      discoverable: true,
      status: 'ACTIVE',
      firstPubliclyDiscoverableAt: daysAgo(20 + (i % 60)),
      memberCount,
      lastActivityAt,
      createdAt: daysAgo(30 + (i % 90)),
    })
    // OWNER membership row.
    await db.insert(hiveMembers).values({
      hiveId,
      userId: owner.id,
      role: 'OWNER',
    })
    // Sprinkle in 2-4 other members to make memberCount realistic.
    const others = usersList
      .filter((u) => u.id !== owner.id)
      .slice((i * 3) % usersList.length, ((i * 3) % usersList.length) + Math.min(memberCount - 1, 4))
    for (const m of others) {
      try {
        await db.insert(hiveMembers).values({
          hiveId,
          userId: m.id,
          role: 'CONTRIBUTOR',
        })
      } catch {
        // unique-index collision if same user re-picked; ignore.
      }
    }
  }
  console.log(`  ✓ ${count} hives`)
}

// ─── Reading lists ──────────────────────────────────────────────────────────

async function seedLists(
  usersList: SeededUser[],
  booksList: SeededBook[],
  count: number,
) {
  console.log(`→ Seeding ${count} reading lists…`)
  for (let i = 0; i < count; i++) {
    const owner = usersList[i % usersList.length]
    const listId = createId()
    const title = LIST_TITLES[i % LIST_TITLES.length] + (i >= LIST_TITLES.length ? ` vol ${Math.floor(i / LIST_TITLES.length) + 1}` : '')
    const bookSlice = booksList.slice((i * 3) % booksList.length, ((i * 3) % booksList.length) + 4 + (i % 6))
    const genre = GENRES[i % GENRES.length]
    await db.insert(readingLists).values({
      id: listId,
      userId: owner.id,
      kind: 'CUSTOM',
      title,
      description: `${bookSlice.length} hand-picked reads from @${owner.username}.`,
      visibility: 'PUBLIC',
      discoverable: true,
      tags: [genre],
      bookCount: bookSlice.length,
      followerCount: 1 + (i % 25),
      genre,
      firstPubliclyDiscoverableAt: daysAgo(15 + (i % 60)),
      lastUpdatedAt: daysAgo(i % 30),
      createdAt: daysAgo(30 + (i % 90)),
    })
    for (let b = 0; b < bookSlice.length; b++) {
      const book = bookSlice[b]
      await db.insert(readingListBooks).values({
        listId,
        bookId: book.id,
        title: book.title,
        author: `@${book.authorUsername}`,
        coverUrl: book.coverUrl,
        order: b,
      })
    }
  }
  console.log(`  ✓ ${count} lists`)
}

// ─── Book clubs ─────────────────────────────────────────────────────────────

async function seedClubs(
  usersList: SeededUser[],
  booksList: SeededBook[],
  count: number,
) {
  console.log(`→ Seeding ${count} book clubs…`)
  for (let i = 0; i < count; i++) {
    const owner = usersList[i % usersList.length]
    const clubId = createId()
    const name = CLUB_NAMES[i % CLUB_NAMES.length] + (i >= CLUB_NAMES.length ? ` vol ${Math.floor(i / CLUB_NAMES.length) + 1}` : '')
    const memberCount = 2 + (i % 18)
    const openJoin = i % 3 !== 0 // 2/3 open
    const hasCurrent = i % 4 !== 0 // 3/4 have a current book

    await db.insert(bookClubs).values({
      id: clubId,
      ownerId: owner.id,
      name,
      description: `A book club run by @${owner.username}.`,
      visibility: 'PUBLIC',
      discoverable: true,
      openJoin,
      memberCount,
      genre: GENRES[i % GENRES.length],
      firstPubliclyDiscoverableAt: daysAgo(20 + (i % 60)),
      lastActivityAt: daysAgo(i % 30),
      createdAt: daysAgo(30 + (i % 90)),
    })

    await db.insert(bookClubMembers).values({
      clubId,
      userId: owner.id,
      role: 'OWNER',
    })

    // Add some other members
    const others = usersList
      .filter((u) => u.id !== owner.id)
      .slice((i * 5) % usersList.length, ((i * 5) % usersList.length) + Math.min(memberCount - 1, 5))
    for (const m of others) {
      try {
        await db.insert(bookClubMembers).values({
          clubId,
          userId: m.id,
          role: 'MEMBER',
        })
      } catch {
        // ignore unique collisions
      }
    }

    // Current book (optional) — insert as bookClubBooks row then point clubs.currentBookId at it.
    if (hasCurrent) {
      const pickedBook = booksList[(i * 7) % booksList.length]
      const ccBookId = createId()
      await db.insert(bookClubBooks).values({
        id: ccBookId,
        clubId,
        bookId: pickedBook.id,
        title: pickedBook.title,
        author: `@${pickedBook.authorUsername}`,
        coverUrl: pickedBook.coverUrl,
        status: 'CURRENT',
        order: 0,
        startedAt: daysAgo(10 + (i % 30)),
      })
      await db
        .update(bookClubs)
        .set({ currentBookId: ccBookId })
        .where(eq(bookClubs.id, clubId))
    }
  }
  console.log(`  ✓ ${count} clubs`)
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== DISCOVER SEED ===\n')
  await wipe()
  const usersList = await seedUsers(30)
  await seedFollows(usersList)
  const booksList = await seedBooks(usersList)
  await seedSparks(usersList, 25)
  await seedHives(usersList, booksList, 20)
  await seedLists(usersList, booksList, 20)
  await seedClubs(usersList, booksList, 20)
  console.log('\n=== DONE ===')
  console.log(`Users:  ${usersList.length}`)
  console.log(`Books:  ${booksList.length}`)
  console.log(`Sparks: 25`)
  console.log(`Hives:  20`)
  console.log(`Lists:  20`)
  console.log(`Clubs:  20`)
  console.log(`\nLogin: any seed account with password ${DEFAULT_PASSWORD}`)
  console.log(`(e.g. ${EMAIL_PREFIX}${usersList[0].username}@beehive.local)`)
  console.log(`\nOpen /en/discover to see the populated surface.\n`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
