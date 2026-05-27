# Hive ↔ Binder Integration — Design Spec

**Date:** 2026-05-27
**Status:** Approved (brainstorm), pending implementation plan
**Supersedes:** Hive content model defined in `db/schema/hive.ts` (`hiveOutlines`, `hiveWikiPages` semantics in particular)

---

## Problem

Today the studio binder and the Hive feature live in two disconnected worlds.

The writer's **binder** holds Research Notes, Outline beats, Character profiles, Scene Planner cards, and Front/Back Matter — all stored in `binderItems.content` (jsonb), plus prose in `chapters.content`. The **Hive** has its own parallel `hiveOutlines` (single text doc per hive) and `hiveWikiPages` table that contributors edit. The two never talk. If a writer wrote a 600-word character profile for Vargas in their binder, hive members don't see it. If a contributor drafts a wiki page about a town in the hive, it doesn't appear in the writer's binder.

The Hive feature's purpose is to **open the writer's book up to collaborators** — beta readers, editors, co-authors. That purpose is undermined when the writer's actual work product is invisible inside the hive, and contributor output is trapped outside the binder.

## Goals

1. The writer's binder content is visible and (per role) editable inside the hive — without copying it.
2. Contributor output (new characters, edits to existing artifacts, suggestions) appears in the writer's binder — without polluting the writer's "personal desk" feel.
3. The writer (OWNER) retains final authority over the canonical book at all times.
4. The hive surface adds the social layer (attribution, comments, suggestions, activity) without bleeding noise into the writer's binder.

## Non-goals

- Realtime multi-cursor co-editing (CRDT / Yjs). Punted to a later phase.
- Cross-book hives. A hive is bound to one `bookId` (already true in the schema).
- Public reading of in-progress work. That's `/discover`, not a hive concern.
- Re-architecting the binder itself. This spec describes additions, not replacements.

## The mental model — "one document, two windows"

Every shared artifact lives as a single canonical row in the database. The binder is the writer's private window onto that row. The hive is a social window onto the same row. Edits in either window mutate the same underlying record. The hive is not a copy of the book — the hive *is* the book, seen socially.

This rules out the alternatives we considered:

| Considered | Rejected because |
|---|---|
| Mirror (binder = source of truth, hive = read-only reflection) | Collaborators can only comment, never contribute. Defeats the purpose. |
| Adopt (publish/copy binder items into the hive as separate rows) | Drift is guaranteed. "Which version is real?" becomes a real question. |
| Shared with no writer gate | Writer loses the "private desk" feeling that defines Beehive's studio. |

## Decisions

### D1. Sharing scope — whole book, automatic

Creating a hive for Book X opens **every** binder item under Book X to hive members at their permitted role level. No per-item share toggle. Adding a new binder item later auto-appears in the hive.

Rejected: per-item opt-in (too much friction, contradicts "open the book up") and hybrid-by-type with Research Notes private (writer-preference-driven, but the user is the writer here and chose the simpler model).

### D2. Permission matrix

OWNER is the book creator. They assign roles and have final override on anything.

| Action | OWNER | EDITOR | CONTRIBUTOR | PROOFREADER | BETA_READER |
|---|---|---|---|---|---|
| Edit prose (chapter / FM-BM / character / notes) | direct | direct | suggest only | suggest only | — |
| Edit outline beats / scene planner cards | direct | direct | suggest only | — | — |
| **Add new** characters / wiki pages / notes | ✅ direct | ✅ direct | ✅ direct | — | — |
| Comment / inline annotation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve / reject suggestions | ✅ | ✅ | — | — | — |
| Delete an artifact | ✅ only | — | — | — | — |
| Change member roles | ✅ only | — | — | — | — |

**Two principles encoded:**
- **Additive contributions are direct.** A CONTRIBUTOR can draft a new side-character page without waiting for approval — that's how the hive feels alive.
- **Edits to existing artifacts are gated.** Modifying the writer's character or chapter goes through the suggestion flow (`hiveSuggestions`) until OWNER or EDITOR approves.

### D3. Hive-originated artifacts in the binder

When a CONTRIBUTOR adds a character or note in the hive, it appears in the writer's binder under the same folder it would naturally belong to. **No special "From Hive" folder. No acceptance queue.**

Attribution shows as a small avatar circle on the right side of the binder row, only when the most recent author is not the OWNER. Hover reveals fuller history ("Started by @sarah · Last edited by @marcus 2h ago").

OWNER's delete-anything power is the safety valve. Pre-acceptance was rejected because it would re-gate the additive contributions D2 deliberately ungated.

### D4. Concurrent editing — soft lock with takeover

Uses `hiveChapterLocks` infrastructure, extended beyond chapters.

- **Prose artifacts** (chapters, FM/BM, character profiles, research notes): one editor at a time. Others see "Sarah is editing — Take over" + read-only banner. Auto-releases after N minutes of inactivity (N to be picked in plan-phase; recommended 5 min).
- **Structural artifacts** (outline beats, scene planner cards, wiki page list): optimistic concurrency — just save, no lock. Conflicts are rare and small.
- **Comments, suggestions, discussion posts**: append-only, never locked.

Realtime multi-cursor was rejected as a deliberate scope choice — it's a multi-month infra project on its own (Yjs server, websocket hosting), and fiction writing rarely benefits from simultaneous typing in the same paragraph.

### D5. Social surface — tiered visibility

The binder stays quiet. The hive has a dedicated **Activity** tab. Notifications are conservative by default and per-user adjustable.

| Event | In-app notify | Email | Activity feed |
|---|---|---|---|
| Suggestion needs my review | ✅ | daily digest | ✅ |
| My suggestion got approved/rejected | ✅ | — | ✅ |
| @mention in comment | ✅ | immediate | ✅ |
| Chapter submitted for review | ✅ | immediate | ✅ |
| Member joined / left | ✅ | — | ✅ |
| New wiki/character added | badge only | — | ✅ |
| Existing artifact edited | — | — | ✅ |
| Artifact opened/closed | — | — | — |

Per-user notification settings panel scoped to each hive.

## Schema implications

These are the consequences for existing Hive tables. A future plan-phase needs to resolve each one; flagging here so they don't surprise us.

### S1. `hiveOutlines` and `hiveWikiPages` get retired or repurposed

Under "one doc, two windows," the hive's outline *is* the binder's outline; the hive's wiki pages *are* the binder's character/note items. We do not need parallel tables.

Two options for the plan-phase to weigh:
- **Migrate-and-drop:** read any existing `hiveOutlines` / `hiveWikiPages` content into corresponding `binderItems` rows on a per-hive basis, then drop the tables.
- **Deprecate-and-shadow:** stop writing to them, leave them read-only for historical hives, route all new reads/writes through `binderItems`.

Migrate-and-drop is cleaner if the existing usage is low (very likely — this feature isn't widely used yet).

### S2. `hiveChapterLocks` extends to all prose binder items

Currently keyed on `chapterId`. Needs to lock any prose-bearing binder item.

- Rename to `hiveBinderItemLocks` (or `prose_locks`)
- Key on `binderItemId` for non-chapter items, or unify under a single locking surface that takes `(targetType, targetId)`.
- Migration: existing rows convert by mapping `chapterId` → the binder item that wraps that chapter.

### S3. `hiveSuggestions` extends beyond chapters

Currently keys on `chapterId`. Needs to support edits to any binder item (character, note, outline beat). Same shape as S2 — either rename the column or add a polymorphic `(targetType, targetId)`.

### S4. Attribution columns on `binderItems`

Required for D3's "small avatar on the binder row" treatment.
- `createdBy text references users(id)` — set on insert, never changes
- `lastEditedBy text references users(id)` — updated on every save
- (Optional, plan-phase decision) Append-only `binderItemEdits` log if we want full per-edit history surfaced in attribution hover-cards

### S5. `hiveSubmissions` stays as-is

Workflow concept (chapter submitted for review as a whole), not an edit primitive. Doesn't need to change.

### S6. Hive notification preferences

New table `hiveNotificationPrefs` keyed on `(hiveId, userId)` with boolean columns per event type from D5. Reasonable defaults baked into the table's column defaults.

## Open implementation questions (for plan-phase)

These are deferred decisions, not unresolved design questions:

1. **Lock auto-release interval** — 5 min recommended; final value picked in plan.
2. **Migration sequencing** — migrate `hiveOutlines`/`hiveWikiPages` before or after the new permission code ships? Probably before, with a feature flag.
3. **Suggestion granularity** — does a suggestion target a whole artifact or a text range? Current schema (`originalText` + `suggestedText`) implies text range; plan-phase to confirm range targeting works for outline beats and character section edits, not just prose.
4. **Attribution avatar UI** — exact size/placement in binder rows. The DP4 design pass establishes the binder's visual language; the avatar treatment should match.
5. **Activity feed pagination + retention** — likely cursor-based, indefinite retention until storage costs say otherwise.
6. **Real-time freshness** — the binder is currently fetch-on-load. For the "everything done in the hive shows up in the editor" promise to feel real, do we need light polling, server-sent events, or just refetch-on-focus? Plan-phase to weigh.

## What this spec does NOT cover

- The visual design of the Activity tab, attribution avatars, or the takeover banner. Those are UI-phase concerns.
- The exact wording of role labels in the UI (e.g., "Editor" vs "Co-author"). Copy decision, plan-phase.
- Performance characteristics of fetching binder + attribution + lock state in a single hive page load. Implementation concern.
- Cross-hive interactions (a writer with two hives on the same book — currently disallowed by ownership, but worth confirming).

## Success criteria

A future Claude Code session reading this spec and AGENTS.md should be able to answer, without writing code:

1. "If a contributor adds a character in the hive, where does it appear in the binder?" → Same folder, no special treatment, small avatar attribution.
2. "Can a BETA_READER fix a typo?" → No. Comment only.
3. "Two editors open the same chapter — what happens?" → Soft lock; second sees take-over banner.
4. "Does the writer's binder feel cluttered by collab UI?" → No. All collab UI lives in the hive surface; binder shows only attribution avatars.
5. "Is `hiveWikiPages` still the right place to add a new worldbuilding page?" → No. Under this model, worldbuilding pages are `binderItems`. The existing table is being retired.

---

**Next:** plan-phase via `/gsd-plan-phase` (or `writing-plans` skill) once spec is reviewed.
