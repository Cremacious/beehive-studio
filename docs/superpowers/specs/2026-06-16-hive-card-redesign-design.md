# Hive Card Redesign + Suggested Hives — Design Spec

**Date:** 2026-06-16
**Surfaces:** `/[locale]/hives` (the hub), `/[locale]/discover?tab=hives` + `/discover/hives/...` sub-routes
**Goal:** Lock V2 (avatar-stack hero) as the single canonical hive-card shape across the hub + discover surfaces; rename `Open` tab to `Suggested`; introduce a real `getSuggestedHivesAction` that ranks by friend-membership and friend-of-friend signals; extend the "Trending hives" rail panel to viewport height.

---

## Card shape — V2 universal

**One card design across all hive surfaces.** Avatar-stack hero is the hero for every hive, linked or standalone.

### Anatomy (V2)

- **Outer:** 14px radius, gradient bg `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`, shadow `var(--sh-tile)`, `min-height: 220px`, `padding: 18px 16px 14px`, `display: flex flex-col gap-3 items-center text-center`.
- **Top-right role pill (absolute):** mono uppercase 9px, padding `3px 7px`, `border-radius: 999px`. Per source:
  - `OWNER` — brand-yellow tint, brand-yellow text, ⭐ glyph
  - `MOD` — soft blue tint, blue text
  - `MEMBER` — soft purple tint, purple text
  - `SUGGESTED` — soft green tint (`oklch(0.6 0.15 150 / 0.18)`), green text (`oklch(0.75 0.15 150)`), ✦ glyph
- **Avatar stack (centered, hero):** 36×36 circles with 3px `var(--canvas-dark-250)` border, overlap `-10px margin-left`. Up to 4 visible + `+N` overflow chip in the same shape (`background: rgba(255,255,255,0.08)`). When `memberCount === 0` (impossible but defensively) render a single placeholder.
- **Hive name (Comfortaa bold 15px):** centered, `var(--canvas-dark-ink-strong)`, `line-clamp-2`.
- **Eyebrow (mono uppercase 10px):** centered, `var(--canvas-dark-ink-muted)`, `letter-spacing: 0.06em`. Content: `AROUND {BOOK_TITLE}` when linked, `STANDALONE HIVE` when not.
- **Why-suggested line (suggested cards only):** full-width inside the card, `background: oklch(0.6 0.15 150 / 0.08)`, `border-left: 2px solid oklch(0.6 0.15 150)`, `padding: 6px 10px`, `border-radius: 4px`, font 11px, content like `**@testguy3** is a member` or `**3 friends** are members` or `**2 mutuals** via @mayareyes` (the `<strong>` is `color: oklch(0.75 0.15 150)`).
- **Footer (mt-auto, border-t):** flex justify-between, mono 10px uppercase. Left: activity pulse + `Active 8h ago` (only when `lastActiveAt` non-null). Right: `WORD GOAL · 48%` (only when active goal); else nothing (drop "X SLOTS" entirely per user direction).

### Suggested-card differentiation (3 signals)

1. **Border:** `2px dashed oklch(0.6 0.15 150 / 0.45)` — thicker than the prior mockup (which was 1.5px) per user direction.
2. **Background shift:** swap base gradient to `linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))` (one stop darker so the dashed border has contrast).
3. **`SUGGESTED` role pill + ✦ glyph** in the top-right slot.
4. **Why-suggested line** between the eyebrow and footer.

### Click target

- `source IN ('yours', 'member')` → `/${locale}/hive/${id}` (existing dashboard route)
- `source === 'suggested'` → `/${locale}/hive/${id}` IF viewer is allowed to view (PUBLIC + discoverable). Open hives in dev DB confirm this works since they're already public-readable. For private/friends-locked hives shown by suggestion (e.g. friend's private hive), fall through to `/discover?tab=hives` (the existing fallback we used for the trending rail).

---

## "Suggested" rename + smart sourcing

### Tab rename
- `HivesTab` union: `'all' | 'yours' | 'member' | 'open'` → `'all' | 'yours' | 'member' | 'suggested'`
- Label: `Open` → `Suggested`
- URL backward compat: `/hives?tab=open` → 308 redirect to `/hives?tab=suggested`

### New action — `getSuggestedHivesAction({ limit })`

Replaces the current `getDiscoverableHivesAction` call inside `getCommunityHivesAction` for the Suggested-tab bucket. The hub aggregator now imports both: `getSuggestedHivesAction` for the bucket fill, and the existing trending/discover endpoints for the rail panels (which stay popularity-ranked, not friend-ranked).

**Ranking strategy** — fetched in tiers, deduped, sliced to `limit`:

**Tier 1 — Friend-membership.** Hives where someone the viewer follows is a member.
```sql
SELECT h.id, ... , COUNT(DISTINCT f_member.user_id) AS friend_count
FROM hives h
INNER JOIN hive_members hm ON hm.hive_id = h.id
INNER JOIN follows f_member ON f_member.followee_id = hm.user_id AND f_member.follower_id = $viewer
LEFT JOIN viewer_member vm ON vm.hive_id = h.id  -- exclude hives viewer is already in
WHERE h.visibility = 'PUBLIC' AND h.discoverable = true AND vm.id IS NULL
GROUP BY h.id, ...
ORDER BY friend_count DESC, h.created_at DESC
```

**Tier 2 — Friend-of-friend.** Hives where a follow-of-a-follow is a member, excluding tier 1.
```sql
SELECT h.id, ...
FROM hives h
INNER JOIN hive_members hm ON hm.hive_id = h.id
INNER JOIN follows f1 ON f1.followee_id = hm.user_id    -- FoF: follower (f1.follower) follows hm.user
INNER JOIN follows f2 ON f2.followee_id = f1.follower_id AND f2.follower_id = $viewer
                                                          -- viewer follows f2.followee, who follows hm.user
WHERE h.visibility = 'PUBLIC' AND h.discoverable = true
  AND h.id NOT IN ($tier1_ids)
  AND h.id NOT IN ($viewer_hive_ids)
GROUP BY h.id, ...
ORDER BY COUNT(DISTINCT f2.followee_id) DESC, h.created_at DESC
```

**Tier 3 — Trending-ish fallback.** Public + discoverable hives the viewer hasn't already been suggested by tier 1/2, ranked by recent activity. Reuses the trending-rail query shape.

**Stitching:** concatenate Tier 1 → Tier 2 → Tier 3, dedupe by `hive.id`, slice to `limit` (Suggested tab limit = 100 for hub use; rail uses limit=3).

### Return shape extension

`CommunityHiveRow` gains a `suggestionReason: string | null` field for suggested-source rows. Set per tier:
- Tier 1: `"@{username} is a member"` (use the friend with most-recent activity in the hive); when multiple, `"{N} friends are members"` for N ≥ 2.
- Tier 2: `"{N} mutuals via @{username}"` where `{username}` is the intermediate follow.
- Tier 3: `null` (falls back to a generic eyebrow; the why-suggested line is hidden when null).

When `suggestionReason === null`, the card hides the why-suggested line entirely.

### Action file location

`lib/actions/hives-suggested.actions.ts` — new file. Exports `getSuggestedHivesAction({ limit, viewerId })`. The hub aggregator calls it from inside `getCommunityHivesAction`, replacing the current `getDiscoverableHivesAction` call for the Suggested-tab path. The existing `getDiscoverableHivesAction` is preserved for `/discover` consumers — not touched.

---

## Apply V2 card across `/discover` hive routes

The `/discover?tab=hives` slice and `/discover/hives/...` sub-routes currently use `RailHiveCard` (a 280px-wide rail card) and `DiscoverHiveCard` (the grid card for the deepened tab). Both ship today via the H1-H5 wave (D2b Hives slice). The V2 redesign replaces both with a single canonical `<HiveHubCard>` rendered consistently across hub + discover surfaces.

**Strategy:**
1. Promote `<HiveHubCard>` (currently at `app/[locale]/(app)/hives/_components/hive-hub-card.tsx`) to a shared location: `components/hive/hive-card.tsx`.
2. Re-export from the old hub location for back-compat: `app/[locale]/(app)/hives/_components/hive-hub-card.tsx` becomes a thin re-export.
3. Update `discover-hive-card.tsx` + `rail-hive-card.tsx` + `discover-hub-hive-card.tsx` (if exists) to render the shared `<HiveCard>` instead of their custom shapes. Drop the dead-card files after.
4. `RailHiveCard` callers pass a slightly different prop shape — wrap with an adapter at the call site or widen `<HiveCard>`'s props to handle both shapes.

**Trade-off accepted:** rail surfaces (3-card sticky panels) were previously narrower; with the unified card they'll all render at the same ~280-320px width. Rail panels may need to widen to match, or rail surfaces just render fewer card variants. We'll smoke and adjust.

---

## Rail panel "Trending hives" extends to bottom

Current `<HivesRightRail>` has both panels stacked at natural height with sticky positioning. The user wants the Trending panel to fill the remaining viewport height with internal scroll.

**Change:** Make the rail a flex column that fills `calc(100vh - 100px)`. Stats panel stays its natural height. Trending panel `flex: 1` with `overflow-y: auto` body. So:

```tsx
<aside style={{ position: 'sticky', top: 80, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
  <RailPanel>Stats (fixed height)</RailPanel>
  <RailPanel style={{ flex: 1, overflow: 'hidden' }}>
    Trending {/* scroll inside */}
  </RailPanel>
</aside>
```

Trending limit bumps from 3 → 12 so the scroll has content.

---

## Acceptance criteria

1. `<HiveCard>` lives at `components/hive/hive-card.tsx`. All consumers (`/hives`, `/discover?tab=hives`, `/discover/hives/...`, rail panels) render this component.
2. Card uses V2 shape verbatim: avatar-stack hero centered, name+eyebrow centered, role pill top-right absolute.
3. Suggested cards: 2px dashed `oklch(0.6 0.15 150 / 0.45)` border, darker gradient backdrop, ✦ SUGGESTED pill, why-suggested line when `suggestionReason` is non-null.
4. Standalone hives render `STANDALONE HIVE` eyebrow (no book thumb at all — image rules respected).
5. Linked hives render `AROUND {BOOK TITLE}` eyebrow. Book cover NOT rendered on the card (V2 doesn't use one; only avatars).
6. Word-goal footer shows `WORD GOAL · N%` only when an active weekly goal exists; otherwise drops entirely (no "X SLOTS" text).
7. Hub tab strip: 4 tabs, last one labeled `Suggested` (not `Open`). URL contract: `?tab=suggested`. Legacy `?tab=open` redirects.
8. `getSuggestedHivesAction` ranks friend-members → FoF → trending fallback, deduped, returns `suggestionReason` per row.
9. `<HivesRightRail>` Trending panel fills `flex: 1` with `overflow-y: auto`; rail aside is `height: calc(100vh - 100px)` sticky.
10. Trending rail panel limit raised to 12 (with internal scroll).

---

## Out of scope (deferred)

- Activity pulse "live" indicator beyond the existing 8h-old read.
- Word-goal-percentage real calculation (`getViewerHiveStatsAction` still returns `weeklyGoalPct: 0` — separate follow-up).
- Member-avatar real fetching: T5 currently shows just `N members` text fallback because `UserHiveView` doesn't project `memberPreviews`. **In scope** for this spec: widen `getUserHivesView` to LEFT JOIN `hive_members` + `userProfiles` with a `ROW_NUMBER() OVER (PARTITION BY hive_id ORDER BY joined_at DESC) <= 4` window, project `memberPreviews: { userId, avatarUrl }[]`. Same projection added to `getSuggestedHivesAction` + `getTrendingHivesForRailAction`. This is needed for V2 to work at all — without real avatars the hero is empty.
- `/discover/hive/[id]` detail route (still missing; click target falls back to `/discover?tab=hives` as established).
- Following-hives tab (already deferred, separate spec eventually).

---

## Risks

1. **Card height variance.** Suggested cards with a why-suggested line are taller than yours/member cards without one. Grid uses `alignItems: stretch` so rows lock to tallest member — fine in practice but worth a smoke check.
2. **Sub-route discover hives may need different layout.** A 280px-wide rail card with 36×36 hero avatars may look different from a 320px-wide hub card. Smoke-check both.
3. **Friend-of-friend SQL cost.** The Tier 2 query does a double-self-join on `follows`. Cap with `LIMIT 30` per tier to keep the query cheap; production users typically have <100 follows.
4. **Trending panel scroll on small viewports.** Below xl the rail collapses entirely (`hidden xl:flex`) so this only matters at desktop+. Acceptable.
