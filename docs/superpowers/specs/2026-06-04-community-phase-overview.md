# Community Phase — Overview (C1–C5)

**Status:** Active. C1 spec is locked (2026-06-04). C2–C5 deferred until C1 ships.
**Goal:** Turn `/community` from a placeholder hive-activity feed into the social-media-hub layer of Beehive Studio. Discover stays the "explore strangers' writing" surface; Community becomes the "what your circle is doing + group activity you're part of" surface.

## Decomposition

This phase is too large for one spec. Following the H1–H5 Hives precedent, it ships as 5 independent sub-projects. Each gets its own brainstorm → spec → plan → ship cycle. Resume sessions should consult the latest C-phase spec to know where things stand.

| Phase | Title | Scope summary | Status |
|---|---|---|---|
| **C1** | Foundation: friends + /community shell + feed | Friendship + follow graph, blocks/mutes, invite-by-link, /community hub IA, activity feed event store, /friends page, profile-page friendship UI, nav user dropdown, FRIENDS visibility enforcement | Spec locked 2026-06-04 |
| **C2** | Sparks refresh | Port richer features from beehive-books-online's prompts: per-entry titles, full content storage, threaded entry comments, community-vote + creator's-choice winners as separate fields, scoped privacy. Activity-feed integration via C1's `social_activity` | Pending |
| **C3** | Reading Lists | Net-new: curated lists of books with currently-reading marker, ratings, per-book commentary, follow/like, tags, visibility (PUBLIC/FRIENDS/PRIVATE). Activity-feed integration | Pending |
| **C4** | Book Clubs | Net-new: group around a current book, threaded discussions with pinned support, member roles (OWNER/MOD/MEMBER), progress tracking, optional reading-list linkage. Activity-feed integration | Pending |
| **C5** | Polish + net-new social features | Mentions (@username parsing + notifications), notification preferences, friends-list visible on profile (P5 toggle), per-friend feed prioritization, recommendation tuning. Final UI pass via Claude Design | Pending |

## Cross-cutting commitments locked in C1

These constrain every later phase and must NOT be re-litigated without an amendment to this overview:

1. **Friend model is Friends + Follows (both).** Mutual ACCEPTED `friendships` rows gate FRIENDS-tier content; one-way `follows` rows drive low-friction discovery.
2. **No friend groups.** Flat friends list. Named subgroups are served by Hives (writing) and Book Clubs (reading).
3. **Activity feed runs on `social_activity` table** (append-only event store, mirrors `hive_activity` pattern). Every C2–C5 source action that produces feed content must extend the `social_activity_type` enum and write via `recordSocialActivityTx` in its source tx.
4. **Privacy gates use `areFriends()` + `isBlocked()` helpers.** Any new visibility-aware surface (Reading Lists, Book Clubs, future) calls these. Don't introduce parallel gate helpers.
5. **Blocks are global + cascading.** Block in either direction wipes existing friendship + follows in both directions. Every new social surface must respect `isBlocked` before rendering profile/content.
6. **/community is the hub.** Sub-systems live at their own routes (`/friends`, `/hives`, `/sparks`, `/reading-lists`, `/clubs`). `/community` renders feed + section rail + lean attention sidebar — never grows into a giant index of everything.
7. **Visual design is deferred to Claude Design.** Specs lock IA, data shape, behavior. Visual polish is a separate handoff per the editor refresh / hive refresh precedent.

## Where new event types are added

When a new social surface fires feed events, the migration sits in that sub-project's spec, not here. Pattern:

```sql
ALTER TYPE social_activity_type ADD VALUE 'reading_list_created';
ALTER TYPE social_activity_type ADD VALUE 'reading_list_followed';
-- ... etc
```

Add new payload shape comments next to the new event type's `recordSocialActivityTx` call.

## Resume-session protocol

A fresh Claude session reading CLAUDE.md should:

1. Locate the current C-phase from CLAUDE.md "Resume Here" block.
2. Find that phase's spec doc at `docs/superpowers/specs/YYYY-MM-DD-c{N}-*.md`.
3. Read this overview to understand inherited constraints.
4. Continue from "Next concrete step" in the Resume Here block.

## C2–C5 deferred questions (do not answer here)

The questions below are NOT decided. They will be brainstormed at the start of each phase. Listed here so they don't get forgotten:

- **C2 Sparks refresh:** Should Spark entries themselves carry per-entry visibility (PUBLIC/FRIENDS) independent of the parent Spark? Threaded comments — match the spec'd hive_discussion_posts one-level rule, or allow deeper nesting?
- **C3 Reading Lists:** Collaborative lists (multiple owners) yes/no? Auto-populated lists (e.g. "books you've liked") yes/no? Books-not-in-Beehive (free-text title/author) yes/no?
- **C4 Book Clubs:** Reading schedule (per-chapter milestones) yes/no? Required membership approval vs open-join? Cross-book continuity (club survives past one book)?
- **C5:** @-mention rules (who can mention whom under block/mute), notification batching strategy, friend-feed prioritization algorithm.

---

*This overview is amended only when a C-phase ships and its outcome changes the shape of later phases. Routine progress updates live in CLAUDE.md.*
