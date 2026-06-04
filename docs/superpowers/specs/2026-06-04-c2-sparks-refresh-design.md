# C2 — Sparks Refresh (Design)

**Status:** Locked 2026-06-04. Awaiting plan-writing.
**Phase:** Second of 5 in the Community phase. See [community-phase-overview.md](2026-06-04-community-phase-overview.md) for the C1–C5 roadmap and cross-cutting commitments.
**Goal:** Port the richer features from the original beehive-books-online prompts system into the existing Sparks: optional entry titles with first-line fallback, one-level threaded comments, full PUBLIC/FRIENDS/PRIVATE visibility + discoverable flag, explicit status enum + customizable voting window, and canonical `/sparks/*` routes honoring the Community phase IA commitment.

---

## 1. Locked decisions (from brainstorm)

| # | Decision | Choice |
|---|---|---|
| Q1 | Entry titles | **B — Optional title.** First-line-of-body fallback when blank (Buzz precedent). |
| Q2 | Comment threading depth | **B — One-level.** Matches Hive Discussions (H3); enforced via `REPLY_DEPTH_EXCEEDED` predicate. |
| Q3 | Spark privacy | **A — PUBLIC/FRIENDS/PRIVATE three-tier** + new `discoverable` boolean. Matches book + hive + future C4 club pattern. |
| Q4 | Status machine | **B — Stored enum** (`OPEN | VOTING | CLOSED`) + explicit `voting_ends_at`. Lazy sweep on list/read (H4 word-goal precedent). |
| Q5 | Per-entry visibility | **A — Inherit parent spark visibility.** Simpler model; no separate `areFriends(viewer, entry.userId)` paths. |
| Q6 | Routes | **A — Move canonical to `/[locale]/(public)/sparks/*`.** 308 redirects from `/discover/spark/*` (SP-A precedent). |
| — | Entry like count | Denorm `like_count` on `spark_entries`, bumped in vote tx (H4 buzz_posts precedent). |
| — | Spark visibility in feed | All 3 C1 spark activity hooks (`spark_entry_submitted`, `spark_won_community`, `spark_won_creator_choice`) gated by `if (spark.visibility === 'PUBLIC')`. FRIENDS/PRIVATE sparks emit no feed events — matches books-don't-leak-via-feed posture from C1. See §3.4 hook table. |

---

## 2. Data model

### 2.1 Schema additions

All changes are **additive** — defaults preserve existing behavior.

**`sparks`** (4 new columns):

```
visibility       spark_visibility NOT NULL DEFAULT 'PUBLIC'
discoverable     boolean          NOT NULL DEFAULT true
status           spark_status     NOT NULL DEFAULT 'OPEN'
voting_ends_at   timestamp                                -- nullable; backfilled in migration
```

**`spark_entries`** (2 new columns):

```
title       text                       -- nullable; UI derives from content when blank
like_count  integer NOT NULL DEFAULT 0  -- denorm; bumped atomically in voteSparkEntryAction tx
```

**`spark_entry_comments`** (1 new column):

```
parent_id   text REFERENCES spark_entry_comments(id) ON DELETE CASCADE
            -- nullable; enforced one-level-only via REPLY_DEPTH_EXCEEDED predicate
            -- CASCADE on parent delete drops orphaned replies
```

### 2.2 New pgEnums

```
spark_visibility ∈ PUBLIC | FRIENDS | PRIVATE
spark_status     ∈ OPEN | VOTING | CLOSED
```

### 2.3 Migration

Idempotent runner at `scripts/migrate-c2.ts` (mirrors `migrate-h4.ts` shape):

1. Create `spark_visibility` enum (`DO $$ ... EXCEPTION WHEN duplicate_object`).
2. Create `spark_status` enum.
3. `ALTER TABLE sparks ADD COLUMN IF NOT EXISTS` for `visibility`, `discoverable`, `status`, `voting_ends_at`.
4. `ALTER TABLE spark_entries ADD COLUMN IF NOT EXISTS` for `title`, `like_count`.
5. `ALTER TABLE spark_entry_comments ADD COLUMN IF NOT EXISTS parent_id text REFERENCES spark_entry_comments(id) ON DELETE CASCADE`.
6. Backfill `spark_entries.like_count` from existing `spark_votes`:
   ```sql
   UPDATE spark_entries
   SET like_count = (SELECT count(*) FROM spark_votes WHERE entry_id = spark_entries.id)
   WHERE like_count = 0
   ```
7. Backfill `sparks.voting_ends_at` for existing rows where deadline is set:
   ```sql
   UPDATE sparks
   SET voting_ends_at = deadline + interval '48 hours'
   WHERE voting_ends_at IS NULL AND deadline IS NOT NULL
   ```

All steps wrapped in `IF NOT EXISTS` / `EXCEPTION WHEN duplicate_object` so re-runs are safe.

### 2.4 No new `social_activity_type` enum values

C1 already shipped `spark_entry_submitted`, `spark_won_community`, `spark_won_creator_choice`. C2 only adjusts the gates inside the existing hook calls (see §3.4).

---

## 3. Server actions

### 3.1 New helpers in `lib/sparks/`

**`lib/sparks/predicates.ts`** — mirrors `lib/hive/permissions.ts` layout.

- `canViewSpark(viewerId: string | null, spark: { creatorId, visibility }): Promise<boolean>`
  - `visibility === 'PUBLIC'` → true (unless blocked).
  - `visibility === 'FRIENDS'` → `viewerId !== null && areFriends(viewerId, creatorId)` (unless blocked).
  - `visibility === 'PRIVATE'` → `viewerId === creatorId`.
  - Block check (`isBlocked(viewerId, creatorId)` either direction) → false everywhere (masquerade).

- `canEnterSpark(viewerId: string | null, spark: { creatorId, visibility, status }): Promise<boolean>`
  - All of: `canViewSpark(...)`, `status === 'OPEN'`, `viewerId !== spark.creatorId`.

- `canVoteSpark(viewerId: string | null, spark: { creatorId, visibility, status }): Promise<boolean>`
  - All of: `canViewSpark(...)`, `status === 'VOTING'`, `viewerId !== null`.

**`lib/sparks/derive-title.ts`** — small pure helper.

- `deriveTitle(explicitTitle: string | null, content: string): string`
  - If `explicitTitle?.trim()`, return trimmed.
  - Else first line of `content` truncated to 80 chars.
  - Else `"Untitled entry"`.

### 3.2 Lazy sweep helper

**`lib/sparks/sweep-status.ts`**:

```ts
export async function sweepSparkStatuses(): Promise<void> {
  await db.update(sparks)
    .set({ status: 'VOTING' })
    .where(and(eq(sparks.status, 'OPEN'), lt(sparks.deadline, sql`now()`)));

  await db.update(sparks)
    .set({ status: 'CLOSED' })
    .where(and(eq(sparks.status, 'VOTING'), lt(sparks.votingEndsAt, sql`now()`)));
}
```

Called inside `getSparksAction` and `getSparkAction` BEFORE the SELECT. Cost: two unconditional UPDATEs per spark list query, each touching at most a handful of rows in production. Acceptable.

### 3.3 Existing action modifications

| Action | Modification |
|---|---|
| `createSparkAction` | Zod schema gains `visibility` (default PUBLIC), `discoverable` (default true with `.transform()` coercing false when visibility !== PUBLIC — books precedent), `votingDurationHours` (default 48, range 1–720). Insert computes `votingEndsAt = deadline + votingDurationHours*3600*1000` (handle nullable deadline → null votingEndsAt). Inserts `status='OPEN'`. |
| `getSparksAction` | Calls `sweepSparkStatuses()` first. Then SELECT with viewer-scoped privacy filter applied post-fetch (PUBLIC + ((FRIENDS AND viewer is friend) OR (PRIVATE AND viewer is creator))). `isBlocked` filter on creator. |
| `getSparkAction` | Same sweep + `canViewSpark` gate. Returns `NOT_FOUND` when blocked or visibility-denied (block masquerade). |
| `submitSparkEntryAction` | Zod adds optional `title` (trim, max 120 chars). Pre-check `canEnterSpark(viewer, spark)` → return `NOT_ALLOWED` if false. C1's `recordSocialActivityTx` hook now gated `if (spark.visibility === 'PUBLIC')` — FRIENDS/PRIVATE entries don't flow to feed. |
| `updateSparkEntryAction` | Zod adds optional `title`. |
| `voteSparkEntryAction` | Tx wraps existing vote row insert/delete + `UPDATE spark_entries SET like_count = like_count +/- 1 WHERE id = $1` atomically. Pre-check `canVoteSpark`. |
| `getSparkEntriesAction` | Return rows include `title`, `likeCount`. Sort: `createdAt DESC` when spark.status === 'OPEN'; `likeCount DESC, createdAt DESC` when `VOTING` or `CLOSED`. |
| `getSparkEntryAction` | Return row includes `title`. |
| `setCreatorChoiceAction` | No changes. |

### 3.4 Activity-hook gates updated

C1 T8's hooks stay in place; only the gate conditions change:

| Event | Old gate (C1) | New gate (C2) |
|---|---|---|
| `spark_entry_submitted` | always fires | `spark.visibility === 'PUBLIC'` |
| `spark_won_community` | always fires | `spark.visibility === 'PUBLIC'` |
| `spark_won_creator_choice` | always fires | `spark.visibility === 'PUBLIC'` |

Rationale: FRIENDS-tier sparks don't leak entries to non-friend followers via the feed. Same posture as books in C1 §3.4.

### 3.5 New comment action

**`replyToSparkCommentAction({ entryId, parentId, content })`** — new in `lib/actions/sparks.actions.ts`:

- `requireAuth` → Zod parse → fetch parent.
- One-level enforcement: if `parent.parentId !== null` → return `REPLY_DEPTH_EXCEEDED` (H3 precedent).
- Pre-check `canViewSpark(viewer, parentSpark)` on the entry's spark.
- Block check on parent author.
- Insert with `parentId` set.

**Existing `commentOnSparkEntryAction`** (or whatever the current top-level-create action is named — verify): no signature change; just continues to insert with `parentId = null`.

**Existing comment listing** extended return shape: includes `parentId` so UI can group. Two-query stitch-in-JS pattern (H4 buzz precedent) — fetch top-level + IN-list replies + Map.

---

## 4. Route migration

### 4.1 New canonical routes

Create `app/[locale]/(public)/sparks/`:

- `page.tsx` — `/sparks` index. Three stacked sections + header:
  - Header: page title + "+ New Spark" CTA (opens existing `<CreateSparkModal>`).
  - **Active sparks** — `status='OPEN'` filtered through `canViewSpark`. 3-col grid of `<SparkCard>`. Empty state: "No active sparks. Be the first to start one."
  - **Voting now** — `status='VOTING'`. Smaller list. Each card surfaces countdown to `votingEndsAt`.
  - **Past sparks** — `status='CLOSED'`. Collapsed accordion list with winner displayed.
- `[sparkId]/page.tsx` — spark detail page.
- `[sparkId]/entry/[entryId]/page.tsx` — entry reader.

Each is a `git mv`-style port from the existing `/discover/spark/*` page (preserve all server logic, just update import paths + add the new fields to rendering).

### 4.2 Redirects from old paths

At `app/[locale]/(public)/discover/spark/[sparkId]/page.tsx` (and the nested entry route):

```tsx
import { permanentRedirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ locale: string; sparkId: string }> }) {
  const { locale, sparkId } = await params;
  permanentRedirect(`/${locale}/sparks/${sparkId}`);
}
```

(Same 8-line shim pattern SP-A used for `/discover/book/[id]` → `/books/[id]`.)

### 4.3 Internal href audit

Find every production `<Link>` pointing at `/discover/spark/*` and update to `/sparks/*` directly so internal nav skips the 308:

- `<SparkCard>` in `_components/`
- `<SparkEntryCard>` if it links back to the spark
- `<ActiveSparksPanel>` in `app/[locale]/(app)/community/_components/sidebar/`
- `/community` section rail Sparks tile (was `/discover?tab=sparks`, becomes `/sparks`)
- Any `<Link>` in `/u/[username]/page.tsx` profile pointing at sparks
- Any feed `<ActivityEventRow>` rendering for `spark_*` event types

---

## 5. UI changes

### 5.1 `<CreateSparkModal>` extensions

Gains three new form rows (keep at existing path `app/[locale]/(public)/discover/_components/create-spark-modal.tsx` — invoked from both /discover and the new /sparks):

1. **`<VisibilityPicker>`** — 3-card radio (Private / Friends / Public) reusing the shape from `components/book/sharing-controls.tsx`. Lock/Users/Globe lucide icons.
2. **Discoverable checkbox** — `disabled` + force-cleared via `useEffect` watching `visibility` (3-layer defense from books).
3. **Voting window picker** — segmented control with 4 options (24h / 48h / 72h / 1 week). Default 48h.

### 5.2 `<SparkSubmitPanel>` — optional title input

Above the existing content textarea, add a small input:

```tsx
<input
  type="text"
  placeholder="Optional — leave blank to derive from your first line."
  maxLength={120}
  className="<recessed input chrome>"
/>
```

### 5.3 `<SparkEntryCard>` — title rendering

Display `deriveTitle(explicitTitle, content)` as the Comfortaa bold headline (matches book + buzz entry-title pattern). Existing excerpt rendering stays beneath.

### 5.4 `<SparkEntryComments>` — threaded rendering

Rewrite to render two-level structure:

```
+-- Comment A
|   author + relTime + body
|   [Reply] button → opens inline composer for reply to A
|   +-- Reply A1 (indented via ml-8 border-l)
|   +-- Reply A2
+-- Comment B
|   ...
```

Reply button on top-level comments opens an inline composer mounted in the same card. Replies do NOT have their own Reply button (one-level enforced visually + server-side). Replies indent via `ml-8 border-l border-[var(--br-card)] pl-4`.

### 5.5 Spark detail page header

Above the existing meta strip:

- **Status pill** (alpha-tinted, mirrors `<HivePill>` shape):
  - OPEN → `--status-success` (gold)
  - VOTING → `--brand` (brand-yellow)
  - CLOSED → `--canvas-dark-ink-muted` (neutral)
- **Visibility pill**: Globe/Users/Lock + label.
- **Countdown text** when `status === 'VOTING'`: "Voting ends in 18h" (relative).

### 5.6 `<SparkCard>` (index + sidebar)

Adds visibility pill (Globe/Users/Lock + small label) next to the existing title row. Status pill if not OPEN.

### 5.7 `/community` section rail tile update

The Sparks tile's `href` flips from `/${locale}/discover?tab=sparks` to `/${locale}/sparks`.

### 5.8 Out of scope (deferred)

- Visual chrome refresh of Spark surfaces (cards, detail page polish) — C2 is feature parity + IA, NOT visual redesign. A future Claude Design handoff pass refreshes the surfaces.
- A `/sparks` search input — defer to C5 polish.
- Per-comment likes (separate from per-entry likes) — original Prompts had it; defer unless users ask.
- @-mentions inside spark comments — defer to C5 mentions subsystem.

---

## 6. Privacy + block enforcement summary

| Surface | Gate |
|---|---|
| `/sparks` index | `canViewSpark` per-row filter |
| `/sparks/[sparkId]` detail | `canViewSpark` → `NOT_FOUND` masquerade if blocked or denied |
| `/sparks/[sparkId]/entry/[entryId]` reader | Same as detail |
| `submitSparkEntryAction` | `canEnterSpark` |
| `voteSparkEntryAction` | `canVoteSpark` |
| `commentOnSparkEntryAction` (existing) | `canViewSpark` + block check on entry author |
| `replyToSparkCommentAction` (new) | Same + `REPLY_DEPTH_EXCEEDED` if parent has parent |
| `/discover` Sparks tab listing | Filter via `canViewSpark` (already partially gated; verify) |
| `/community` sidebar `<ActiveSparksPanel>` | Same |
| Feed events (`spark_*`) | Gated at write time per §3.4 |

Block masquerade everywhere: never reveal the block exists. Same posture as C1 books + profiles.

---

## 7. Test posture

Following AGENTS.md convention: unit tests for pure helpers + surface-shape tests for server actions + manual smoke for UI.

- **`lib/sparks/__tests__/derive-title.test.ts`** — 4 tests (explicit title, first-line fallback, empty content, max 80 chars).
- **`lib/sparks/__tests__/predicates.test.ts`** — `canViewSpark` (4 cases × 3 visibility tiers + block paths), `canEnterSpark` (status × ownership grid), `canVoteSpark`.
- **`lib/sparks/__tests__/sweep-status.test.ts`** — sweep correctness (OPEN past deadline → VOTING; VOTING past votingEndsAt → CLOSED; idempotent).
- **Surface-shape tests** for `replyToSparkCommentAction` + the modified actions (mirror `reading-actions.test.ts`).
- **Migration test**: re-running `migrate-c2.ts` succeeds with 7 ✓ steps both runs (idempotency).

Manual smoke per AGENTS.md preference; T13 includes a carry-forward checklist mirroring C1 §13.

---

## 8. Implementation phasing (preview)

Suggested task breakdown for the implementation plan:

| Task | Title |
|---|---|
| T1 | Schema migration + enum additions + backfills |
| T2 | `predicates.ts` + `derive-title.ts` + `sweep-status.ts` + unit tests |
| T3 | `createSparkAction` modification (visibility/discoverable/votingDuration/votingEndsAt) |
| T4 | `getSparksAction` + `getSparkAction` (sweep + canViewSpark gate) |
| T5 | `submitSparkEntryAction` + `updateSparkEntryAction` (title + canEnterSpark) |
| T6 | `voteSparkEntryAction` (likeCount denorm) + `getSparkEntriesAction` (sort by likeCount when VOTING/CLOSED) |
| T7 | `replyToSparkCommentAction` + comment list reshape with parentId |
| T8 | Activity-hook gate updates (C1 hook conditions) |
| T9 | New `/sparks/*` routes (3 pages) + ports of existing logic |
| T10 | 308 redirect shims + internal href audit |
| T11 | `<CreateSparkModal>` form additions (visibility / discoverable / voting duration) |
| T12 | `<SparkSubmitPanel>` title input + `<SparkEntryCard>` title rendering |
| T13 | `<SparkEntryComments>` threaded rewrite |
| T14 | Spark detail header (status + visibility pills + countdown) |
| T15 | `<SparkCard>` visibility/status pills + community section rail tile update |
| T16 | Smoke + AGENTS.md update + ship |

Each task independently shippable; tests gate per-task; full suite stays green throughout (475/475 baseline + additions).

---

## 9. Out of scope (deferred to later phases)

| Item | Defer to |
|---|---|
| Per-entry visibility (entries opt-down from parent) | Never (Q5 decision) — revisit only if users ask |
| Per-comment likes | C5 polish |
| @-mentions in comments | C5 mentions subsystem |
| Reading-list-style "my sparks" management page | Future polish if needed |
| `/sparks` search input | C5 polish |
| Visual chrome refresh of Spark surfaces | Future Claude Design handoff |
| Custom voting window beyond 4 segmented options | Deferred until users request granular control |

---

*End of C2 spec. Next step: writing-plans skill to produce the task plan.*
