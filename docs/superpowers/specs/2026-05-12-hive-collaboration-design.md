# Phase 4 — Hive Collaboration Design

**Date:** 2026-05-12
**Status:** Approved

## Overview

A Hive is a private collaborative workspace tied to a single book. The Hive owner invites a group of co-authors ("worker bees") to help write and finish the book together. Members share full write access to all chapters, with the owner holding final say and veto power over all content. Collaboration is async — no real-time WebSocket infrastructure required.

---

## Core Model

- A Hive is created for one specific book and cannot be transferred to another
- Any member can open and edit any chapter (co-author model)
- When a member opens a chapter it is soft-locked to them; other members see a "Being edited by [name]" indicator in the binder and cannot open it simultaneously
- The owner can force-open any locked chapter and their save always wins
- All shared content (outline, wiki, comments, discussion, tasks) is visible to all members

---

## Data Model

### New Tables

| Table | Columns |
|---|---|
| `hiveOutlines` | `id, hiveId, content JSONB, updatedAt` — one row per hive |
| `hiveWikiPages` | `id, hiveId, title, content JSONB, createdBy, updatedBy, createdAt, updatedAt` |
| `hiveTasks` | `id, hiveId, title, description, assigneeId, creatorId, status (OPEN/IN_PROGRESS/DONE), dueDate, createdAt, updatedAt` |
| `hiveDiscussionPosts` | `id, hiveId, authorId, content TEXT, parentId (nullable — one level of replies), createdAt` |
| `hiveChapterLocks` | `chapterId, userId, lockedAt` — soft lock, cleared on navigate-away |

### Existing Tables Used

| Table | Purpose |
|---|---|
| `hives` | `id, name, description, coverUrl, ownerId, visibility (PUBLIC/PRIVATE), memberCount, createdAt` |
| `hiveMembers` | `hiveId, userId, role (OWNER/ADMIN/MEMBER), joinedAt` |
| `hiveInvites` | Invite tokens and username/email invites |
| `hiveComments` | Inline chapter comments anchored by text selection |
| `hiveSuggestions` | Reserved for future tracked-changes feature — not used in Phase 4 |
| `notifications` | Global notification store |

### Free Tier Limits

- 3 Hives max per user (`FREE_HIVE_LIMIT`)
- 5 members max per Hive (`FREE_HIVE_MEMBER_LIMIT`)
- Premium: unlimited Hives, unlimited members

---

## Routes

```
/[locale]/hive/[hiveId]                  Overview (activity feed, members, open tasks)
/[locale]/hive/[hiveId]/binder           Shared chapter binder with lock indicators
/[locale]/hive/[hiveId]/outline          Story outline (shared TipTap doc)
/[locale]/hive/[hiveId]/wiki             Wiki page list
/[locale]/hive/[hiveId]/wiki/[pageId]    Individual wiki page editor
/[locale]/hive/[hiveId]/discussion       Discussion board (threaded posts)
/[locale]/hive/[hiveId]/tasks            Kanban task board (Open / In Progress / Done)
/[locale]/hive/[hiveId]/members          Member management + invite panel
/[locale]/hive/invite/[token]            Invite link landing page
/[locale]/community                      Discover public Hives
```

All Hive routes are guarded: caller must be an authenticated member of the Hive (or owner). Public Hive pages (`/community`, `/hive/invite/[token]`) are accessible to any authenticated user.

---

## Navigation

Sidebar layout mirroring the Studio. Left sidebar lists all seven sections plus a Settings link at the bottom (owner/admin only). Active section is highlighted in brand yellow. Book title and cover shown at the top of the sidebar.

---

## Server Actions

### Hive Management
- `createHiveAction(bookId, name, description, visibility)` — enforces `FREE_HIVE_LIMIT`
- `getHiveAction(hiveId)` — verifies caller is a member
- `getUserHivesAction()` — all Hives the user belongs to
- `updateHiveAction(hiveId, patch)` — owner/admin only
- `deleteHiveAction(hiveId)` — owner only; cascades to all child records

### Membership
- `inviteMemberByUsernameAction(hiveId, username)` — enforces `FREE_HIVE_MEMBER_LIMIT`; creates notification for invitee
- `generateInviteLinkAction(hiveId)` — creates or rotates the invite token
- `joinHiveByLinkAction(token)` — joins via invite link; enforces member limit
- `requestToJoinHiveAction(hiveId)` — for public Hives; notifies owner + admins
- `approveJoinRequestAction(hiveId, userId)` — owner/admin; enforces member limit; notifies requester
- `removeMemberAction(hiveId, userId)` — owner/admin
- `updateMemberRoleAction(hiveId, userId, role)` — owner only
- `leaveHiveAction(hiveId)` — any member; returns `{ success: false, error: 'OWNER_MUST_TRANSFER_OR_DELETE' }` if the owner tries to leave without first deleting the Hive or promoting another member to OWNER

### Chapter Collaboration
- `lockChapterAction(chapterId)` — sets soft lock on chapter open
- `unlockChapterAction(chapterId)` — clears lock on navigate-away (also called on page unload)
- `getHiveChapterLocksAction(hiveId)` — returns all active locks for the binder UI
- `createHiveCommentAction(chapterId, content, anchorText)` — inline comment; notifies chapter's last editor
- `resolveHiveCommentAction(commentId)` — owner or comment author
- `getChapterCommentsAction(chapterId)`

### Outline & Wiki
- `getHiveOutlineAction(hiveId)` / `saveHiveOutlineAction(hiveId, content)` — 2s debounce autosave
- `getWikiPagesAction(hiveId)` / `createWikiPageAction(hiveId, title)` / `deleteWikiPageAction(pageId)`
- `getWikiPageAction(pageId)` / `saveWikiPageAction(pageId, content)` — 2s debounce autosave

### Discussion
- `getDiscussionPostsAction(hiveId)` — newest first, includes one level of replies
- `createDiscussionPostAction(hiveId, content, parentId?)` — parentId for replies (one level deep)
- `deleteDiscussionPostAction(postId)` — author or owner/admin

### Tasks
- `getTasksAction(hiveId)` — grouped by status
- `createTaskAction(hiveId, title, assigneeId?, description?)` — notifies assignee
- `updateTaskAction(taskId, patch)` — status, assignee, title, description; notifies task creator on DONE
- `deleteTaskAction(taskId)` — creator or owner/admin

### Notifications
- `getNotificationsAction()` — user's notifications, newest first, unread count
- `markNotificationReadAction(notificationId)`
- `markAllNotificationsReadAction()`

---

## Notification Triggers

| Event | Recipients | Type |
|---|---|---|
| Hive invite sent | Invitee | `HIVE_INVITE` |
| Join request received | Owner + Admins | `HIVE_JOIN_REQUEST` |
| Join request approved | Requester | `HIVE_JOIN_APPROVED` |
| Member joined | Owner | `HIVE_MEMBER_JOINED` |
| Chapter edited by member | Owner | `CHAPTER_EDITED` |
| Inline comment left | Chapter's last editor | `HIVE_COMMENT` |
| Task assigned | Assignee | `TASK_ASSIGNED` |
| Task marked done | Task creator | `TASK_COMPLETED` |

Notifications are surfaced via a bell icon (🔔) in the global top nav with an unread count badge. The dropdown shows the most recent notifications with inline Accept/Decline buttons for `HIVE_INVITE` entries.

---

## UI Sections

### Overview (`/hive/[hiveId]`)
Book info bar (cover, title, genre, member count, word count, visibility badge, Invite Members button). Two-column layout: recent activity feed on the left (who edited what, who commented, who completed a task), members list + open tasks on the right.

### Binder (`/hive/[hiveId]/binder`)
Same binder UI as the Studio. Additional indicators per chapter item:
- Orange badge with member name = locked by another member
- Yellow badge "You" = locked by current user
- Blue 💬 badge with count = unresolved inline comments
Comments sidebar opens alongside the editor when a chapter is active, showing all comments for that chapter with Resolve buttons.

### Outline (`/hive/[hiveId]/outline`)
Single shared TipTap document. Full toolbar. No soft lock — any member can edit freely (planning doc, not prose). Autosaves with 2s debounce.

### Wiki (`/hive/[hiveId]/wiki` and `/wiki/[pageId]`)
Page list on the left (title + last-edited timestamp). Clicking a page opens it in the TipTap editor on the right. Owner can create and delete pages; all members can edit. Autosaves with 2s debounce.

### Discussion (`/hive/[hiveId]/discussion`)
Flat list of posts, newest first. One level of replies per post (no infinite nesting). Plain textarea input — no rich text. Members can delete their own posts; owner/admin can delete any post.

### Tasks (`/hive/[hiveId]/tasks`)
Three-column kanban: Open → In Progress → Done. Members update status of tasks assigned to them via drag-between-columns or a status dropdown. Owner can create, reassign, and delete any task. Members can create tasks and update status on tasks assigned to them.

### Members (`/hive/[hiveId]/members`)
Full member list with role badges and online indicators. Invite panel at the top: search friends by username or copy the invite link. Pending join requests section (owner/admin only) with Approve/Deny buttons.

### Community (`/[locale]/community`)
Grid of public Hives — name, description, book title, member count, genre tag. "Request to Join" button on each card. Filterable by genre.

---

## Member Roles

| Capability | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Edit any chapter | ✓ | ✓ | ✓ |
| Force-break chapter lock | ✓ | — | — |
| Resolve any comment | ✓ | ✓ | own only |
| Invite members | ✓ | ✓ | — |
| Approve join requests | ✓ | ✓ | — |
| Remove members | ✓ | ✓ | — |
| Promote/demote roles | ✓ | — | — |
| Delete Hive | ✓ | — | — |
| Create/delete wiki pages | ✓ | ✓ | ✓ |
| Create/delete tasks | ✓ | ✓ | own only |
| Delete any discussion post | ✓ | ✓ | own only |

---

## Async Editing — Conflict Handling

Lock is advisory, not hard. If two members somehow save the same chapter simultaneously (e.g., a stale lock), last write wins — same as the existing autosave behavior. No merge or diff. The binder lock indicator is the primary guard; the hard lock at the DB level is not implemented in Phase 4 (can be added with real-time in a later phase).

---

## Out of Scope (Phase 4)

- Real-time simultaneous editing (Yjs/WebSocket) — deferred to a later phase
- Version history for Hive edits (premium snapshot system exists for the owner's Studio)
- Hive-level publishing or export
- Monetization of Hives (premium limits enforced; billing UI is Phase 8)
