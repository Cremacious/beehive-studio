# Sparks Hub Density Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/[locale]/sparks` feel inhabited on fresh accounts. Add a 300px sticky right rail (Suggested writers + Trending now + Your spark stats) plus dashed-border ghost cards that fill sparse buckets with contextual nudges, and fix page width 1920 → 1680px.

**Architecture:** Pure additive layer on top of the already-shipped Sparks Hub (commits 5f93afe → 42f3291). Two new server actions + one prompt-template module. New `<SparksRightRail>` + `<GhostCard>` components co-located with the existing Hub primitives. Page composition rewires to a 2-column grid (main + rail) and interleaves ghost cards into the existing grid output. No schema changes.

**Tech Stack:** Next.js 16 server components, Drizzle ORM, React 19, Tailwind 4 with project design tokens.

**Spec:** [docs/superpowers/specs/2026-06-15-sparks-hub-density-design.md](../specs/2026-06-15-sparks-hub-density-design.md)

---

## File Structure

**New files:**
- `lib/sparks/prompt-templates.ts` — 10-item curated template seed list + deterministic picker
- `lib/sparks/__tests__/prompt-templates.test.ts` — picker determinism tests
- `lib/actions/sparks-rail.actions.ts` — `getTrendingSparksForRailAction` + `getViewerSparkStatsAction`
- `lib/actions/__tests__/sparks-rail-actions.test.ts` — surface-shape tests
- `app/[locale]/(public)/sparks/_components/sparks-right-rail.tsx` — shell + 3 panels (server component)
- `app/[locale]/(public)/sparks/_components/ghost-card.tsx` — 6 ghost variants (server component)
- `app/[locale]/(public)/sparks/_components/pick-ghosts.ts` — pure ghost-selection helper
- `app/[locale]/(public)/sparks/_components/__tests__/pick-ghosts.test.ts` — selection logic tests
- `app/[locale]/(public)/sparks/_components/use-dismissed-ghosts.ts` — localStorage hook (client)

**Modified files:**
- `app/[locale]/(public)/sparks/page.tsx` — 2-col layout, width 1680, ghost interleaving

---

## Task 1: Prompt templates module

**Files:**
- Create: `lib/sparks/prompt-templates.ts`
- Create: `lib/sparks/__tests__/prompt-templates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/sparks/__tests__/prompt-templates.test.ts
import { describe, it, expect } from 'vitest'
import {
  PROMPT_TEMPLATES,
  pickPromptTemplate,
  dayOfYear,
} from '../prompt-templates'

describe('PROMPT_TEMPLATES', () => {
  it('has exactly 10 entries', () => {
    expect(PROMPT_TEMPLATES).toHaveLength(10)
  })

  it('every entry has prompt + wordLimit', () => {
    for (const t of PROMPT_TEMPLATES) {
      expect(typeof t.prompt).toBe('string')
      expect(t.prompt.length).toBeGreaterThan(10)
      expect(typeof t.wordLimit).toBe('number')
      expect(t.wordLimit).toBeGreaterThan(0)
    }
  })
})

describe('dayOfYear', () => {
  it('returns 1 for Jan 1', () => {
    expect(dayOfYear(new Date('2026-01-01T00:00:00Z'))).toBe(1)
  })
  it('returns 60 for Mar 1 in non-leap year', () => {
    expect(dayOfYear(new Date('2026-03-01T00:00:00Z'))).toBe(60)
  })
})

describe('pickPromptTemplate', () => {
  it('returns the same template for the same viewerId on the same day', () => {
    const d = new Date('2026-06-15T12:00:00Z')
    const a = pickPromptTemplate('user-123', d)
    const b = pickPromptTemplate('user-123', d)
    expect(a).toEqual(b)
  })

  it('returns a different template on a different day', () => {
    const d1 = new Date('2026-06-15T12:00:00Z')
    const d2 = new Date('2026-06-16T12:00:00Z')
    const a = pickPromptTemplate('user-123', d1)
    const b = pickPromptTemplate('user-123', d2)
    // Not asserting they differ (could collide via modulo); just that both valid
    expect(PROMPT_TEMPLATES).toContainEqual(a)
    expect(PROMPT_TEMPLATES).toContainEqual(b)
  })

  it('handles empty viewerId as guest deterministically', () => {
    const d = new Date('2026-06-15T12:00:00Z')
    const a = pickPromptTemplate('', d)
    expect(PROMPT_TEMPLATES).toContainEqual(a)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sparks/__tests__/prompt-templates.test.ts`
Expected: FAIL with "Cannot find module '../prompt-templates'"

- [ ] **Step 3: Write the module**

```ts
// lib/sparks/prompt-templates.ts
export type PromptTemplate = { prompt: string; wordLimit: number }

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  { prompt: 'A door that only opens on Tuesdays', wordLimit: 500 },
  { prompt: 'Write a 100-word story where nothing happens, and it matters', wordLimit: 100 },
  { prompt: "What if [object] could remember? Pick an everyday object. Give it 100 years of memory", wordLimit: 800 },
  { prompt: 'The last letter from a sentient lighthouse', wordLimit: 600 },
  { prompt: 'A 3-line poem about hunger', wordLimit: 50 },
  { prompt: "Describe a color that doesn't exist", wordLimit: 300 },
  { prompt: 'Two strangers, one bench, no dialogue', wordLimit: 500 },
  { prompt: 'Write a recipe for an emotion', wordLimit: 200 },
  { prompt: "Your character's morning routine, but reveal a secret on line 7", wordLimit: 400 },
  { prompt: 'A weather report from inside a dream', wordLimit: 250 },
]

/** Returns 1-366 (day-of-year, UTC). */
export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  return Math.floor((d.getTime() - start) / 86_400_000)
}

/** Simple string hash → non-negative int. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Deterministic per-viewer-per-day pick. Same viewer on same day = same template. */
export function pickPromptTemplate(viewerId: string, now: Date = new Date()): PromptTemplate {
  const idx = (hashString(viewerId) + dayOfYear(now)) % PROMPT_TEMPLATES.length
  return PROMPT_TEMPLATES[idx]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/sparks/__tests__/prompt-templates.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/sparks/prompt-templates.ts lib/sparks/__tests__/prompt-templates.test.ts
git commit -m "feat(sparks/hub): prompt templates module — 10 seed templates + per-viewer-per-day picker."
```

---

## Task 2: Right rail server actions

**Files:**
- Create: `lib/actions/sparks-rail.actions.ts`
- Create: `lib/actions/__tests__/sparks-rail-actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/actions/__tests__/sparks-rail-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'viewer-1'),
  AuthError: class extends Error {},
}))

const makeQueryProxy = (rows: unknown[] = []) => {
  const p: any = {}
  for (const k of ['select', 'from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'groupBy']) {
    p[k] = vi.fn(() => p)
  }
  p.then = (resolve: any) => resolve(rows)
  return p
}

vi.mock('@/db', () => ({
  db: { select: vi.fn(() => makeQueryProxy([])) },
}))

beforeEach(() => vi.clearAllMocks())

describe('sparks-rail.actions exports', () => {
  it('exports getTrendingSparksForRailAction', async () => {
    const mod = await import('@/lib/actions/sparks-rail.actions')
    expect(typeof mod.getTrendingSparksForRailAction).toBe('function')
  })
  it('exports getViewerSparkStatsAction', async () => {
    const mod = await import('@/lib/actions/sparks-rail.actions')
    expect(typeof mod.getViewerSparkStatsAction).toBe('function')
  })
  it('getTrendingSparksForRailAction returns success shape', async () => {
    const mod = await import('@/lib/actions/sparks-rail.actions')
    const r = await mod.getTrendingSparksForRailAction({ limit: 3 })
    expect(r.success).toBe(true)
    if (r.success) expect(Array.isArray(r.data)).toBe(true)
  })
  it('getViewerSparkStatsAction returns 4 count keys', async () => {
    const mod = await import('@/lib/actions/sparks-rail.actions')
    const r = await mod.getViewerSparkStatsAction()
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toEqual({
        created: 0,
        entered: 0,
        entriesReceived: 0,
        wins: 0,
      })
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/actions/__tests__/sparks-rail-actions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the actions module**

```ts
// lib/actions/sparks-rail.actions.ts
'use server'

import { db } from '@/db'
import { sparks, sparkEntries } from '@/db/schema/community'
import { requireAuth } from '@/lib/require-auth'
import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm'

export type RailTrendingSpark = {
  id: string
  title: string
  status: 'OPEN' | 'VOTING' | 'CLOSED'
  entryCount: number
  deadline: Date | null
}

export type ViewerSparkStats = {
  created: number
  entered: number
  entriesReceived: number
  wins: number
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

const TRENDING_WINDOW_MS = 7 * 86_400_000

/**
 * Top sparks ranked by entries-this-week across PUBLIC discoverable sparks
 * in OPEN/VOTING status. Used by the Sparks Hub right rail.
 */
export async function getTrendingSparksForRailAction(args: {
  limit?: number
} = {}): Promise<ActionResult<RailTrendingSpark[]>> {
  const limit = Math.min(args.limit ?? 3, 10)
  const windowStart = new Date(Date.now() - TRENDING_WINDOW_MS)

  try {
    const rows = await db
      .select({
        id: sparks.id,
        title: sparks.title,
        deadline: sparks.deadline,
        status: sparks.status,
        entryCount: sql<number>`COUNT(${sparkEntries.id})::int`,
      })
      .from(sparks)
      .leftJoin(
        sparkEntries,
        and(
          eq(sparkEntries.sparkId, sparks.id),
          gte(sparkEntries.createdAt, windowStart),
        ),
      )
      .where(
        and(
          eq(sparks.visibility, 'PUBLIC'),
          // OPEN or VOTING — both still surfaceable on a "trending now" rail
          sql`${sparks.status} IN ('OPEN', 'VOTING')`,
        ),
      )
      .groupBy(sparks.id, sparks.title, sparks.deadline, sparks.status)
      .orderBy(desc(sql`COUNT(${sparkEntries.id})`))
      .limit(limit)

    return {
      success: true,
      data: rows.map(r => ({
        id: r.id,
        title: r.title,
        status: r.status as RailTrendingSpark['status'],
        entryCount: r.entryCount,
        deadline: r.deadline,
      })),
    }
  } catch (e) {
    return { success: false, error: 'FETCH_FAILED' }
  }
}

/**
 * Four counts for the viewer's "Your spark stats" panel.
 * Runs 4 parallel COUNT(*) queries (cheap on indexed columns).
 */
export async function getViewerSparkStatsAction(): Promise<ActionResult<ViewerSparkStats>> {
  const viewerId = await requireAuth()

  try {
    const [createdRows, enteredRows, receivedRows, winRows] = await Promise.all([
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(sparks)
        .where(eq(sparks.userId, viewerId)),
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(sparkEntries)
        .where(eq(sparkEntries.userId, viewerId)),
      db
        .select({ n: sql<number>`COUNT(${sparkEntries.id})::int` })
        .from(sparkEntries)
        .innerJoin(sparks, eq(sparks.id, sparkEntries.sparkId))
        .where(eq(sparks.userId, viewerId)),
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(sparkEntries)
        .innerJoin(sparks, eq(sparks.id, sparkEntries.sparkId))
        .where(
          and(
            eq(sparkEntries.userId, viewerId),
            isNotNull(sparks.winnerEntryId),
            eq(sparks.winnerEntryId, sparkEntries.id),
          ),
        ),
    ])

    return {
      success: true,
      data: {
        created: createdRows[0]?.n ?? 0,
        entered: enteredRows[0]?.n ?? 0,
        entriesReceived: receivedRows[0]?.n ?? 0,
        wins: winRows[0]?.n ?? 0,
      },
    }
  } catch (e) {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
```

- [ ] **Step 4: Confirm DB field names**

Open `db/schema/community.ts` and verify: `sparks.userId`, `sparks.visibility`, `sparks.status`, `sparks.deadline`, `sparks.title`, `sparks.winnerEntryId`, `sparkEntries.id`, `sparkEntries.userId`, `sparkEntries.sparkId`, `sparkEntries.createdAt`. If any differ, adjust the action.

- [ ] **Step 5: Run test + tsc**

Run: `npx vitest run lib/actions/__tests__/sparks-rail-actions.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests) + tsc clean

- [ ] **Step 6: Commit**

```bash
git add lib/actions/sparks-rail.actions.ts lib/actions/__tests__/sparks-rail-actions.test.ts
git commit -m "feat(sparks/hub): rail actions — getTrendingSparksForRail + getViewerSparkStats."
```

---

## Task 3: `<SparksRightRail>` server component

**Files:**
- Create: `app/[locale]/(public)/sparks/_components/sparks-right-rail.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/[locale]/(public)/sparks/_components/sparks-right-rail.tsx
import Link from 'next/link'
import { getSuggestedWritersAction } from '@/lib/actions/community.actions'
import {
  getTrendingSparksForRailAction,
  getViewerSparkStatsAction,
} from '@/lib/actions/sparks-rail.actions'

type Props = { locale: string }

export async function SparksRightRail({ locale }: Props) {
  const [writersR, trendingR, statsR] = await Promise.all([
    getSuggestedWritersAction({ limit: 4 }).catch(() => null),
    getTrendingSparksForRailAction({ limit: 3 }),
    getViewerSparkStatsAction(),
  ])

  const writers = writersR?.success ? writersR.data : []
  const trending = trendingR.success ? trendingR.data : []
  const stats = statsR.success
    ? statsR.data
    : { created: 0, entered: 0, entriesReceived: 0, wins: 0 }

  return (
    <aside
      className="hidden xl:flex flex-col gap-4"
      style={{ position: 'sticky', top: 80, width: 300, alignSelf: 'start' }}
      aria-label="Sparks suggestions"
    >
      {writers.length > 0 ? (
        <RailPanel
          title="Suggested writers"
          seeAllHref={`/${locale}/discover?tab=sparks`}
          seeAllLabel="See all →"
        >
          {writers.map((w, i) => (
            <div
              key={w.id}
              className="flex items-center gap-2.5 py-2"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                className="rounded-full shrink-0"
                style={{ width: 32, height: 32, background: 'oklch(0.45 0.05 256)' }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-bold truncate"
                  style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
                >
                  {w.username}
                </div>
                <div
                  className="text-[11px] truncate"
                  style={{ color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  @{w.username}
                </div>
              </div>
              <Link
                href={`/${locale}/u/${w.username}`}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                style={{
                  background: i === 0 ? 'var(--brand)' : 'rgba(255,255,255,0.06)',
                  color: i === 0 ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-strong)',
                  border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                View
              </Link>
            </div>
          ))}
        </RailPanel>
      ) : null}

      <RailPanel
        title="Trending now"
        seeAllHref={`/${locale}/discover?tab=sparks`}
        seeAllLabel="Discover →"
      >
        {trending.length === 0 ? (
          <p
            className="text-[12px] py-1"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Nothing trending right now.
          </p>
        ) : (
          trending.map((s, i) => (
            <Link
              key={s.id}
              href={`/${locale}/discover/spark/${s.id}`}
              className="block py-2"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                className="text-[12px] font-bold leading-snug mb-1"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                {s.title}
              </div>
              <div
                className="text-[10px] uppercase tracking-[0.06em]"
                style={{ color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {s.status === 'VOTING' ? '🗳️ VOTING' : '⚡ OPEN'} · {s.entryCount} entries
                {s.deadline ? ` · ${formatLeft(s.deadline)}` : ''}
              </div>
            </Link>
          ))
        )}
      </RailPanel>

      <RailPanel title="Your spark stats">
        <div className="grid grid-cols-2 gap-3 pt-1">
          <StatTile value={stats.created} label="Created" emphasize />
          <StatTile value={stats.entered} label="Entered" />
          <StatTile value={stats.entriesReceived} label="Entries received" />
          <StatTile value={stats.wins} label="Wins" />
        </div>
      </RailPanel>
    </aside>
  )
}

function RailPanel({
  title,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  title: string
  seeAllHref?: string
  seeAllLabel?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <h2
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h2>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="text-[10px]"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {seeAllLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function StatTile({ value, label, emphasize }: { value: number; label: string; emphasize?: boolean }) {
  return (
    <div>
      <div
        className="text-[22px] font-bold leading-none"
        style={{
          color: emphasize ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {value}
      </div>
      <div
        className="text-[10px] uppercase tracking-[0.08em] mt-1.5"
        style={{ color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </div>
    </div>
  )
}

function formatLeft(deadline: Date | string): string {
  const d = deadline instanceof Date ? deadline : new Date(deadline)
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return 'ended'
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days}d left`
  const hrs = Math.floor(ms / 3_600_000)
  return `${hrs}h left`
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/sparks/_components/sparks-right-rail.tsx
git commit -m "feat(sparks/hub): SparksRightRail — 3 panels (writers, trending, stats)."
```

---

## Task 4: `pickGhosts` pure selection helper

**Files:**
- Create: `app/[locale]/(public)/sparks/_components/pick-ghosts.ts`
- Create: `app/[locale]/(public)/sparks/_components/__tests__/pick-ghosts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/[locale]/(public)/sparks/_components/__tests__/pick-ghosts.test.ts
import { describe, it, expect } from 'vitest'
import { pickGhosts, type GhostVariant } from '../pick-ghosts'

const ctx = {
  followingCount: 0,
  friendsCount: 0,
  enteredCount: 0,
  ownCount: 0,
  dismissed: new Set<GhostVariant>(),
}

describe('pickGhosts', () => {
  it('returns 0 ghosts when realCount >= 6', () => {
    expect(pickGhosts({ tab: 'all', realCount: 6, ...ctx })).toHaveLength(0)
    expect(pickGhosts({ tab: 'all', realCount: 12, ...ctx })).toHaveLength(0)
  })

  it('returns 5 ghosts when realCount = 0 (cap hits first)', () => {
    expect(pickGhosts({ tab: 'all', realCount: 0, ...ctx })).toHaveLength(5)
  })

  it('returns 5 ghosts when realCount = 1 (total reaches 6)', () => {
    expect(pickGhosts({ tab: 'all', realCount: 1, ...ctx })).toHaveLength(5)
  })

  it('returns 4 ghosts when realCount = 2', () => {
    expect(pickGhosts({ tab: 'all', realCount: 2, ...ctx })).toHaveLength(4)
  })

  it('returns 3 ghosts when realCount = 3', () => {
    expect(pickGhosts({ tab: 'all', realCount: 3, ...ctx })).toHaveLength(3)
  })

  it('returns 1 ghost when realCount = 5', () => {
    expect(pickGhosts({ tab: 'all', realCount: 5, ...ctx })).toHaveLength(1)
  })

  it('yours tab → first ghost is create-first when ownCount = 0', () => {
    const ghosts = pickGhosts({ tab: 'yours', realCount: 0, ...ctx })
    expect(ghosts[0]).toBe('create-first')
  })

  it('following tab → includes follow-writers ghost', () => {
    const ghosts = pickGhosts({ tab: 'following', realCount: 0, ...ctx })
    expect(ghosts).toContain('follow-writers')
  })

  it('friends tab → includes connect-friends ghost', () => {
    const ghosts = pickGhosts({ tab: 'friends', realCount: 0, ...ctx })
    expect(ghosts).toContain('connect-friends')
  })

  it('entered tab → includes enter-a-spark ghost', () => {
    const ghosts = pickGhosts({ tab: 'entered', realCount: 0, ...ctx })
    expect(ghosts).toContain('enter-a-spark')
  })

  it('dismissed ghosts are filtered out', () => {
    const dismissed = new Set<GhostVariant>(['follow-writers', 'connect-friends'])
    const ghosts = pickGhosts({ tab: 'all', realCount: 0, ...ctx, dismissed })
    expect(ghosts).not.toContain('follow-writers')
    expect(ghosts).not.toContain('connect-friends')
  })

  it('always includes from-discover when grid has < 6 real', () => {
    const ghosts = pickGhosts({ tab: 'all', realCount: 0, ...ctx })
    expect(ghosts).toContain('from-discover')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/[locale]/\(public\)/sparks/_components/__tests__/pick-ghosts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the helper**

```ts
// app/[locale]/(public)/sparks/_components/pick-ghosts.ts
import type { SparksTab } from './sparks-tab-strip'

export type GhostVariant =
  | 'from-discover'
  | 'follow-writers'
  | 'connect-friends'
  | 'prompt-template'
  | 'enter-a-spark'
  | 'create-first'

export type PickGhostsInput = {
  tab: SparksTab
  realCount: number
  followingCount: number
  friendsCount: number
  enteredCount: number
  ownCount: number
  dismissed: Set<GhostVariant>
}

const GHOST_MAX = 5
const TARGET_TOTAL = 6

/**
 * Pure selection: returns an ordered list of ghost variants to render after
 * real cards. Honors the cap: 5 max OR until total reaches 6, whichever first.
 */
export function pickGhosts(input: PickGhostsInput): GhostVariant[] {
  const { tab, realCount, followingCount, friendsCount, enteredCount, ownCount, dismissed } = input

  if (realCount >= TARGET_TOTAL) return []
  const room = Math.min(GHOST_MAX, TARGET_TOTAL - realCount)
  if (room <= 0) return []

  // Build ordered priority list per tab; filter to dismissed + room.
  let priority: GhostVariant[]
  switch (tab) {
    case 'yours':
      priority = ownCount === 0
        ? ['create-first', 'prompt-template', 'from-discover', 'prompt-template', 'from-discover']
        : ['prompt-template', 'prompt-template', 'from-discover', 'from-discover', 'from-discover']
      break
    case 'following':
      priority = ['follow-writers', 'from-discover', 'from-discover', 'prompt-template', 'from-discover']
      break
    case 'friends':
      priority = ['connect-friends', 'from-discover', 'from-discover', 'prompt-template', 'from-discover']
      break
    case 'entered':
      priority = ['enter-a-spark', 'from-discover', 'from-discover', 'prompt-template', 'from-discover']
      break
    case 'all':
    default: {
      const list: GhostVariant[] = ['from-discover']
      if (followingCount === 0) list.push('follow-writers')
      if (friendsCount === 0) list.push('connect-friends')
      list.push('prompt-template')
      if (enteredCount === 0) list.push('enter-a-spark')
      // Pad with extra from-discover if short
      while (list.length < 5) list.push('from-discover')
      priority = list
      break
    }
  }

  const out: GhostVariant[] = []
  for (const v of priority) {
    if (out.length >= room) break
    if (dismissed.has(v)) continue
    out.push(v)
  }
  return out
}
```

- [ ] **Step 4: Note — the test imports `SparksTab` from sparks-tab-strip.tsx**

That file exists already (shipped in commit c5dd348). No new export needed; it exports `SparksTab`.

- [ ] **Step 5: Run test**

Run: `npx vitest run app/[locale]/\(public\)/sparks/_components/__tests__/pick-ghosts.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/\(public\)/sparks/_components/pick-ghosts.ts app/[locale]/\(public\)/sparks/_components/__tests__/pick-ghosts.test.ts
git commit -m "feat(sparks/hub): pickGhosts — per-tab ghost selection helper + 12 tests."
```

---

## Task 5: `<GhostCard>` component + dismiss hook

**Files:**
- Create: `app/[locale]/(public)/sparks/_components/use-dismissed-ghosts.ts`
- Create: `app/[locale]/(public)/sparks/_components/ghost-card.tsx`

- [ ] **Step 1: Write the dismiss hook**

```ts
// app/[locale]/(public)/sparks/_components/use-dismissed-ghosts.ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { GhostVariant } from './pick-ghosts'

const STORAGE_KEY = 'sparks-hub:dismissed-ghosts'

function readStorage(): GhostVariant[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useDismissedGhosts() {
  const [dismissed, setDismissed] = useState<GhostVariant[]>(() => readStorage())

  useEffect(() => {
    // Re-sync if another tab dismissed something
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDismissed(readStorage())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const dismiss = useCallback((v: GhostVariant) => {
    setDismissed(prev => {
      if (prev.includes(v)) return prev
      const next = [...prev, v]
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  return { dismissed, dismiss }
}
```

- [ ] **Step 2: Write the GhostCard component**

```tsx
// app/[locale]/(public)/sparks/_components/ghost-card.tsx
'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import type { GhostVariant } from './pick-ghosts'
import type { PromptTemplate } from '@/lib/sparks/prompt-templates'

export type GhostCardProps = {
  variant: GhostVariant
  locale: string
  onDismiss: (v: GhostVariant) => void
  /** Required when variant === 'prompt-template' */
  promptTemplate?: PromptTemplate
  /** Optional first-trending spark to feature when variant === 'from-discover' */
  trendingSpark?: { id: string; title: string; entryCount: number; deadline: Date | string | null } | null
}

const COPY: Record<GhostVariant, {
  labelNote: string
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  iconTint: string
  icon: string
}> = {
  'from-discover': {
    labelNote: 'From Discover',
    eyebrow: '⚡ TRENDING THIS WEEK',
    title: 'See what writers are sparking now',
    body: 'Open Sparks platform-wide — pick one and enter.',
    ctaLabel: 'Browse Discover →',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
    icon: '⚡',
  },
  'follow-writers': {
    labelNote: 'Suggestion',
    eyebrow: '👤 FILL YOUR FEED',
    title: 'Follow writers to fill this tab',
    body: 'Your Following tab is empty. We can suggest 5 active writers whose Sparks you might like.',
    ctaLabel: 'Find writers →',
    iconTint: 'oklch(0.6 0.15 240 / 0.18)',
    icon: '👤',
  },
  'connect-friends': {
    labelNote: 'Suggestion',
    eyebrow: '🤝 BUILD YOUR CIRCLE',
    title: 'Connect with friends',
    body: "When friends accept your request, their open Sparks show up here automatically.",
    ctaLabel: 'Manage friends →',
    iconTint: 'oklch(0.55 0.18 310 / 0.18)',
    icon: '🤝',
  },
  'prompt-template': {
    labelNote: 'Prompt template',
    eyebrow: '✦ NEED INSPIRATION?',
    title: '', // overridden below from template
    body: '',
    ctaLabel: 'Use this prompt →',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
    icon: '✦',
  },
  'enter-a-spark': {
    labelNote: 'Suggestion',
    eyebrow: '📝 TRACK YOUR ENTRIES',
    title: 'Enter a Spark to see it here',
    body: "Sparks you enter — yours or anyone else's — collect in the Entered tab so you can track results.",
    ctaLabel: 'Browse open Sparks →',
    iconTint: 'oklch(0.6 0.15 150 / 0.18)',
    icon: '📝',
  },
  'create-first': {
    labelNote: 'Suggestion',
    eyebrow: '⚡ START WRITING',
    title: "You haven't written a Spark yet",
    body: 'Got a prompt nagging at you?',
    ctaLabel: '+ New Spark',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
    icon: '⚡',
  },
}

function ctaHref(variant: GhostVariant, locale: string, promptTemplate?: PromptTemplate, trendingSpark?: GhostCardProps['trendingSpark']): string {
  switch (variant) {
    case 'from-discover':
      return trendingSpark
        ? `/${locale}/discover/spark/${trendingSpark.id}`
        : `/${locale}/discover?tab=sparks`
    case 'follow-writers':
      return `/${locale}/discover?tab=sparks`
    case 'connect-friends':
      return `/${locale}/friends`
    case 'prompt-template': {
      if (!promptTemplate) return `/${locale}/sparks/new`
      const sp = new URLSearchParams()
      sp.set('prompt', promptTemplate.prompt)
      sp.set('wordLimit', String(promptTemplate.wordLimit))
      return `/${locale}/sparks/new?${sp.toString()}`
    }
    case 'enter-a-spark':
      return `/${locale}/discover?tab=sparks`
    case 'create-first':
      return `/${locale}/sparks/new`
  }
}

export function GhostCard({ variant, locale, onDismiss, promptTemplate, trendingSpark }: GhostCardProps) {
  const copy = COPY[variant]
  const title =
    variant === 'prompt-template' && promptTemplate
      ? `"${promptTemplate.prompt}"`
      : variant === 'from-discover' && trendingSpark
      ? trendingSpark.title
      : copy.title
  const body =
    variant === 'prompt-template' && promptTemplate
      ? `${promptTemplate.wordLimit} words. Open prompt in the New Spark form.`
      : copy.body
  const href = ctaHref(variant, locale, promptTemplate, trendingSpark)

  return (
    <div
      className="relative rounded-2xl p-[18px] flex flex-col gap-3 justify-between"
      style={{
        border: '1.5px dashed rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.015)',
        minHeight: 200,
      }}
    >
      <button
        type="button"
        onClick={() => onDismiss(variant)}
        aria-label={`Dismiss ${copy.labelNote}`}
        className="absolute top-2 right-2 p-1 rounded hover:bg-white/5"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        <X size={12} aria-hidden="true" />
      </button>

      <div
        className="absolute top-2 left-3 px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-[0.08em]"
        style={{
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {copy.labelNote}
      </div>

      <div className="pt-5">
        <div
          className="inline-flex items-center justify-center rounded-xl text-lg"
          style={{ width: 36, height: 36, background: copy.iconTint }}
          aria-hidden="true"
        >
          {copy.icon}
        </div>
        <div
          className="text-[9px] font-bold uppercase tracking-[0.1em] mt-3"
          style={{ color: 'var(--canvas-dark-ink-faint)', fontFamily: 'var(--font-mono)' }}
        >
          {copy.eyebrow}
        </div>
        <div
          className="text-[15px] font-bold mt-2 leading-tight"
          style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
        >
          {title}
        </div>
        {body ? (
          <div
            className="text-[12px] mt-1.5 leading-snug"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {body}
          </div>
        ) : null}
      </div>

      <Link
        href={href}
        className="text-[12px] font-bold inline-flex items-center"
        style={{ color: 'var(--brand)' }}
      >
        {copy.ctaLabel}
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/\(public\)/sparks/_components/ghost-card.tsx app/[locale]/\(public\)/sparks/_components/use-dismissed-ghosts.ts
git commit -m "feat(sparks/hub): GhostCard — 6 variants + localStorage dismissal hook."
```

---

## Task 6: Page integration

**Files:**
- Modify: `app/[locale]/(public)/sparks/page.tsx`
- Create: `app/[locale]/(public)/sparks/_components/sparks-grid.tsx`

The page currently renders the grid inline. We extract the grid+ghosts into a client component so it can consume the dismiss hook and interleave ghosts after real cards.

- [ ] **Step 1: Create `<SparksGrid>` client component**

```tsx
// app/[locale]/(public)/sparks/_components/sparks-grid.tsx
'use client'

import { SparkCard } from '../../discover/_components/spark-card'
import { GhostCard } from './ghost-card'
import { pickGhosts } from './pick-ghosts'
import { useDismissedGhosts } from './use-dismissed-ghosts'
import type { CommunitySparkRow } from '@/lib/actions/sparks-hub.actions'
import type { SparksTab } from './sparks-tab-strip'
import type { PromptTemplate } from '@/lib/sparks/prompt-templates'

type Props = {
  sparks: CommunitySparkRow[]
  tab: SparksTab
  locale: string
  bucketCounts: { all: number; yours: number; following: number; friends: number; entered: number }
  promptTemplate: PromptTemplate
  trendingSpark: { id: string; title: string; entryCount: number; deadline: Date | string | null } | null
}

export function SparksGrid({ sparks, tab, locale, bucketCounts, promptTemplate, trendingSpark }: Props) {
  const { dismissed, dismiss } = useDismissedGhosts()

  const ghosts = pickGhosts({
    tab,
    realCount: sparks.length,
    followingCount: bucketCounts.following,
    friendsCount: bucketCounts.friends,
    enteredCount: bucketCounts.entered,
    ownCount: bucketCounts.yours,
    dismissed: new Set(dismissed),
  })

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        justifyItems: 'start',
      }}
    >
      {sparks.map(s => (
        <SparkCard key={s.id} spark={s} locale={locale} sourceTag={s.source} size="md" />
      ))}
      {ghosts.map((variant, i) => (
        <GhostCard
          key={`ghost-${variant}-${i}`}
          variant={variant}
          locale={locale}
          onDismiss={dismiss}
          promptTemplate={promptTemplate}
          trendingSpark={trendingSpark}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Read the current page**

Run: `cat app/[locale]/\(public\)/sparks/page.tsx` and note (a) the `maxWidth: '1920px'` line and (b) where the grid renders.

- [ ] **Step 3: Rewrite page composition**

Edit `app/[locale]/(public)/sparks/page.tsx`:

3a. Change `maxWidth: '1920px'` → `maxWidth: '1680px'`.

3b. Add imports at top:
```ts
import { SparksRightRail } from './_components/sparks-right-rail'
import { SparksGrid } from './_components/sparks-grid'
import { pickPromptTemplate } from '@/lib/sparks/prompt-templates'
import { getTrendingSparksForRailAction } from '@/lib/actions/sparks-rail.actions'
```

3c. After the `getCommunitySparksAction` result destructure, parallel-fetch the trending spark for the ghost card:
```ts
const trendingR = await getTrendingSparksForRailAction({ limit: 1 })
const trendingSpark = trendingR.success && trendingR.data[0]
  ? {
      id: trendingR.data[0].id,
      title: trendingR.data[0].title,
      entryCount: trendingR.data[0].entryCount,
      deadline: trendingR.data[0].deadline,
    }
  : null
const promptTemplate = pickPromptTemplate(viewerId)
```

3d. Wrap the page body in a 2-column grid layout. Replace `<main className="mx-auto w-full px-6 pt-7 pb-6" style={{ maxWidth: '1920px' }}>` with:
```tsx
<main
  className="mx-auto w-full px-6 pt-7 pb-6"
  style={{ maxWidth: '1680px' }}
>
  <div
    className="grid gap-8 items-start"
    style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}
  >
    <div className="min-w-0">
      {/* existing header + tabs + sort row + (replaced) grid */}
    </div>
    <SparksRightRail locale={locale} />
  </div>
</main>
```

3e. Replace the inline `<div className="grid gap-4" ...>…sparks.map…</div>` with:
```tsx
{sparks.length === 0 ? (
  <SparksEmptyState tab={tab} locale={locale} />
) : (
  <>
    <SparksGrid
      sparks={sparks}
      tab={tab}
      locale={locale}
      bucketCounts={bucketCounts}
      promptTemplate={promptTemplate}
      trendingSpark={trendingSpark}
    />
    <SparksHubPagination ... existing props ... />
  </>
)}
```

3f. The `xl:flex` Tailwind class on `<SparksRightRail>` collapses the rail below 1280px viewport so the grid spans full width on smaller screens. Adjust the grid layout to be responsive:
```tsx
<div
  className="grid gap-8 items-start xl:grid-cols-[minmax(0,1fr)_300px] grid-cols-1"
>
```

- [ ] **Step 4: Verify tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean, full suite still green

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(public\)/sparks/page.tsx app/[locale]/\(public\)/sparks/_components/sparks-grid.tsx
git commit -m "feat(sparks/hub): page integration — 2-col layout + ghost interleaving + 1680px width."
```

---

## Task 7: Smoke + AGENTS.md bookkeeping

- [ ] **Step 1: Manual smoke**

Start dev server (`npm run dev`) and visit `/en/sparks` as your authenticated user. Verify:

1. Page width matches `/studio` (1680px max).
2. Right rail renders on the right side (viewport ≥ 1280px).
3. Suggested writers panel shows 0-4 rows (hidden if 0).
4. Trending now panel shows top sparks or empty-state copy.
5. Your spark stats panel shows 4 tiles (Created emphasized brand-yellow).
6. With 1 real spark in the All tab, you see 1 real card + 5 ghost cards (6 total).
7. Ghost cards have dashed border + corner label pill + dismiss `×`.
8. Click `×` on a ghost → it disappears, refresh page → still gone (localStorage persists).
9. Tab switch (e.g. Following with 0 real) → ghost mix changes (follow-writers prominent).
10. Sign in another browser → fresh ghost set (localStorage scoped per browser).
11. Click `Use this prompt →` on a prompt-template ghost → `/sparks/new?prompt=...&wordLimit=N` opens with prefilled fields. (NOTE: /sparks/new form needs to read these URL params; if it doesn't yet, that's a follow-up — log it.)
12. Resize viewport < 1280px → right rail disappears, grid takes full width.

- [ ] **Step 2: Update AGENTS.md "Resume Here"**

Bump `Last updated`, refresh `Last commit`, add a shipping summary block for the density pass (~30 lines), update `Next concrete step` to reflect smoke status.

- [ ] **Step 3: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "docs(agents): density pass shipped — 6 commits, smoke notes."
```

---

## Self-Review

**Spec coverage:**
- §"Right rail panels" — Task 2 (actions) + Task 3 (component) ✅
- §"Ghost cards" — Task 4 (helper) + Task 5 (component) + Task 6 (integration) ✅
- §"Per-tab ghost selection logic" — Task 4 covers the per-tab branches ✅
- §"Prompt template seed list" — Task 1 ✅
- §"Acceptance criteria" 1 (width 1680) — Task 6.3a ✅
- §"Acceptance criteria" 2 (right rail sticky) — Task 3 ✅
- §"Acceptance criteria" 3-5 (3 actions) — Tasks 2-3 ✅
- §"Acceptance criteria" 6-7 (ghost cap math) — Task 4 ✅
- §"Acceptance criteria" 8-9 (ghost visual) — Task 5 ✅
- §"Acceptance criteria" 10 (CTA routing) — Task 5 ✅
- §"Acceptance criteria" 11 (sort affects real only) — Task 6 (sort happens server-side before grid renders; ghosts always render last in fixed order) ✅
- §"Acceptance criteria" 12 (pagination ignores ghosts) — Task 6 (pagination wraps `SparksGrid` but only counts real sparks via `totalCount`) ✅

**Placeholder scan:** None found.

**Type consistency:** `GhostVariant`, `SparksTab`, `PromptTemplate`, `CommunitySparkRow` consistent across tasks.

**Known impl notes (not gaps):**
- Task 6 step 3 instruction is a recipe rather than a literal new file content because the page already has 165 LOC of careful URL/auth/redirect logic the implementer should preserve. Worth a careful read of the existing file first.
- `/sparks/new` reading `?prompt=` and `?wordLimit=` is implicit — Task 7 step 1.11 logs it as a follow-up if missing. Adding it to `CreateSparkForm` is a 10-line edit (read searchParams → set form defaults).
