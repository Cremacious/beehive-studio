# C5d — Community Claude Design Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Claude Design's Community bundle (22 surface mockups + `community.css` + shared components + `tokens.md`) into the live codebase across all C5d community surfaces — chrome refresh on 19 visual-only surfaces, structural changes on 7, plus 8 new tokens + the 13th sanctioned brand-yellow surface (`--club-role-owner = var(--brand)`).

**Architecture:** Single-source-of-truth additive token + class adoption (community.css contents inlined into `app/globals.css` under a `/* COMMUNITY C5d */` banner). Two new shared presentational components (`<PageHead>` + `<StatStrip>`) under `components/community/`. Per-surface chrome refreshes (Phase B) consume tokens + classes without prop changes. Structural changes (Phase C) reshape IA (Friends 4→3 tabs, Club tab reorder, Profile section reorder, Bell popover, Drag-handle col, Members forum-table) while preserving every server-action return shape + load-bearing pattern from C1-C5b. AppNav stays mounted at `app/[locale]/(app)/layout.tsx`. Cream paper stays studio-chapter-editor-only.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Drizzle ORM. Test baseline 634/634; tsc clean throughout.

**Spec:** [docs/superpowers/specs/2026-06-08-c5d-community-claude-design-import-delta.md](../specs/2026-06-08-c5d-community-claude-design-import-delta.md)

**Bundle:** `design-import-temp/c5d-community-bundle/` (22 surface HTML mockups + `community.css` 676 LOC + `shared-components.html` + `tokens.md`)

**Locked decisions from Chris (Q1-Q4):**
- **Q1 — Bell popover D12: REJECTED.** Keep current `DropdownMenu` shape (it carries keyboard nav + a11y for free). Apply chrome polish only — per-row icon chip + unread-row brand-tint + spinner for MENTION resolution.
- **Q2 — InviteClaimedToast (shared component #12 / D2): KEEP sonner default.** No custom toast chrome work. Existing `<Toaster />` mount inherits design tokens via theme. Plan does NOT include a custom toast task.
- **Q3 — Profile stat strip (D7): 4 stats** — Followers / Following / Books / Clubs. Drop Lists + Sparks from the strip since they get dedicated sections below per the Q3 IA reorder.
- **Q4 — Hives tile destination on /community section rail: KEEP /studio routing.** Tighten the tile copy/subline only ("Your hives") — no route changes.

---

## File Structure

### New files (~6)
- `components/community/page-head.tsx` — `<PageHead>` shared presentational (eyebrow + title + sub + headerSlot)
- `components/community/stat-strip.tsx` — `<StatStrip>` 4-cell horizontal strip (label + value)
- (Phase C2) `app/[locale]/(app)/friends/_components/pending-tab.tsx` — new combined Received+Sent tab with sub-segment selector

### Modified files (~30)
**Foundation (Phase A):**
- `app/globals.css` — 8 new tokens + 676 LOC of community.css inlined under `/* COMMUNITY C5d */` banner
- `AGENTS.md` — Design System map: 12 → 13 brand-yellow surfaces (add `<ClubMemberRow>` Owner pill)

**Phase B (visual polish):**
- `app/[locale]/(public)/discover/page.tsx` — bg fix
- `app/[locale]/(public)/sparks/page.tsx` + `_components/spark-card.tsx`
- `app/[locale]/(public)/sparks/[sparkId]/page.tsx` + countdown deadline component
- `app/[locale]/(public)/sparks/[sparkId]/entry/[entryId]/page.tsx`
- `app/[locale]/(app)/reading-lists/page.tsx` + `_components/list-card.tsx`
- `app/[locale]/(app)/clubs/page.tsx` + `_components/club-card.tsx`
- `app/[locale]/(app)/clubs/_components/club-books-panel.tsx`, `club-discussions-panel.tsx`, `discussion-card.tsx`, `club-schedule-panel.tsx`, `club-settings-panel.tsx`
- `app/[locale]/(app)/clubs/[clubId]/discussions/[discussionId]/page.tsx` + `discussion-detail.tsx` + `reply-composer.tsx`
- `app/[locale]/(app)/settings/notifications/page.tsx` + `_components/notification-preferences-form.tsx`
- `app/[locale]/(public)/friend-invite/[token]/page.tsx`
- `app/[locale]/(public)/clubs/[clubId]/invite/[token]/page.tsx` + `_components/invite-result.tsx`
- `app/[locale]/(app)/community/page.tsx` (empty state branch)
- `app/[locale]/(app)/reading-lists/page.tsx` (empty state branch)
- `app/[locale]/(app)/clubs/page.tsx` (empty state branch)
- `app/[locale]/(public)/sparks/page.tsx` (empty state branch)
- `app/[locale]/(public)/u/[username]/_components/profile-unavailable.tsx`
- `app/[locale]/(app)/_components/notifications-bell.tsx` (chrome polish per Q1)
- `components/visibility-picker.tsx` (selected-state polish)

**Phase C (structural):**
- `app/[locale]/(app)/community/_components/section-rail.tsx` (rewrite as pill-rail)
- `app/[locale]/(app)/community/_components/activity-event-row.tsx`, `activity-feed.tsx`, `requests-card.tsx`, `sidebar/*`
- `app/[locale]/(app)/friends/page.tsx` + `_components/friends-tab-strip.tsx` (4→3 tabs) + `_components/pending-tab.tsx` (new)
- `app/[locale]/(app)/reading-lists/[listId]/page.tsx` + `_components/book-list.tsx` + `_components/book-row.tsx` + `_components/list-detail-header.tsx`
- `app/[locale]/(app)/clubs/[clubId]/page.tsx` + `_components/club-tab-strip.tsx` + `_components/club-about-panel.tsx` + `_components/club-header.tsx`
- `app/[locale]/(app)/clubs/_components/club-members-panel.tsx`
- `app/[locale]/(public)/u/[username]/page.tsx` (full chrome refresh + section reorder + Sparks+Activity merge)
- `lib/actions/user-profile.actions.ts` (Sparks+Activity merge — interleaved sort)

---

## Phase A — Foundation (3 tasks, sequential)

Phase A lands the additive token + chrome foundation. Every Phase B/C surface inherits these. ZERO per-page churn in Phase A.

---

### Task A1: Add 8 new tokens to `app/globals.css` + update brand-yellow map

**Files:**
- Modify: `app/globals.css` (inside `:root` block)
- Modify: `AGENTS.md` (Design System section — 12-place → 13-place map)

- [ ] **Step 1: Open `app/globals.css` and locate the `:root` block.**

Find the existing token definitions. Identify where `--layer-general` ends (search for `--layer-general`). The new tokens land RIGHT AFTER the layer palette block.

- [ ] **Step 2: Append the 8 new tokens.**

Edit `app/globals.css` — append these lines right after the existing `--layer-*` tokens, inside `:root`:

```css
  /* ── NEW categorical accent tokens (C5d Community port) ── */
  /* Cross-cutting list/club/spark visibility (5+ surfaces) */
  --list-visibility-public:  oklch(0.72 0.11 230); /* sky blue — open to all (Globe) */
  --list-visibility-friends: oklch(0.74 0.12 145); /* mint — your circle (Users) */
  --list-visibility-private: oklch(0.66 0.04 240); /* cool gray — closed (Lock) */

  /* Spark status state machine (heartbeat of /sparks) */
  --spark-status-open:   oklch(0.74 0.12 145); /* mint — accepting entries */
  --spark-status-voting: oklch(0.78 0.13 70);  /* warm gold — voting live */
  --spark-status-closed: oklch(0.66 0.04 240); /* cool gray — finished */

  /* Club role accents (Owner intentionally maps to --brand — see AGENTS.md Design System) */
  --club-role-mod:    oklch(0.72 0.11 250);   /* slate blue */
  --club-role-member: oklch(0.680 0.003 256); /* muted ink */
  /* --club-role-owner is NOT a separate token. .pill.role-owner consumer reads var(--brand) directly. */
```

- [ ] **Step 3: Verify no existing token was renamed/repurposed.**

Run a quick grep to confirm `--brand-hover`, `--brand-active`, `--brand-soft`, `--canvas-dark-ink-faint`, `--canvas-dark-150/-250/-350/-400`, `--layer-*` were not duplicated:

```bash
grep -c "^\s*--brand-hover:" app/globals.css
grep -c "^\s*--canvas-dark-150:" app/globals.css
```

Each should return `1`. If `2` or more, dedupe by keeping the existing definition and removing the duplicate.

- [ ] **Step 4: Update AGENTS.md Design System section.**

Find the "Design System" section (top of AGENTS.md). Locate the "Brand-yellow usage" sentence that mentions "12-place map". Update from:

> **Brand-yellow usage** is RESTRAINED — 12-place map in the spec. Use for headings (h1/h2/h3 + panel titles), active states, premium badge, progress fills, save indicator dot, + Add tile text. NEVER for chrome borders, hover states, neutral text.

to:

> **Brand-yellow usage** is RESTRAINED — 13-place map in the spec. Use for headings (h1/h2/h3 + panel titles), active states, premium badge, progress fills, save indicator dot, + Add tile text, **and the C5d `<ClubMemberRow>` Owner pill (`.pill.role-owner` → `var(--brand)` — the 13th sanctioned surface, categorical twin of premium badge / active status pill / max once per members table)**. NEVER for chrome borders, hover states, neutral text, Mod/Member pills, club tags, list tags, or cover bands.

- [ ] **Step 5: Run tsc + tests.**

```bash
npx tsc --noEmit
npm test
```

Expected: tsc clean, 634/634 tests pass.

- [ ] **Step 6: Commit.**

```bash
git add app/globals.css AGENTS.md
git commit -m "$(cat <<'EOF'
feat(c5d/tokens): 8 new accent tokens + 13th brand-yellow surface

Adds list-visibility, spark-status, and club-role accent tokens used
across the C5d Community port. --club-role-owner intentionally maps
to var(--brand) — the 13th sanctioned brand-yellow surface (Owner
pill on club members table). Rationale: categorical twin of active-
status-pill + premium-badge; max once per members table; reinforces
yellow = authority/ownership. AGENTS.md Design System map updated
12 → 13 places.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task A2: Port `community.css` contents into `app/globals.css`

**Files:**
- Modify: `app/globals.css` (append ~600 LOC under `/* COMMUNITY C5d */` banner)

Decision rationale: single source of truth, mirrors how Hive Routes shipped `hive.css` rules inside `globals.css`. Avoids per-route layout.tsx imports.

- [ ] **Step 1: Open `design-import-temp/c5d-community-bundle/community.css` and identify the port boundaries.**

The file is 676 lines. Lines 1-88 are token definitions (already covered by A1 + existing tokens — DO NOT re-port these). Lines 89-676 are the chrome classes (panels, tiles, pills, buttons, avatars, inputs, tabstrip, switch, meta, cover/placeholder, empty, claim-card, friend-event, ccard, disc-card, book-row, stat-strip, deadline, see-all, scrollbar). These ALL port.

- [ ] **Step 2: Append a banner + the port to `app/globals.css`.**

At the END of `app/globals.css`, append:

```css

/* ════════════════════════════════════════════════════════════════════════
   COMMUNITY C5d — chrome classes ported from design-import-temp/
   c5d-community-bundle/community.css (lines 89-676).
   Tokens used here are defined in :root above. Tokens added by C5d
   foundation (A1): --list-visibility-*, --spark-status-*, --club-role-*.
   Bent rule: .pill.role-owner reads var(--brand) directly (13th surface).
   ──────────────────────────────────────────────────────────────────────── */

/* ── PAGE SHELL ────────────────────────────────────────────────────────── */
.cm-main { width: 100%; }
.cm-wrap { margin: 0 auto; padding: 28px 24px 96px; }
.cm-wrap.w-md  { max-width: 28rem; }   /* 448px — claim cards */
.cm-wrap.w-3xl { max-width: 48rem; }   /* 768px — settings, single-prose */
.cm-wrap.w-5xl { max-width: 64rem; }   /* 1024px — hubs, details, profile */

/* NOTE: .route-tag deliberately OMITTED — AppNav supplies real nav. */

.page-head { margin-bottom: 24px; }
.page-head .eyebrow {
  font-family: var(--font-mono); font-size: 11px;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--canvas-dark-ink-muted);
  margin-bottom: 10px;
}
.page-head h1 {
  font-family: var(--font-display); font-weight: 700;
  font-size: 30px; letter-spacing: -0.02em; line-height: 1.08;
  color: var(--canvas-dark-ink-strong); margin: 0;
  text-wrap: balance;
}
.page-head .sub {
  margin: 8px 0 0; font-size: 14px; max-width: 56ch;
  color: var(--canvas-dark-ink-muted); line-height: 1.55;
}
.head-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }

/* TYPE HELPERS */
.font-display { font-family: var(--font-display); }
.font-mono { font-family: var(--font-mono); }
.font-prose { font-family: var(--font-prose); }
.ink-strong { color: var(--canvas-dark-ink-strong); }
.ink-muted  { color: var(--canvas-dark-ink-muted); }
.ink-faint  { color: var(--canvas-dark-ink-faint); }
.eyebrow-mono {
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--canvas-dark-ink-muted);
}

/* PANELS */
.panel {
  background: linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200));
  box-shadow: var(--sh-card);
  border-top: var(--br-card);
  border-radius: var(--r-card);
  overflow: hidden;
}
.panel-pad { padding: 22px 24px; }
.sec-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; margin-bottom: 16px;
}
.sec-head h2 {
  font-family: var(--font-display); font-weight: 700;
  font-size: 18px; letter-spacing: -0.01em;
  color: var(--brand);
  margin: 0;
}
.sec-head .sec-desc { font-size: 13px; color: var(--canvas-dark-ink-muted); margin: 2px 0 0; }
.sec-head .count { font-family: var(--font-mono); font-size: 11px; color: var(--canvas-dark-ink-muted); }

/* TILES */
.tile {
  background: linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300));
  box-shadow: var(--sh-tile);
  border-radius: var(--r-row);
  border-top: var(--br-card);
}
.tile-pad { padding: 16px; }
.tile.is-interactive { cursor: pointer; transition: transform .14s, box-shadow .14s, border-color .14s; }
.tile.is-interactive:hover {
  transform: translateY(-1px);
  border-color: oklch(from var(--brand) l c h / 0.35);
  box-shadow: var(--sh-tile), 0 0 0 1px oklch(from var(--brand) l c h / 0.18);
}
.cstack { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }

/* FORUM-TABLE */
.ftable .strip {
  background: var(--canvas-dark-100);
  border-top: var(--br-card);
  border-bottom: var(--br-card);
}
.ftable .strip ul {
  list-style: none; margin: 0; display: grid;
  padding: 9px 24px;
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.10em; text-transform: uppercase;
  color: var(--canvas-dark-ink-muted);
}
.ftable .rows { list-style: none; margin: 0; padding: 0; }
.ftable .rows > li {
  display: grid; align-items: center;
  padding: 14px 24px;
  border-bottom: 1px solid oklch(from var(--canvas-dark-300) l c h / 0.4);
  transition: background .12s;
}
.ftable .rows > li:last-child { border-bottom: 0; }
.ftable .rows > li:hover { background: var(--canvas-dark-300); }
.ftable .num { font-variant-numeric: tabular-nums; }
.ftable .ralign { text-align: right; }

/* PILLS (universal alpha-tint) */
.pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 10px; border-radius: var(--r-pill);
  font-family: var(--font-mono); font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.05em;
  white-space: nowrap;
  background: oklch(from var(--pt) l c h / 0.14);
  color: var(--pt);
  border: 1px solid oklch(from var(--pt) l c h / 0.30);
}
.pill svg { width: 12px; height: 12px; }
.pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pt); }
.pill.idea        { --pt: var(--status-idea); }
.pill.outline     { --pt: var(--status-outline); }
.pill.first-draft { --pt: var(--status-first-draft); }
.pill.revised     { --pt: var(--status-revised); }
.pill.final       { --pt: var(--status-final); }
.pill.pending  { --pt: var(--status-warning); }
.pill.approved { --pt: var(--status-success); }
.pill.rejected { --pt: var(--status-error); }
.pill.vis-public  { --pt: var(--list-visibility-public); }
.pill.vis-friends { --pt: var(--list-visibility-friends); }
.pill.vis-private { --pt: var(--list-visibility-private); }
.pill.spark-open   { --pt: var(--spark-status-open); }
.pill.spark-voting { --pt: var(--spark-status-voting); }
.pill.spark-closed { --pt: var(--spark-status-closed); }
.pill.role-owner       { --pt: var(--brand); } /* 13th brand-yellow surface */
.pill.role-mod         { --pt: var(--club-role-mod); }
.pill.role-member      { --pt: var(--club-role-member); }
.pill.role-moderator   { --pt: var(--role-moderator); }
.pill.role-contributor { --pt: var(--role-contributor); }
.pill.role-reader      { --pt: var(--role-reader); }
.pill.topic-general      { --pt: var(--layer-general); }
.pill.topic-worldbuilding{ --pt: var(--layer-tone); }
.pill.topic-feedback     { --pt: var(--layer-continuity); }
.pill.topic-offtopic     { --pt: var(--layer-grammar); }
.pill.layer-grammar    { --pt: var(--layer-grammar); }
.pill.layer-plot       { --pt: var(--layer-plot); }
.pill.layer-tone       { --pt: var(--layer-tone); }
.pill.layer-continuity { --pt: var(--layer-continuity); }
.pill.layer-general    { --pt: var(--layer-general); }
.pill.open-join { --pt: var(--status-success); }
.pill.auto { --pt: var(--status-error); }
.pill.brand-solid {
  background: var(--brand); color: var(--brand-ink);
  border-color: var(--brand);
}
.tag {
  display: inline-flex; align-items: center;
  padding: 2px 9px; border-radius: var(--r-pill);
  font-size: 11px; font-family: var(--font-ui); font-weight: 500;
  color: var(--canvas-dark-ink-muted);
  background: oklch(1 0 0 / 0.04);
  border: 1px solid oklch(1 0 0 / 0.06);
}
.tag-row { display: flex; flex-wrap: wrap; gap: 6px; }

/* BUTTONS */
.btn-brand {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 16px; border-radius: var(--r-pill);
  background: var(--brand); color: var(--brand-ink);
  font-family: var(--font-display); font-weight: 700; font-size: 13px;
  border: 0; cursor: pointer;
  box-shadow: 0 1px 0 0 oklch(1 0 0 / 0.2) inset;
  transition: background .14s;
}
.btn-brand:hover { background: var(--brand-hover); }
.btn-brand:active { background: var(--brand-active); }
.btn-brand svg { width: 15px; height: 15px; }
.btn-tile {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 15px; border-radius: var(--r-btn);
  background: linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300));
  color: var(--canvas-dark-ink); box-shadow: var(--sh-tile);
  border-top: var(--br-card);
  font-family: var(--font-ui); font-weight: 600; font-size: 13px;
  cursor: pointer; transition: transform .14s, color .14s, box-shadow .14s;
}
.btn-tile:hover {
  color: var(--canvas-dark-ink-strong); transform: translateY(-1px);
  box-shadow: var(--sh-tile), 0 0 0 1px oklch(from var(--brand) l c h / 0.18);
}
.btn-tile svg { width: 15px; height: 15px; }
.btn-ghost {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 13px; border-radius: var(--r-btn);
  background: transparent; color: var(--canvas-dark-ink-muted);
  border: 1px solid var(--canvas-dark-300);
  font-family: var(--font-ui); font-weight: 500; font-size: 13px;
  cursor: pointer; transition: color .14s, border-color .14s;
}
.btn-ghost:hover { color: var(--canvas-dark-ink-strong); border-color: var(--canvas-dark-400); }
.btn-ghost svg { width: 14px; height: 14px; }
.btn-sm { padding: 6px 11px; font-size: 12px; }
.icon-btn {
  width: 34px; height: 34px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--r-btn);
  background: var(--canvas-dark-100); box-shadow: var(--sh-inset);
  border: 0; cursor: pointer; color: var(--canvas-dark-ink-muted);
  transition: color .14s;
}
.icon-btn:hover { color: var(--canvas-dark-ink-strong); }
.icon-btn svg { width: 16px; height: 16px; }
.kebab {
  width: 30px; height: 30px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--r-btn);
  background: transparent; border: 0; cursor: pointer;
  color: var(--canvas-dark-ink-faint); transition: color .14s, background .14s;
}
.kebab:hover { color: var(--canvas-dark-ink-strong); background: oklch(1 0 0 / 0.04); }
.kebab svg { width: 18px; height: 18px; }

/* AVATARS */
.avatar {
  flex-shrink: 0; border-radius: var(--r-pill);
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-weight: 700;
  color: #fff; overflow: hidden; user-select: none;
}
.avatar.s24 { width: 24px; height: 24px; font-size: 10px; }
.avatar.s32 { width: 32px; height: 32px; font-size: 12px; }
.avatar.s40 { width: 40px; height: 40px; font-size: 14px; }
.avatar.s56 { width: 56px; height: 56px; font-size: 19px; }
.avatar.s80 { width: 80px; height: 80px; font-size: 28px; }
.avatar.brand { background: linear-gradient(150deg, var(--brand), #c79700); color: #1a1400; }
.avatar.a-blue { background: linear-gradient(150deg, #5b8def, #3a5fc4); }
.avatar.a-mint { background: linear-gradient(150deg, #3fae74, #2c8557); }
.avatar.a-coral{ background: linear-gradient(150deg, #e07a5f, #c4513a); }
.avatar.a-lilac{ background: linear-gradient(150deg, #9b8cf0, #6c5bc4); }
.avatar.a-slate{ background: linear-gradient(150deg, #6b7b94, #495468); }
.cluster { display: inline-flex; align-items: center; }
.cluster .avatar { border: 2px solid var(--canvas-dark-200); margin-left: -8px; }
.cluster .avatar:first-child { margin-left: 0; }

/* INPUTS */
.input {
  width: 100%; height: 42px; padding: 0 14px;
  border-radius: var(--r-row);
  background: var(--canvas-dark-100); box-shadow: var(--sh-inset);
  border: 0; color: var(--canvas-dark-ink-strong);
  font-family: var(--font-ui); font-size: 14px; outline: none;
}
.input::placeholder { color: var(--canvas-dark-ink-faint); }
.input:focus { box-shadow: var(--sh-inset), 0 0 0 2px oklch(from var(--brand) l c h / 0.30); }
.search { position: relative; }
.search svg.lead {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  width: 16px; height: 16px; color: var(--canvas-dark-ink-faint); pointer-events: none;
}
.search .input { padding-left: 40px; }
textarea.input { height: auto; min-height: 84px; padding: 12px 14px; resize: vertical; line-height: 1.5; }

/* TAB STRIP */
.tabstrip {
  position: sticky; top: 0; z-index: 5;
  display: flex; gap: 4px; flex-wrap: wrap;
  padding: 6px;
  background: oklch(from var(--canvas-dark-100) l c h / 0.85);
  backdrop-filter: blur(10px);
  border-radius: var(--r-pill);
  border: var(--br-card);
  box-shadow: var(--sh-tile);
}
.tab {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 15px; border-radius: var(--r-pill);
  font-family: var(--font-display); font-weight: 600; font-size: 13px;
  color: var(--canvas-dark-ink-muted);
  background: transparent; border: 0; cursor: pointer;
  text-decoration: none; transition: color .14s, background .14s;
}
.tab:hover { color: var(--canvas-dark-ink-strong); }
.tab.active { color: var(--brand); background: var(--brand-soft); }
.tab .ct {
  font-family: var(--font-mono); font-size: 10px; font-weight: 500;
  padding: 1px 6px; border-radius: var(--r-pill);
  background: oklch(1 0 0 / 0.06); color: var(--canvas-dark-ink-muted);
}
.tab.active .ct { background: var(--brand); color: var(--brand-ink); }
.segment {
  display: inline-flex; gap: 2px; padding: 3px;
  border-radius: var(--r-pill);
  background: var(--canvas-dark-100); box-shadow: var(--sh-inset);
}
.segment button {
  padding: 5px 14px; border-radius: var(--r-pill);
  font-family: var(--font-ui); font-weight: 600; font-size: 12px;
  color: var(--canvas-dark-ink-muted); background: transparent;
  border: 0; cursor: pointer; transition: color .14s, background .14s;
}
.segment button.active { color: var(--canvas-dark-ink-strong); background: var(--canvas-dark-300); }

/* SWITCH */
.switch {
  position: relative; width: 42px; height: 24px; flex-shrink: 0;
  border-radius: var(--r-pill); cursor: pointer; border: 0;
  background: var(--canvas-dark-100); box-shadow: var(--sh-inset);
  transition: background .16s;
}
.switch::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--canvas-dark-ink-muted);
  transition: transform .16s, background .16s;
}
.switch[aria-checked="true"] { background: var(--brand); }
.switch[aria-checked="true"]::after { transform: translateX(18px); background: var(--brand-ink); }

/* META / SEPARATORS */
.meta { font-family: var(--font-ui); font-size: 12px; color: var(--canvas-dark-ink-muted); }
.meta-mono { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; color: var(--canvas-dark-ink-muted); }
.dot-sep { width: 3px; height: 3px; border-radius: 50%; background: var(--canvas-dark-400); display: inline-block; }
.divider { height: 1px; background: oklch(from var(--canvas-dark-300) l c h / 0.5); border: 0; margin: 0; }
.owner-card { display: inline-flex; align-items: center; gap: 9px; }
.owner-card .oc-name { font-family: var(--font-display); font-weight: 600; font-size: 13px; color: var(--canvas-dark-ink-strong); }
.owner-card .oc-handle { font-family: var(--font-mono); font-size: 11px; color: var(--canvas-dark-ink-muted); }
.act-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: 0; cursor: pointer; padding: 0;
  font-family: var(--font-ui); font-size: 12px; font-weight: 500;
  color: var(--canvas-dark-ink-faint); transition: color .14s;
}
.act-btn:hover { color: var(--canvas-dark-ink); }
.act-btn svg { width: 15px; height: 15px; }
.act-btn.liked { color: var(--status-error); }

/* COVER / PLACEHOLDER ART */
.cover-paper {
  background: oklch(0.965 0.018 85);
  background-image: radial-gradient(circle at 1px 1px, rgba(95,60,20,0.05) 1px, transparent 0);
  background-size: 20px 20px;
  color: oklch(0.265 0.020 55);
}
.cover-grad {
  background: linear-gradient(150deg, var(--canvas-dark-350), var(--canvas-dark-200));
  position: relative;
}
.cover-grad::after {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 30% 25%, oklch(from var(--pt, var(--brand)) l c h / 0.22), transparent 60%);
}

/* EMPTY-STATE HERO */
.empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 72px 28px;
}
.empty .glyph {
  width: 96px; height: 96px; border-radius: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200));
  box-shadow: var(--sh-card); border-top: var(--br-card);
  color: var(--canvas-dark-ink-faint); margin-bottom: 28px;
}
.empty .glyph svg { width: 40px; height: 40px; }
.empty h2 {
  font-family: var(--font-display); font-weight: 700;
  font-size: 26px; letter-spacing: -0.02em; color: var(--canvas-dark-ink-strong);
  margin: 0 0 10px; text-wrap: balance;
}
.empty p {
  font-size: 14px; color: var(--canvas-dark-ink-muted);
  margin: 0 0 26px; max-width: 44ch; line-height: 1.6;
}
.empty .cta-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.empty-line {
  font-size: 13px; color: var(--canvas-dark-ink-faint);
  font-style: italic; padding: 14px 0;
}

/* CENTERED CLAIM CARD */
.claim-stage {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.claim-card {
  width: 100%; max-width: 28rem; padding: 36px 32px; text-align: center;
  background: linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200));
  border-radius: var(--r-card); box-shadow: var(--sh-card); border-top: var(--br-card);
}
.claim-card .icon-wrap {
  width: 64px; height: 64px; border-radius: 20px; margin: 0 auto 22px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--canvas-dark-100); box-shadow: var(--sh-inset);
}
.claim-card .icon-wrap svg { width: 28px; height: 28px; }
.claim-card .icon-wrap.tone-error   { color: var(--status-error); }
.claim-card .icon-wrap.tone-warning { color: var(--status-warning); }
.claim-card .icon-wrap.tone-muted   { color: var(--canvas-dark-ink-faint); }
.claim-card .icon-wrap.tone-success { color: var(--status-success); }
.claim-card h1 {
  font-family: var(--font-display); font-weight: 700; font-size: 22px;
  letter-spacing: -0.01em; color: var(--canvas-dark-ink-strong); margin: 0 0 10px;
}
.claim-card p {
  font-size: 13.5px; color: var(--canvas-dark-ink-muted);
  margin: 0 0 24px; line-height: 1.6;
}
.claim-card .actions { display: flex; flex-direction: column; gap: 10px; align-items: center; }

/* FRIEND-EVENT LEFT BORDER */
.is-friend-event { position: relative; }
.is-friend-event::before {
  content: ''; position: absolute; left: 0; top: 10px; bottom: 10px;
  width: 3px; border-radius: var(--r-pill); background: var(--brand);
}

/* SHARED CARDS (SparkCard / ListCard / ClubCard) */
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.ccard {
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200));
  box-shadow: var(--sh-card); border-top: var(--br-card);
  border-radius: var(--r-card); overflow: hidden;
  text-decoration: none; color: inherit; cursor: pointer;
  transition: transform .16s, box-shadow .16s;
}
.ccard:hover { transform: translateY(-2px); box-shadow: var(--sh-card), 0 0 0 1px oklch(from var(--brand) l c h / 0.18); }
.ccard .cc-cover {
  position: relative; height: 120px; overflow: hidden;
  display: flex; align-items: flex-start; justify-content: space-between; padding: 12px;
}
.ccard .cc-cover.tall { height: 150px; }
.ccard .cc-pills { display: flex; gap: 6px; flex-wrap: wrap; position: relative; z-index: 2; }
.ccard .cc-body { padding: 15px 16px 16px; display: flex; flex-direction: column; gap: 9px; flex: 1; }
.ccard .cc-title {
  font-family: var(--font-display); font-weight: 700; font-size: 16px;
  letter-spacing: -0.01em; color: var(--canvas-dark-ink-strong); line-height: 1.18;
  margin: 0; text-wrap: balance;
}
.ccard .cc-desc { font-size: 12.5px; color: var(--canvas-dark-ink-muted); line-height: 1.45; margin: 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ccard .cc-foot {
  margin-top: auto; padding-top: 11px; display: flex; align-items: center; gap: 9px;
  border-top: 1px solid oklch(from var(--canvas-dark-300) l c h / 0.5);
}
.ccard .cc-stats { margin-left: auto; display: flex; align-items: center; gap: 11px; }
.cc-stat { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 11px; color: var(--canvas-dark-ink-muted); }
.cc-stat svg { width: 13px; height: 13px; }
.cc-reading { font-size: 12px; color: var(--canvas-dark-ink-muted); }
.cc-reading b { font-family: var(--font-display); color: var(--canvas-dark-ink); font-weight: 600; }
.cc-reading i { font-family: var(--font-prose); font-style: italic; color: var(--canvas-dark-ink); }
.disc-card { display: grid; grid-template-columns: 1fr auto; gap: 10px 16px; }
.disc-card .dc-title { font-family: var(--font-display); font-weight: 700; font-size: 15px; color: var(--canvas-dark-ink-strong); margin: 0; display: inline-flex; align-items: center; gap: 8px; }
.disc-card .dc-title svg { width: 14px; height: 14px; color: var(--brand); }
.disc-card .dc-meta { display: flex; align-items: center; gap: 9px; margin-top: 8px; }
.disc-card .dc-stats { display: flex; align-items: center; gap: 14px; align-self: center; }
.book-row { display: grid; grid-template-columns: 18px 64px 1fr auto; gap: 16px; align-items: start; }
.book-row .br-handle { color: var(--canvas-dark-ink-faint); cursor: grab; align-self: center; }
.book-row .br-thumb { width: 64px; height: 96px; border-radius: 6px; box-shadow: var(--sh-tile); }
.book-row .br-title { font-family: var(--font-display); font-weight: 700; font-size: 15px; color: var(--canvas-dark-ink-strong); margin: 0; }
.book-row .br-author { font-size: 12.5px; color: var(--canvas-dark-ink-muted); margin: 2px 0 0; }
.book-row .br-commentary { font-family: var(--font-prose); font-size: 13.5px; color: var(--canvas-dark-ink); line-height: 1.5; margin: 10px 0 0; }
.stars { display: inline-flex; gap: 2px; color: var(--brand); }
.stars svg { width: 13px; height: 13px; }
.stars .empty { color: var(--canvas-dark-400); }
.stat-strip { display: flex; gap: 0; }
.stat-strip .ss { flex: 1; text-align: center; padding: 14px 8px; }
.stat-strip .ss + .ss { border-left: 1px solid oklch(from var(--canvas-dark-300) l c h / 0.5); }
.stat-strip .ss .v { font-family: var(--font-display); font-weight: 700; font-size: 22px; color: var(--canvas-dark-ink-strong); }
.stat-strip .ss .l { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--canvas-dark-ink-muted); margin-top: 3px; }
.deadline {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 7px 14px 7px 11px; border-radius: var(--r-pill);
  background: var(--canvas-dark-100); box-shadow: var(--sh-inset);
  font-family: var(--font-mono); font-size: 12px; color: var(--canvas-dark-ink);
}
.deadline svg { width: 14px; height: 14px; color: var(--spark-status-voting); }
.deadline b { font-family: var(--font-display); font-weight: 700; color: var(--canvas-dark-ink-strong); letter-spacing: 0.02em; }

/* SEE-ALL LINK */
.see-all {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 16px; padding: 11px;
  font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.02em;
  color: var(--brand); text-decoration: none;
  border-radius: var(--r-btn); border: 1px solid oklch(from var(--canvas-dark-300) l c h / 0.7);
  transition: color .14s, border-color .14s, background .14s;
}
.see-all svg { width: 13px; height: 13px; }
.see-all:hover { color: var(--brand-hover); border-color: oklch(from var(--brand) l c h / 0.4); background: oklch(from var(--brand) l c h / 0.06); }
```

NOTE: `.route-tag` deliberately OMITTED — AppNav supplies real navigation; no need for a visual route label. Scrollbar rules also OMITTED — already covered globally elsewhere.

Note `.book-row` grid is `18px 64px 1fr auto` per D11 (explicit drag-handle column).

- [ ] **Step 3: Run tsc + tests.**

```bash
npx tsc --noEmit
npm test
```

Expected: clean, 634/634.

- [ ] **Step 4: Visual smoke (no app code consumes these yet).**

```bash
npm run dev
```

Open any (app) route. Confirm no visual regression (the classes are unused so far — this is purely additive).

- [ ] **Step 5: Commit.**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
feat(c5d/chrome): port community.css classes into globals.css

Inlines ~580 LOC of shared chrome (panels, tiles, pills, buttons,
avatars, inputs, tabstrip, switch, ccard, disc-card, book-row,
stat-strip, deadline, see-all, claim-card, empty hero, is-friend-event
left border) from design-import-temp/c5d-community-bundle/community.css
under /* COMMUNITY C5d */ banner. Tokens already landed in A1.
.route-tag omitted (AppNav supplies real nav). .book-row grid is
18px 64px 1fr auto per D11 explicit drag-handle column.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task A3: Build `<PageHead>` + `<StatStrip>` shared components

**Files:**
- Create: `components/community/page-head.tsx`
- Create: `components/community/stat-strip.tsx`

- [ ] **Step 1: Create `components/community/page-head.tsx`.**

```tsx
import type { ReactNode } from 'react';

interface PageHeadProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  headerSlot?: ReactNode;
}

export function PageHead({ eyebrow, title, subtitle, headerSlot }: PageHeadProps) {
  return (
    <div className="page-head">
      {headerSlot ? (
        <div className="head-row">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h1>{title}</h1>
            {subtitle ? <p className="sub">{subtitle}</p> : null}
          </div>
          <div>{headerSlot}</div>
        </div>
      ) : (
        <>
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="sub">{subtitle}</p> : null}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/community/stat-strip.tsx`.**

```tsx
export interface StatStripCell {
  value: string | number;
  label: string;
}

interface StatStripProps {
  cells: StatStripCell[];
}

export function StatStrip({ cells }: StatStripProps) {
  return (
    <div className="stat-strip">
      {cells.map((cell, i) => (
        <div className="ss" key={`${cell.label}-${i}`}>
          <div className="v">{cell.value}</div>
          <div className="l">{cell.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run tsc + tests.**

```bash
npx tsc --noEmit
npm test
```

Expected: clean, 634/634.

- [ ] **Step 4: Commit.**

```bash
git add components/community/page-head.tsx components/community/stat-strip.tsx
git commit -m "$(cat <<'EOF'
feat(c5d/components): shared <PageHead> + <StatStrip> presentational

PageHead renders eyebrow (mono) + h1 (brand-yellow Comfortaa 30px) +
subtitle (muted, max-w-56ch) + optional headerSlot via .head-row flex.
StatStrip renders cells with --canvas-dark-300 dividers, Comfortaa value
22px, mono uppercase 10px label. Both consume community.css classes
landed in A2. Used by 22 Community surfaces (PageHead) +
ListDetailHeader + Profile (StatStrip).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — Visual polish per surface (14 tasks, parallel-safe)

Each task is a chrome refresh that consumes the A2 classes. NO data shape changes, NO server action changes, NO IA changes. Each task is independently shippable + commit.

**Cross-cutting do-not-regress callouts (repeat per task):**
- AppNav stays. Mounted at `app/[locale]/(app)/layout.tsx:30` for every authed Community route.
- Cream paper stays studio-chapter-editor-only. No `--paper-*` tokens.
- Brand-yellow restraint — 13-place map. Only `.pill.role-owner` is the new entry (Phase C5).
- Server actions stay locked — chrome consumes existing return shapes.
- All optimistic-mutation patterns from C1-C5b preserved.
- All locale-prefixed routes preserved (`/[locale]/...`).
- `<MentionLink>` snapshot username render load-bearing in all prose surfaces.

---

### Task B1: `/discover` chrome refresh + `#262728` background fix

**Files:**
- Modify: `app/[locale]/(public)/discover/page.tsx`
- Modify: existing tab strip + per-tab content components under `app/[locale]/(public)/discover/_components/`

- [ ] **Step 1: Read bundle mockup.**

Open `design-import-temp/c5d-community-bundle/03-discover.html`. Note: `.cm-wrap.w-5xl`, `<div class="page-head">` with eyebrow + h1, `<div class="tabstrip">` with 5 tabs.

- [ ] **Step 2: Read current shipped at `app/[locale]/(public)/discover/page.tsx`.**

Identify the outer wrapper. Look for `bg-[#141414]` (line 31 per the spec). Note the per-tab logic.

- [ ] **Step 3: Replace outer wrapper bg.**

In `app/[locale]/(public)/discover/page.tsx`, replace `bg-[#141414]` with `bg-[var(--canvas-dark-100)]`. Wrap the page content in `<div className="cm-wrap w-5xl">` + add a `<PageHead title="Discover" subtitle="Books, sparks, lists, clubs, and hives from across the community.">` block at the top.

- [ ] **Step 4: Re-skin the tab strip.**

Replace the existing tab strip wrapper with `<nav className="tabstrip">` and each tab with `<Link className={\`tab \${isActive ? 'active' : ''}\`}>`. Tab counts use `<span className="ct">N</span>`.

- [ ] **Step 5: Run tsc + tests + dev smoke.**

```bash
npx tsc --noEmit
npm test
npm run dev
```

Visit `/en/discover`. Confirm: `#262728` bg, brand-yellow `Discover` h1, sticky tab strip with brand-yellow active tab, count chips, no regression in per-tab content.

- [ ] **Step 6: Commit.**

```bash
git add app/\[locale\]/\(public\)/discover/
git commit -m "$(cat <<'EOF'
style(c5d/discover): chrome refresh + bg fix

Wraps /discover in .cm-wrap.w-5xl + <PageHead>. Replaces bg-[#141414]
(pre-design-system hex) with bg-[var(--canvas-dark-100)]. Tab strip
re-skinned to .tabstrip + .tab w/ count chips. Per-tab logic + URL
state + server actions unchanged.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task B2: `/sparks` index chrome refresh + deadline countdown chip

**Files:**
- Modify: `app/[locale]/(public)/sparks/page.tsx`
- Modify: `app/[locale]/(public)/discover/_components/spark-card.tsx` (shared SparkCard)
- Modify: `app/[locale]/(public)/sparks/_components/countdown.tsx` (if exists; else inline)

- [ ] **Step 1: Read mockup `04-sparks.html` + identify sections.**

Active section (grid-3 of `.ccard`), Voting section (deadlines inside `.ccard`), Past section.

- [ ] **Step 2: Wrap page in `<main className="cm-wrap w-5xl">` + `<PageHead>`.**

Title: "Sparks". Subtitle: "Short writing prompts with voting windows."

- [ ] **Step 3: Re-skin SparkCard.**

Replace the existing card chrome with `.ccard` structure:
```tsx
<Link href={`/${locale}/sparks/${spark.id}`} className="ccard">
  <div className="cc-cover" style={{ '--pt': statusToken } as React.CSSProperties}>
    <div className="cc-pills">
      <span className={`pill spark-${statusClass}`}>{statusLabel}</span>
      <span className={`pill vis-${visibilityClass}`}>{visibilityLabel}</span>
    </div>
  </div>
  <div className="cc-body">
    <h3 className="cc-title">{spark.title}</h3>
    <p className="cc-desc">{spark.description}</p>
    <div className="cc-foot">
      {spark.status === 'VOTING' && spark.votingEndsAt ? (
        <Countdown to={spark.votingEndsAt} prefix="" />
      ) : null}
      <div className="cc-stats">
        <span className="cc-stat"><FileText /> {spark.entryCount}</span>
      </div>
    </div>
  </div>
</Link>
```

- [ ] **Step 4: Wrap existing `<Countdown>` inside `.deadline` recessed chip.**

In countdown component:
```tsx
<span className="deadline"><Clock /> <b>{timeLabel}</b> left</span>
```

- [ ] **Step 5: Run tsc + tests + dev smoke.**

Confirm: brand-yellow PageHead, 3 sections render, sparks cards have brand-yellow hover ring, deadline chips on VOTING sparks. No regression in `sweepSparkStatuses` lazy-sweep behavior.

- [ ] **Step 6: Commit.**

```bash
git add app/\[locale\]/\(public\)/sparks/ app/\[locale\]/\(public\)/discover/_components/spark-card.tsx
git commit -m "style(c5d/sparks-index): chrome refresh + deadline chip

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B3: `/sparks/[sparkId]` detail chrome refresh

**Files:**
- Modify: `app/[locale]/(public)/sparks/[sparkId]/page.tsx`
- Modify: existing entry list + SparkSubmitPanel chrome

- [ ] **Step 1: Read mockup `05-spark-detail.html`.**

- [ ] **Step 2: Wrap in `<main className="cm-wrap w-3xl">` + `<PageHead>` with eyebrow "Spark · @creator" + title = spark.title.**

Header includes status pill + visibility pill + countdown chip (`.deadline`).

- [ ] **Step 3: Re-skin entry list rows + `<SparkSubmitPanel>` as `.panel`.**

- [ ] **Step 4: Run tsc + tests + dev smoke.**

Confirm: status/visibility pills, deadline chip, entry rows. `<SparkSubmitPanel>` gating preserved. Entry sort opt-in via `sort='top'` on VOTING/CLOSED preserved.

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(public\)/sparks/\[sparkId\]/page.tsx
git commit -m "style(c5d/spark-detail): chrome refresh

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B4: `/sparks/[sparkId]/entry/[entryId]` reader chrome refresh

**Files:**
- Modify: `app/[locale]/(public)/sparks/[sparkId]/entry/[entryId]/page.tsx`
- Modify: existing SparkEntryComments + ReplyComposer chrome

- [ ] **Step 1: Read mockup `06-spark-entry.html`.**

- [ ] **Step 2: Wrap in `<main className="cm-wrap w-3xl">` + `<PageHead>` with eyebrow "Entry · in @{spark.title}" + title from `deriveTitle(entry.title, entry.content)`.**

- [ ] **Step 3: Re-skin prose body as `.panel.panel-pad` + comments as `.cstack`.**

`<SparkEntryComments>` 2-level threaded with `<ReplyComposer>` PRESERVED. `deriveTitle` headline PRESERVED. `<RenderMentionsInText>` wrapping PRESERVED.

- [ ] **Step 4: Run tsc + tests + dev smoke.**

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(public\)/sparks/\[sparkId\]/entry/\[entryId\]/page.tsx
git commit -m "style(c5d/spark-entry-reader): chrome refresh

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B5: `/reading-lists` index chrome refresh + ListCard

**Files:**
- Modify: `app/[locale]/(app)/reading-lists/page.tsx`
- Modify: `app/[locale]/(app)/reading-lists/_components/list-card.tsx`

- [ ] **Step 1: Read mockup `07-reading-lists.html`.**

Sections: My lists / Lists I follow. Liked variant shows 🤍 Auto pill.

- [ ] **Step 2: Wrap in `<main className="cm-wrap w-5xl">` + `<PageHead title="Reading lists" subtitle="Curate books worth reading. Follow friends' lists to track what they're loving.">`. Add `<CreateListButton>` in `headerSlot`.**

- [ ] **Step 3: Re-skin ListCard with `.ccard` structure.**

Liked variant uses `<span className="pill auto"><Heart fill /> Auto</span>` + private visibility pill.

- [ ] **Step 4: Run tsc + tests + dev smoke.**

Liked-list lazy-create preserved. 3-section query (`mine` / `following` / discover →) preserved.

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(app\)/reading-lists/page.tsx app/\[locale\]/\(app\)/reading-lists/_components/list-card.tsx
git commit -m "style(c5d/reading-lists): chrome refresh + Liked variant

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B6: `/clubs` index chrome refresh + ClubCard

**Files:**
- Modify: `app/[locale]/(app)/clubs/page.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/club-card.tsx`

- [ ] **Step 1: Read mockup `09-clubs.html`.**

- [ ] **Step 2: Wrap in `<main className="cm-wrap w-5xl">` + `<PageHead title="Book clubs" subtitle="Read together with friends. Discuss, schedule, and keep up with the current book.">` + `<CreateClubButton>` in `headerSlot`.**

- [ ] **Step 3: Re-skin ClubCard with `.ccard` structure.**

Pills: visibility + open-join (when applicable). Tag chips first 3 + "+N more". Owner avatar/handle + currentBook line + member count.

- [ ] **Step 4: Run tsc + tests + dev smoke.**

`getClubsAction({filter:'mine'})` preserved.

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(app\)/clubs/page.tsx app/\[locale\]/\(app\)/clubs/_components/club-card.tsx
git commit -m "style(c5d/clubs-index): chrome refresh + ClubCard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B7: Club Books panel chrome refresh (3 sections + queue dnd)

**Files:**
- Modify: `app/[locale]/(app)/clubs/_components/club-books-panel.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/club-book-row.tsx`

- [ ] **Step 1: Read mockup `10b-club-books-panel.html`.**

3 sections: Currently reading / Up next (QUEUE w/ dnd reorder) / Past reads (accordion).

- [ ] **Step 2: Re-skin section headers as `<div className="sec-head"><h2>...</h2></div>` + book rows as `.tile.tile-pad` with grid layout.**

- [ ] **Step 3: Verify dnd-kit reorder for queue MOD+ preserved.**

`deriveCurrentBookTx` atomic 4-step pattern PRESERVED. Partial-unique-index `CURRENT` constraint PRESERVED.

- [ ] **Step 4: Run tsc + tests + dev smoke.**

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(app\)/clubs/_components/club-books-panel.tsx app/\[locale\]/\(app\)/clubs/_components/club-book-row.tsx
git commit -m "style(c5d/club-books-panel): 3-section chrome refresh

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B8: Club Discussions panel + DiscussionCard chrome refresh

**Files:**
- Modify: `app/[locale]/(app)/clubs/_components/club-discussions-panel.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/discussion-card.tsx`

- [ ] **Step 1: Read mockups `10c-club-discussions-panel.html` + `11-club-discussion-thread.html`.**

`.disc-card` 2-col grid: title+meta left / reply count right.

- [ ] **Step 2: Re-skin DiscussionCard.**

```tsx
<Link className="tile tile-pad disc-card" href={...}>
  <div>
    <h3 className="dc-title">
      {discussion.isPinned ? <Pin /> : null}
      {discussion.title}
    </h3>
    <div className="dc-meta">
      <span className="meta">@{author.username}</span>
      <span className="dot-sep" />
      <span className="meta">{relTime(discussion.createdAt)}</span>
      {discussion.topic ? <span className={`pill topic-${topicClass}`}>{discussion.topic}</span> : null}
    </div>
  </div>
  <div className="dc-stats">
    <span className="cc-stat"><MessageCircle /> {discussion.replyCount}</span>
    <span className="cc-stat"><Heart /> {discussion.likeCount}</span>
  </div>
</Link>
```

- [ ] **Step 3: Run tsc + tests + dev smoke.**

Pinned-first sort tuple PRESERVED. `viewerLiked` two-query stitch PRESERVED.

- [ ] **Step 4: Commit.**

```bash
git add app/\[locale\]/\(app\)/clubs/_components/club-discussions-panel.tsx app/\[locale\]/\(app\)/clubs/_components/discussion-card.tsx
git commit -m "style(c5d/club-discussions): .disc-card 2-col forum rows

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B9: Club Schedule panel chrome refresh

**Files:**
- Modify: `app/[locale]/(app)/clubs/_components/club-schedule-panel.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/schedule-item-row.tsx`

- [ ] **Step 1: Read mockup `10e-club-schedule-panel.html`.**

Timeline view sorted targetDate ASC + past/today/future indicators.

- [ ] **Step 2: Re-skin schedule rows as `.tile.tile-pad` + past/today/future status indicator via local date comparison.**

- [ ] **Step 3: Run tsc + tests + dev smoke.**

`getClubScheduleAction(clubId, currentBookId)` preserved. canManageSchedule gating preserved.

- [ ] **Step 4: Commit.**

```bash
git add app/\[locale\]/\(app\)/clubs/_components/club-schedule-panel.tsx app/\[locale\]/\(app\)/clubs/_components/schedule-item-row.tsx
git commit -m "style(c5d/club-schedule): timeline chrome refresh

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B10: Club Settings panel + VisibilityPicker selected-state polish

**Files:**
- Modify: `app/[locale]/(app)/clubs/_components/club-settings-panel.tsx`
- Modify: `components/visibility-picker.tsx`

- [ ] **Step 1: Read mockup `10f-club-settings-panel.html`.**

- [ ] **Step 2: Re-skin Settings sub-panels (Metadata / Pending invites / Join requests / Invite by link / Transfer ownership / Danger Zone).**

Use `<section className="panel panel-pad">` for each.

- [ ] **Step 3: Re-skin `<VisibilityPicker>` selected-state with new tokens.**

For the selected card, `.vi` icon chip background flips to `oklch(from var(--brand) l c h / 0.2)` + the inner icon color flips to the corresponding `--list-visibility-*` token (e.g. selected Public → icon is `var(--list-visibility-public)`).

```tsx
const selectedTokenMap = {
  PUBLIC: 'var(--list-visibility-public)',
  FRIENDS: 'var(--list-visibility-friends)',
  PRIVATE: 'var(--list-visibility-private)',
};
// inside the option button:
style={isSelected ? {
  background: 'oklch(from var(--brand) l c h / 0.2)',
  color: selectedTokenMap[option.value],
} : undefined}
```

- [ ] **Step 4: Run tsc + tests + dev smoke.**

3-layer discoverable defense PRESERVED. Sub-panels (`<InviteByUsernameInput>`, `<InviteLinkDialog>`, `<PendingInvitesPanel>`, `<JoinRequestsPanel>`) PRESERVED — chrome polish only.

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(app\)/clubs/_components/club-settings-panel.tsx components/visibility-picker.tsx
git commit -m "style(c5d/club-settings + visibility-picker): chrome + selected polish

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B11: Club discussion thread page chrome refresh

**Files:**
- Modify: `app/[locale]/(app)/clubs/[clubId]/discussions/[discussionId]/page.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/discussion-detail.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/reply-composer.tsx`

- [ ] **Step 1: Read mockup `11-club-discussion-thread.html`.**

- [ ] **Step 2: Wrap in `<main className="cm-wrap w-3xl">` + `<PageHead>` with eyebrow "Discussion · in @{club.name}" + title = discussion.title.**

- [ ] **Step 3: Re-skin DiscussionDetail post + replies + ReplyComposer.**

Post body in `.panel.panel-pad`; replies in `.cstack` with each reply as `.tile.tile-pad`. ReplyComposer as `.panel.panel-pad` with `.input textarea`.

- [ ] **Step 4: Run tsc + tests + dev smoke.**

`viewerLiked` per-row PRESERVED. PinToggle MOD+ gate PRESERVED. Reply count denorm PRESERVED.

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(app\)/clubs/\[clubId\]/discussions/\[discussionId\]/page.tsx app/\[locale\]/\(app\)/clubs/_components/discussion-detail.tsx app/\[locale\]/\(app\)/clubs/_components/reply-composer.tsx
git commit -m "style(c5d/club-thread): post + replies + composer chrome

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B12: `/settings/notifications` chrome refresh

**Files:**
- Modify: `app/[locale]/(app)/settings/notifications/page.tsx`
- Modify: `app/[locale]/(app)/settings/notifications/_components/notification-preferences-form.tsx`

- [ ] **Step 1: Read mockup `13-notification-prefs.html`.**

Single-panel multi-section (Friends / Mentions / Activity / Group invites). shadcn-flavored `.switch` rendered via `[aria-checked]`.

- [ ] **Step 2: Wrap in `<main className="cm-wrap w-3xl">` + `<PageHead title="Notifications" subtitle="Choose which alerts make it to your inbox.">`.**

- [ ] **Step 3: Re-skin form sections as `<section className="panel panel-pad">` with `<div className="sec-head"><h2>...</h2></div>` per section.**

- [ ] **Step 4: Verify the shadcn Switch primitive inherits the `.switch[aria-checked]` styling.**

If the Switch primitive renders a `data-state="checked"` attribute instead of `aria-checked`, add a parallel CSS selector:
```css
.switch[data-state="checked"] { background: var(--brand); }
.switch[data-state="checked"]::after { transform: translateX(18px); background: var(--brand-ink); }
```

- [ ] **Step 5: Run tsc + tests + dev smoke.**

Optimistic toggle + sonner rollback PRESERVED. 4-section grouping PRESERVED. `shouldSkipNotification` skip-at-write enforcement PRESERVED.

- [ ] **Step 6: Commit.**

```bash
git add app/\[locale\]/\(app\)/settings/notifications/
git commit -m "style(c5d/notification-prefs): single-panel sections + Switch chrome

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B13: Claim flows (friend invite + club invite) — port to `.claim-card` chrome

**Files:**
- Modify: `app/[locale]/(public)/friend-invite/[token]/page.tsx`
- Modify: `app/[locale]/(public)/clubs/[clubId]/invite/[token]/page.tsx`
- Modify: `app/[locale]/(public)/clubs/[clubId]/invite/[token]/_components/invite-result.tsx`

- [ ] **Step 1: Read mockups `14-friend-invite-claim.html` + `15-club-invite-claim.html`.**

- [ ] **Step 2: Re-skin friend-invite page as `.claim-stage > .claim-card`.**

```tsx
<div className="claim-stage">
  <div className="claim-card">
    <div className={`icon-wrap tone-${tone}`}><Icon /></div>
    <h1>{title}</h1>
    <p>{message}</p>
    <div className="actions">
      <Link className="btn-brand" href={primaryHref}>{primaryLabel}</Link>
      {secondary ? <Link className="btn-ghost" href={secondary.href}>{secondary.label}</Link> : null}
    </div>
  </div>
</div>
```

Tone mapping: TOKEN_NOT_FOUND/TOKEN_EXPIRED/TOKEN_ALREADY_CLAIMED → `tone-error`; SELF_INVITE → `tone-warning`; BLOCKED → `tone-muted` (masquerades as TOKEN_NOT_FOUND per spec); success → `tone-success`.

- [ ] **Step 3: Same refresh for club-invite page + `<InviteResult>` component.**

Auth gate → sign-up redirect with `?next=` (safeNextPath) PRESERVED. Success redirect to `/u/{inviter}?invite_claimed=1` PRESERVED. BLOCKED masquerades as TOKEN_NOT_FOUND PRESERVED. ALREADY_MEMBER silent-redirects PRESERVED.

- [ ] **Step 4: Run tsc + tests + dev smoke.**

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(public\)/friend-invite/ app/\[locale\]/\(public\)/clubs/
git commit -m "style(c5d/claim-cards): friend + club invite chrome refresh

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task B14: Empty states + access-denied + bell dropdown chrome polish

**Files:**
- Modify: `app/[locale]/(app)/community/page.tsx` (empty branch)
- Modify: `app/[locale]/(app)/reading-lists/page.tsx` (empty branch)
- Modify: `app/[locale]/(app)/clubs/page.tsx` (empty branch)
- Modify: `app/[locale]/(public)/sparks/page.tsx` (empty branch)
- Modify: `app/[locale]/(public)/u/[username]/_components/profile-unavailable.tsx`
- Modify: `app/[locale]/(app)/_components/notifications-bell.tsx`

- [ ] **Step 1: Read mockups `16-empty-community.html` through `22-notification-bell-dropdown.html`.**

- [ ] **Step 2: Port each empty state to `.empty` hero shape.**

```tsx
<div className="empty">
  <div className="glyph"><BookOpen /></div>
  <h2>Your feed will appear here</h2>
  <p>Follow some writers to see their activity. Or check out who's worth following on Discover.</p>
  <div className="cta-row">
    <Link className="btn-brand" href={`/${locale}/friends?tab=suggested`}>Find friends</Link>
    <Link className="btn-tile" href={`/${locale}/discover`}>Browse Discover</Link>
  </div>
</div>
```

Surface-specific CTAs per spec: community → Find friends + Browse discover; reading-lists → Create your first list + Discover lists; clubs → Start a club + Discover clubs; sparks → Start your first + Browse closed.

- [ ] **Step 3: Re-skin `<ProfileUnavailable>` with `.claim-card` chrome.**

```tsx
<div className="claim-stage">
  <div className="claim-card">
    <div className="icon-wrap tone-muted"><Lock /></div>
    <h1>This profile is unavailable</h1>
    <p>You can't view this user's profile right now.</p>
    <div className="actions">
      <Link className="btn-brand" href={`/${locale}/discover`}>Browse Discover</Link>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Polish `<NotificationsBell>` chrome per Q1 (keep DropdownMenu shape).**

In `notifications-bell.tsx`:
1. Style the trigger button (42px square with brand bell + brand badge dot with 2px backdrop ring).
2. Style DropdownMenu items: per-row icon chip + unread row tinted `oklch(from var(--brand) l c h / 0.05)`.
3. Preserve existing async resolver + `pendingRowId` spinner (C5b T9).
4. Preserve existing `markNotificationReadAction` on click.
5. DO NOT replace DropdownMenu with a popover — Q1 REJECTED that deviation.

```tsx
// Trigger style
<DropdownMenuTrigger className="icon-btn relative" style={{ width: 42, height: 42 }}>
  <Bell style={{ color: 'var(--brand)' }} />
  {unreadCount > 0 ? (
    <span className="absolute -top-1 -right-1 size-4 rounded-full" style={{ background: 'var(--brand)', boxShadow: '0 0 0 2px var(--canvas-dark-200)' }} />
  ) : null}
</DropdownMenuTrigger>

// Per row, conditional bg + icon chip
<DropdownMenuItem
  className="flex items-start gap-3 px-3 py-2"
  style={isUnread ? { background: 'oklch(from var(--brand) l c h / 0.05)' } : undefined}
>
  <div className="size-8 rounded-full flex items-center justify-center" style={{ background: 'var(--canvas-dark-100)', boxShadow: 'var(--sh-inset)' }}>
    <NotificationIcon type={row.type} className="size-4 text-[var(--canvas-dark-ink-muted)]" />
  </div>
  ...
</DropdownMenuItem>
```

- [ ] **Step 5: Run tsc + tests + dev smoke.**

Walk each empty state. Trigger profile-unavailable scenario via blocked viewer test. Open bell — confirm DropdownMenu still opens, unread tint shows, icon chips render.

- [ ] **Step 6: Commit.**

```bash
git add app/\[locale\]/\(app\)/community/page.tsx app/\[locale\]/\(app\)/reading-lists/page.tsx app/\[locale\]/\(app\)/clubs/page.tsx app/\[locale\]/\(public\)/sparks/page.tsx app/\[locale\]/\(public\)/u/\[username\]/_components/profile-unavailable.tsx app/\[locale\]/\(app\)/_components/notifications-bell.tsx
git commit -m "$(cat <<'EOF'
style(c5d/empty + bell): port empty hero + profile-unavailable + bell chrome

Q1 lock preserved: bell stays a DropdownMenu (rejected popover D12).
Per-row icon chip + unread-row brand-tint background. Async resolver +
pendingRowId spinner from C5b T9 preserved.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase C — Structural changes (7 tasks, sequential within each surface)

Each task changes IA, data shape, or component structure. Surfaces are independently shippable.

---

### Task C1: `/community` section rail pill-rail rewrite + right-rail mini-panels

**Files:**
- Modify: `app/[locale]/(app)/community/_components/section-rail.tsx`
- Modify: `app/[locale]/(app)/community/_components/activity-event-row.tsx`
- Modify: `app/[locale]/(app)/community/_components/activity-feed.tsx`
- Modify: `app/[locale]/(app)/community/_components/requests-card.tsx`
- Modify: `app/[locale]/(app)/community/_components/sidebar/my-hives-panel.tsx`
- Modify: `app/[locale]/(app)/community/_components/sidebar/active-sparks-panel.tsx`
- Modify: `app/[locale]/(app)/community/page.tsx`

- [ ] **Step 1: Read mockup `01-community-hub.html`.**

Pill-rail with 5 tiles (Friends / Sparks / Lists / Clubs / Hives). 2-col grid (1fr 280px). Tile-card feed events. Right rail: 3 mini panels.

- [ ] **Step 2: Wrap page in `<main className="cm-wrap w-5xl">` + `<PageHead title="Hey @{user.name} — here's what's buzzing">`.**

Title can be conditional/personalized.

- [ ] **Step 3: Rewrite `<SectionRail>` as pill-rail.**

```tsx
export function SectionRail({ locale, friendCount, sparkCount, listCount, clubCount, hiveCount }: Props) {
  const tiles = [
    { href: `/${locale}/friends`, label: 'Friends', count: friendCount, icon: <Users /> },
    { href: `/${locale}/sparks`, label: 'Sparks', count: sparkCount, icon: <Sparkles /> },
    { href: `/${locale}/reading-lists`, label: 'Lists', count: listCount, icon: <BookMarked /> },
    { href: `/${locale}/clubs`, label: 'Clubs', count: clubCount, icon: <Users2 /> },
    // Q4 lock: Hives tile routes to /studio (no /hives index yet)
    { href: `/${locale}/studio`, label: 'Hives', sublabel: 'Your hives', count: hiveCount, icon: <Hexagon /> },
  ];
  return (
    <nav className="tabstrip mb-6" aria-label="Community sections">
      {tiles.map((tile) => (
        <Link key={tile.label} className="tab" href={tile.href}>
          {tile.icon}
          <span>{tile.label}</span>
          {tile.count != null ? <span className="ct">{tile.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: 2-col grid layout for body.**

```tsx
<div className="grid gap-6 lg:[grid-template-columns:1fr_280px]">
  <div>
    <ActivityFeed ... />
  </div>
  <aside className="space-y-4">
    <RequestsCard ... />
    <MyHivesPanel ... />
    <ActiveSparksPanel ... />
  </aside>
</div>
```

- [ ] **Step 5: Re-skin `<ActivityEventRow>` as `.tile.tile-pad.event-demo` 3-col.**

```tsx
<li className={`tile tile-pad ${isFriendEvent ? 'is-friend-event' : ''}`}>
  <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
    <div className={`avatar s40 a-${avatarTone}`}>{initials}</div>
    <div>
      <div className="text-sm">{verbSentence}</div>
      <div className="meta-mono mt-1">{relTime(createdAt)}</div>
    </div>
    {isFriendEvent ? <span className="pill brand-solid">FRIEND</span> : null}
  </div>
</li>
```

- [ ] **Step 6: Re-skin right-rail panels as `.panel.panel-pad`.**

`<RequestsCard>`: `<div className="sec-head"><h2>Requests</h2><span className="count">{n}</span></div>` + 2-col req-item rows + Accept/Decline btn pair. `<MyHivesPanel>`: panel + mini-row list. `<ActiveSparksPanel>`: panel + status pill + spark title + entries+deadline meta.

- [ ] **Step 7: Run tsc + tests + dev smoke.**

Feed cursor pagination, friend-first sort, `is-friend-event` left-edge stripe, RequestsCard accept/decline optimistic flow PRESERVED.

- [ ] **Step 8: Commit.**

```bash
git add app/\[locale\]/\(app\)/community/
git commit -m "$(cat <<'EOF'
feat(c5d/community-hub): pill-rail rewrite + right-rail polish

SectionRail rewrites as .tabstrip pill-rail (D1). Q4 lock preserved:
Hives tile keeps href=/studio with "Your hives" subline (no /hives
index yet). ActivityEventRow re-skinned as .tile.event-demo 3-col
with is-friend-event left-edge stripe (C5b T6). RequestsCard +
MyHivesPanel + ActiveSparksPanel re-skinned as .panel.panel-pad.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task C2: `/friends` 4-tab → 3-tab consolidation (Q3 IA tweak)

**Files:**
- Modify: `app/[locale]/(app)/friends/page.tsx`
- Modify: `app/[locale]/(app)/friends/_components/friends-tab-strip.tsx`
- Create: `app/[locale]/(app)/friends/_components/pending-tab.tsx` (new combined Received+Sent)
- Delete (or repurpose): `app/[locale]/(app)/friends/_components/requests-tab.tsx`, `sent-tab.tsx` (their content becomes sub-renders of pending-tab.tsx)

- [ ] **Step 1: Read mockup `02-friends.html`.**

3 tabs: Friends / Pending [Received+Sent segment] / Suggested. Pending has `.segment` sub-selector.

- [ ] **Step 2: Update `<FriendsTabStrip>` to 3 tabs.**

```tsx
const TABS = [
  { key: 'friends', label: 'Friends', count: friendsCount },
  { key: 'pending', label: 'Pending', count: pendingCount }, // count = received + sent
  { key: 'suggested', label: 'Suggested', count: suggestedCount },
] as const;
```

Map URL state: `?tab=friends|pending|suggested` (canonical) + `?seg=received|sent` (only when tab=pending).

- [ ] **Step 3: Create `<PendingTab>` combining received + sent.**

```tsx
'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function PendingTab({ received, sent }: PendingTabProps) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const seg = (sp.get('seg') === 'sent' ? 'sent' : 'received') as 'received' | 'sent';

  const setSeg = (next: 'received' | 'sent') => {
    const params = new URLSearchParams(sp.toString());
    params.set('tab', 'pending');
    params.set('seg', next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
      <div className="segment mb-4">
        <button className={seg === 'received' ? 'active' : ''} onClick={() => setSeg('received')}>
          Received ({received.length})
        </button>
        <button className={seg === 'sent' ? 'active' : ''} onClick={() => setSeg('sent')}>
          Sent ({sent.length})
        </button>
      </div>
      {seg === 'received' ? <RequestsList items={received} /> : <SentList items={sent} />}
    </div>
  );
}
```

`RequestsList` + `SentList` inline within `pending-tab.tsx`, reusing existing accept/reject/cancel server action wiring.

- [ ] **Step 4: Update `page.tsx` to route the new tabs.**

```tsx
const tab = searchParams.tab === 'pending' ? 'pending'
  : searchParams.tab === 'suggested' ? 'suggested'
  : 'friends';

// Backward-compat 308 redirects for legacy URLs
if (searchParams.tab === 'requests') {
  redirect(`/${locale}/friends?tab=pending&seg=received`);
}
if (searchParams.tab === 'sent') {
  redirect(`/${locale}/friends?tab=pending&seg=sent`);
}
```

Use `redirect` from `next/navigation` (it issues 307 for App Router — confirm; if 308 strictly required, use a route-handler or middleware redirect).

- [ ] **Step 5: Wrap `/friends` in `<main className="cm-wrap w-3xl">` + `<PageHead title="Friends" subtitle="Stay close with the people whose work you love.">`.**

Add `<UserSearch>` + `<InviteLinkDialog>` trigger in `headerSlot`.

- [ ] **Step 6: Run tsc + tests + dev smoke.**

`requests-tab` accept/reject server actions; `sent-tab` cancel server action; pagination on each tab PRESERVED.

- [ ] **Step 7: Commit.**

```bash
git add app/\[locale\]/\(app\)/friends/
git commit -m "$(cat <<'EOF'
feat(c5d/friends): 4-tab → 3-tab consolidation (Q3 IA tweak)

Friends / Pending [Received+Sent .segment] / Suggested. Legacy URL
contracts ?tab=requests + ?tab=sent get redirect()'d to ?tab=pending
&seg=received|sent. Accept/reject/cancel server actions preserved
verbatim from C1 T5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task C3: `/reading-lists/[listId]` — drag-handle col + StatStrip mount

**Files:**
- Modify: `app/[locale]/(app)/reading-lists/[listId]/page.tsx`
- Modify: `app/[locale]/(app)/reading-lists/_components/book-list.tsx`
- Modify: `app/[locale]/(app)/reading-lists/_components/book-row.tsx`
- Modify: `app/[locale]/(app)/reading-lists/_components/list-detail-header.tsx`

- [ ] **Step 1: Read mockup `08-reading-list-detail.html`.**

ListDetailHeader panel + 4-cell stat-strip (Books / Followers / Read / Created) + BookList w/ drag-handle col + show-more commentary.

- [ ] **Step 2: Wrap page in `<main className="cm-wrap w-5xl">` + `<PageHead>` with eyebrow "Reading list" + title = list.name.**

- [ ] **Step 3: Re-skin `<ListDetailHeader>` as `<section className="panel panel-pad">` with `<StatStrip>` mounted.**

```tsx
import { StatStrip } from '@/components/community/stat-strip';
// ...
<section className="panel panel-pad">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h1 className="font-display text-3xl">{list.name}</h1>
      {list.description ? <p className="meta mt-2 max-w-prose">{list.description}</p> : null}
      <div className="tag-row mt-3">
        {list.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
      </div>
    </div>
    <FollowListButton listId={list.id} initialFollowing={isFollowing} />
  </div>
  <hr className="divider my-5" />
  <StatStrip cells={[
    { value: list.bookCount, label: 'Books' },
    { value: list.followerCount, label: 'Followers' },
    { value: readCount ?? 0, label: 'Read' },
    { value: createdLabel, label: 'Created' },
  ]} />
</section>
```

- [ ] **Step 4: Re-shape `<BookRow>` to explicit drag-handle column.**

```tsx
<li className="book-row tile tile-pad">
  {canMutate ? (
    <button {...handleListeners} {...handleAttributes} className="br-handle" aria-label="Drag to reorder">
      <GripVertical />
    </button>
  ) : <span className="br-handle" />}
  <img src={book.coverUrl ?? PLACEHOLDER} className="br-thumb cover-paper" alt="" />
  <div>
    <h3 className="br-title">{book.title}</h3>
    <p className="br-author">by {book.author}</p>
    {book.rating != null ? <StarRating value={book.rating} editable={canMutate} onChange={...} /> : null}
    {book.commentary ? (
      <Commentary text={book.commentary} threshold={140} />
    ) : null}
  </div>
  <div className="flex items-center gap-2">
    {canMutate ? <ReadToggle isRead={book.isRead} onChange={...} /> : null}
    {canMutate ? <BookRowKebab ... /> : null}
  </div>
</li>
```

`<Commentary>` inline component with 140-char "Show more" toggle preserved from C3 T13. dnd-kit reorder (owner+CUSTOM only) preserved. 5-star inline edit + `LIKED_LIST_IMMUTABLE` server guard PRESERVED.

- [ ] **Step 5: Run tsc + tests + dev smoke.**

- [ ] **Step 6: Commit.**

```bash
git add app/\[locale\]/\(app\)/reading-lists/
git commit -m "$(cat <<'EOF'
feat(c5d/list-detail): drag-handle col + StatStrip mount

ListDetailHeader gets 4-cell stat-strip (Books / Followers / Read /
Created) replacing inline comma-separated meta line. BookRow gains
explicit drag-handle column per D11 (.book-row grid is
18px 64px 1fr auto). dnd-kit reorder + LIKED_LIST_IMMUTABLE +
5-star inline edit preserved.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task C4: `/clubs/[clubId]` tab reorder + 2-col About grid + cover-band header

**Files:**
- Modify: `app/[locale]/(app)/clubs/[clubId]/page.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/club-tab-strip.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/club-about-panel.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/club-header.tsx`

- [ ] **Step 1: Read mockup `10-club-detail.html`.**

6-tab order: About / Books / Discussions / Members / Schedule / Settings (Books promoted from 3rd → 2nd). Cover-band header above avatar/title/CTA. 2-col About grid.

- [ ] **Step 2: Update `<ClubTabStrip>` tab order.**

```tsx
const TABS = [
  { key: 'about', label: 'About' },
  { key: 'books', label: 'Books' },
  { key: 'discussions', label: 'Discussions' },
  { key: 'members', label: 'Members' },
  { key: 'schedule', label: 'Schedule' },
  // Settings only visible to OWNER/MOD
];
if (isModOrOwner) TABS.push({ key: 'settings', label: 'Settings' });
```

- [ ] **Step 3: Update `page.tsx` default tab parser to match Q3 reorder.**

Member default → 'about' (no longer 'discussions'). Non-member default → 'about'. Settings fallback for non-mod still → 'about'.

- [ ] **Step 4: Re-skin `<ClubHeader>` with cover-band.**

```tsx
<section className="panel" style={{ overflow: 'hidden' }}>
  <div className="cover-grad" style={{ height: 100, '--pt': accentTokenForClub } as React.CSSProperties} />
  <div className="panel-pad" style={{ paddingTop: 18 }}>
    <div className="flex items-end justify-between gap-4 -mt-12">
      <div className="flex items-end gap-4">
        <div className="avatar s80 a-blue">{initials}</div>
        <div>
          <h1 className="font-display text-3xl">{club.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`pill vis-${visClass}`}>{visLabel}</span>
            {club.openJoin ? <span className="pill open-join">Open join</span> : null}
          </div>
        </div>
      </div>
      <SmartCTA viewer={viewerMembership} clubId={club.id} openJoin={club.openJoin} />
    </div>
  </div>
</section>
```

`accentTokenForClub` derived from club's primary tag or random per-club hash. Fallback `var(--brand)`.

- [ ] **Step 5: Re-shape `<ClubAboutPanel>` to 2-col grid.**

```tsx
<section className="panel panel-pad">
  <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
    <div>
      <h2 className="font-display text-brand text-lg mb-2">About</h2>
      <p className="meta">{club.description}</p>
      {club.rules ? (
        <>
          <h3 className="eyebrow-mono mt-4 mb-2">Rules</h3>
          <p className="meta">{club.rules}</p>
        </>
      ) : null}
      <div className="tag-row mt-4">
        {club.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
      </div>
    </div>
    <div className="space-y-4">
      {currentBook ? (
        <div className="tile tile-pad">
          <div className="eyebrow-mono mb-2">Currently reading</div>
          <div className="font-display font-bold">{currentBook.title}</div>
          <div className="meta">by {currentBook.author}</div>
        </div>
      ) : null}
      <div className="tile tile-pad">
        <div className="eyebrow-mono mb-2">Info</div>
        <div className="meta">{club.memberCount} members</div>
        <div className="meta">Created {createdLabel}</div>
      </div>
    </div>
  </div>
</section>
```

Stacks on mobile via Tailwind's responsive prefix.

- [ ] **Step 6: Run tsc + tests + dev smoke.**

`?tab=` URL contract preserved. mod/owner Settings gate preserved. `viewerMembership` pending-request pill follow-up still open (not blocked here).

- [ ] **Step 7: Commit.**

```bash
git add app/\[locale\]/\(app\)/clubs/\[clubId\]/page.tsx app/\[locale\]/\(app\)/clubs/_components/club-tab-strip.tsx app/\[locale\]/\(app\)/clubs/_components/club-about-panel.tsx app/\[locale\]/\(app\)/clubs/_components/club-header.tsx
git commit -m "$(cat <<'EOF'
feat(c5d/club-detail): tab reorder (Q3) + 2-col About + cover-band

6-tab order: About / Books / Discussions / Members / Schedule / Settings
(Books promoted 3rd → 2nd). ClubHeader gets cover-grad banner above
avatar/title/CTA cluster. ClubAboutPanel splits 2-col (description+
rules+tags / currentBook+info). URL contract unchanged.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task C5: Club Members panel forum-table port + `.pill.role-owner` lock (13th brand-yellow)

**Files:**
- Modify: `app/[locale]/(app)/clubs/_components/club-members-panel.tsx`

- [ ] **Step 1: Read mockup `10d-club-members-panel.html`.**

Forum-table (avatar+identity / role pill / actions) + `.pill.role-owner = var(--brand)`.

- [ ] **Step 2: Re-shape panel as `.ftable`.**

```tsx
<section className="panel ftable">
  <div className="strip">
    <ul style={{ gridTemplateColumns: '1fr 120px 100px' }}>
      <li>Member</li>
      <li>Role</li>
      <li className="ralign">Actions</li>
    </ul>
  </div>
  <ul className="rows">
    {members.map((m) => (
      <li key={m.userId} style={{ gridTemplateColumns: '1fr 120px 100px' }}>
        <div className="flex items-center gap-3">
          <div className={`avatar s32 a-${avatarTone(m)}`}>{initials(m)}</div>
          <div>
            <div className="font-display font-semibold">{m.displayName ?? m.username}</div>
            <div className="meta-mono">@{m.username}</div>
          </div>
        </div>
        <div>
          {m.role === 'OWNER' ? (
            <span className="pill role-owner">Owner</span>
          ) : m.role === 'MODERATOR' ? (
            <span className="pill role-mod">Mod</span>
          ) : (
            <span className="pill role-member">Member</span>
          )}
        </div>
        <div className="ralign">
          {canManageMember(viewerRole, m) ? (
            <MemberKebab member={m} viewerRole={viewerRole} clubId={club.id} />
          ) : null}
        </div>
      </li>
    ))}
  </ul>
</section>
```

`<MemberKebab>` houses: Change role (OWNER → MOD/MEMBER), Remove member, Transfer ownership (OWNER's row only).

- [ ] **Step 3: Visual verify: Owner pill renders brand-yellow.**

This is the 13th sanctioned brand-yellow surface lock. Smoke confirm: in a club with an Owner, the Owner pill renders with brand-yellow tinted bg + brand-yellow text + brand-yellow border (`.pill.role-owner { --pt: var(--brand) }` cascade through `.pill { background: oklch(from var(--pt) l c h / 0.14); color: var(--pt); border: 1px solid oklch(from var(--pt) l c h / 0.30) }`).

- [ ] **Step 4: Run tsc + tests + dev smoke.**

OWNER full control + Transfer ownership preserved. MOD limited to Remove MEMBERs preserved. CANNOT_REMOVE_OWNER guard preserved.

- [ ] **Step 5: Commit.**

```bash
git add app/\[locale\]/\(app\)/clubs/_components/club-members-panel.tsx
git commit -m "$(cat <<'EOF'
feat(c5d/club-members): forum-table port + 13th brand-yellow surface

Members panel re-shaped as .ftable (column-header strip + divide-y
rows). Owner pill (.pill.role-owner → var(--brand)) is the 13th
sanctioned brand-yellow surface — categorical twin of premium badge
+ active status pill. Mod (--club-role-mod slate blue) + Member
(--club-role-member muted) round out the role accent palette.
OWNER/MOD action gates + Transfer ownership + CANNOT_REMOVE_OWNER
preserved.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task C6: `/u/[username]` profile full refresh + section reorder + Sparks+Activity merge

**Files:**
- Modify: `app/[locale]/(public)/u/[username]/page.tsx`
- Modify: `app/[locale]/(public)/u/[username]/_components/follow-button.tsx` (chrome)
- Modify: `app/[locale]/(public)/u/[username]/_components/friend-status-section.tsx` (chrome)
- Modify: `lib/actions/user-profile.actions.ts` (merge Sparks+Activity)

- [ ] **Step 1: Read mockup `12-profile.html` + `19-empty-profile-own.html`.**

Section order (Q3): Header / bio / friendship UI / stats / Lists / Clubs / Books / merged Sparks+Activity. `--canvas-dark-100` backdrop. `.stat-strip` with 4 cells (Followers / Following / Books / Clubs per Q3).

- [ ] **Step 2: Replace page bg `bg-[#141414]` with `bg-[var(--canvas-dark-100)]`.**

Look for the bg class in page.tsx:119. Also audit any `#888` muted hex + `border-[#2a2a2a]` pre-design-system hex — replace with tokens (`var(--canvas-dark-ink-muted)` + `var(--br-card)`).

- [ ] **Step 3: Preserve block-aware masquerade BEFORE data fetch.**

```tsx
// MUST stay near top of page.tsx, before any other data fetches
const block = await checkBlockBetween(viewerId, profileUserId);
if (block) {
  return <ProfileUnavailable />;
}
```

- [ ] **Step 4: Add `getProfileMergedFeedAction` to user-profile.actions.ts.**

```tsx
'use server';

export async function getProfileMergedFeedAction(
  targetUserId: string,
  { cursor, limit = 20 }: { cursor?: string; limit?: number } = {}
): Promise<ActionResult<{ rows: ProfileFeedRow[]; nextCursor: string | null }>> {
  const viewerId = await getOptionalUserId();
  // Fetch sparks + activity in parallel
  const [sparksRes, activityRes] = await Promise.all([
    getProfileSparksAction(targetUserId, { cursor, limit }),
    getProfileActivityAction(targetUserId, { cursor, limit }),
  ]);
  if (!sparksRes.success) return sparksRes;
  if (!activityRes.success) return activityRes;
  // Interleave by createdAt desc
  type Row = { kind: 'spark'; row: ProfileSparkRow } | { kind: 'activity'; row: ProfileActivityRow };
  const merged: Row[] = [
    ...sparksRes.data.rows.map((row) => ({ kind: 'spark' as const, row })),
    ...activityRes.data.rows.map((row) => ({ kind: 'activity' as const, row })),
  ];
  merged.sort((a, b) => new Date(b.row.createdAt).getTime() - new Date(a.row.createdAt).getTime());
  const sliced = merged.slice(0, limit);
  // Cursor encoding: base64url JSON of last row's { createdAt, id } tuple
  const last = sliced[sliced.length - 1];
  const nextCursor = sliced.length === limit && last
    ? Buffer.from(JSON.stringify({ createdAt: last.row.createdAt, id: last.row.id })).toString('base64url')
    : null;
  return { success: true, data: { rows: sliced.map((m) => m.row), nextCursor } };
}
```

Type `ProfileFeedRow = ProfileSparkRow | ProfileActivityRow` (discriminated union — the existing rows already carry a kind/type field; if not, add `kind: 'spark' | 'activity'`).

Note: this merge is server-side. If the existing actions DON'T page by the same cursor format, do client-side render-merge instead (fetch both, sort, render). Decide at impl time based on existing action shapes.

- [ ] **Step 5: Rewrite page section order per Q3.**

```tsx
<main className="cm-wrap w-5xl bg-[var(--canvas-dark-100)]">
  {/* 1. Header (avatar + name + handle) */}
  <ProfileHeader profile={profile} />

  {/* 2. Bio */}
  {profile.bio ? (
    <section className="panel panel-pad mt-4">
      <RenderMentionsInText text={profile.bio} />
    </section>
  ) : null}

  {/* 3. Friendship UI */}
  <FriendStatusSection profile={profile} viewerId={viewerId} className="mt-4" />

  {/* 4. Stats (4-cell — Q3 lock) */}
  <section className="panel mt-4">
    <StatStrip cells={[
      { value: profile.followerCount, label: 'Followers' },
      { value: profile.followingCount, label: 'Following' },
      { value: profile.bookCount, label: 'Books' },
      { value: profile.clubCount, label: 'Clubs' },
    ]} />
  </section>

  {/* 5. Lists */}
  {lists.length > 0 ? (
    <section className="mt-6">
      <div className="sec-head"><h2>Lists</h2></div>
      <div className="grid-3">{lists.map((l) => <ListCard key={l.id} list={l} />)}</div>
    </section>
  ) : null}

  {/* 6. Clubs */}
  {clubs.length > 0 ? (
    <section className="mt-6">
      <div className="sec-head"><h2>Clubs</h2></div>
      <div className="grid-3">{clubs.map((c) => <ClubCard key={c.id} club={c} />)}</div>
    </section>
  ) : null}

  {/* 7. Published books */}
  {books.length > 0 ? (
    <section className="mt-6">
      <div className="sec-head"><h2>Books</h2></div>
      <div className="grid-3">{books.map((b) => <BookCard key={b.id} book={b} />)}</div>
    </section>
  ) : null}

  {/* 8. Merged Sparks+Activity */}
  <section className="mt-6">
    <div className="sec-head"><h2>Recent activity</h2></div>
    <ProfileMergedFeed targetUserId={profile.userId} />
  </section>
</main>
```

- [ ] **Step 6: Re-skin `<FollowButton>` + `<FriendStatusSection>` chrome.**

Use `.btn-brand` for primary Follow / Send request CTA. Use `.btn-tile` for "Following" / "Friends" state. `<FriendStatusSection>`'s kebab (Mute / Block / View on Friends) uses `.kebab` chrome.

- [ ] **Step 7: Update `<ProfileHeader>` to consume new chrome.**

Avatar `.avatar.s80` + `.font-display` h1 + `.meta-mono` handle line.

- [ ] **Step 8: Run tsc + tests + dev smoke.**

Block-aware masquerade preserved AT TOP (before any other data fetch). FriendButton + FollowButton + FriendStatusSection preserved. `getMutualFriends` + mute lookup preserved. `bookCount` + `wordCount` projections preserved (wordCount no longer in stat-strip per Q3, but kept on the projection for backward compat).

- [ ] **Step 9: Commit.**

```bash
git add app/\[locale\]/\(public\)/u/\[username\]/ lib/actions/user-profile.actions.ts
git commit -m "$(cat <<'EOF'
feat(c5d/profile): full chrome refresh + Q3 section reorder + merged feed

Backdrop bg-[#141414] → bg-[var(--canvas-dark-100)] (pre-design-system
hex eviction). Section order locked to Q3: Header / bio / friendship UI
/ stats / Lists / Clubs / Books / merged Sparks+Activity. StatStrip is
4-cell (Followers / Following / Books / Clubs) per Q3 lock — Words +
Sparks dropped from strip since they get dedicated sections below.
New getProfileMergedFeedAction interleaves Sparks + Activity by
createdAt desc with cursor pagination. Block-aware masquerade
preserved BEFORE any data fetch.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task C7: Activity feed integration sweep

**Files:**
- Modify: `app/[locale]/(app)/community/_components/activity-event-row.tsx` (final pass)
- Modify: `app/[locale]/(app)/community/_components/activity-feed.tsx` (final pass)

- [ ] **Step 1: Sweep the activity event row variants.**

For every event-type variant in `<ActivityEventRow>`'s switch (chapter_posted / book_published / book_liked / book_commented / spark_entry_submitted / spark_won_* / hive_created / hive_joined / reading_list_created / books_added_batch / book_club_created / book_club_current_book_changed), confirm:
1. Avatar renders via `.avatar.s40.a-<tone>`.
2. Sentence + meta-mono rendering uses `.meta-mono` for the relTime.
3. `is-friend-event` left-edge stripe class applied conditionally.
4. Subject cards (book / chapter / hive / club / reading_list) re-skinned to `.tile.tile-pad` if previously bare.

- [ ] **Step 2: ActivityFeed cursor + Load older button polish.**

`.btn-tile` for "Load older" CTA. Optimistic state on click. Friend-first cursor decoder (C5b) preserved.

- [ ] **Step 3: Run tsc + tests + dev smoke.**

`recordSocialActivityTx` writers preserved. Per-actor-per-target 6h dedupe preserved.

- [ ] **Step 4: Commit.**

```bash
git add app/\[locale\]/\(app\)/community/_components/activity-event-row.tsx app/\[locale\]/\(app\)/community/_components/activity-feed.tsx
git commit -m "$(cat <<'EOF'
style(c5d/activity-feed): per-type variant chrome sweep

Final pass on ActivityEventRow's switch — every event-type variant
uses .avatar.s40 + .meta-mono + .is-friend-event. Subject card chrome
unified to .tile.tile-pad. ActivityFeed Load older uses .btn-tile.
Friend-first cursor decoder (C5b) preserved.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase D — Smoke + Ship (2 tasks)

---

### Task D1 (S1): 22-scenario manual smoke

**Files:** (none — manual verification)

- [ ] **Step 1: Boot `npm run dev` + walk each of the 22 surfaces.**

Per surface, verify visually + interactively:
1. `/community` — pill-rail, 2-col layout, RequestsCard/MyHives/ActiveSparks panels.
2. `/friends` — 3 tabs, Pending tab has segment selector. Legacy `?tab=requests` URL redirects to `?tab=pending&seg=received`.
3. `/discover` — bg `#262728`, brand-yellow PageHead, tab strip works.
4. `/sparks` — 3 sections, SparkCard chrome, deadline chip on VOTING.
5. `/sparks/[sparkId]` — status/visibility pills, deadline chip, submit panel.
6. `/sparks/[sparkId]/entry/[entryId]` — derived-title h1, comments.
7. `/reading-lists` — Mine + Following sections, Liked variant Auto pill.
8. `/reading-lists/[listId]` — StatStrip 4 cells, BookRow drag-handle col.
9. `/clubs` — ClubCard chrome.
10. `/clubs/[clubId]` — 6 tabs in order About / Books / Discussions / Members / Schedule / Settings. Cover-band header. 2-col About grid.
10b. Books panel — 3 sections.
10c. Discussions panel — `.disc-card` 2-col rows.
10d. Members panel — `.ftable` forum-table, **Owner pill is brand-yellow** (13th surface lock).
10e. Schedule panel — timeline.
10f. Settings panel — VisibilityPicker selected-state polish.
11. Club discussion thread — post + replies + composer.
12. `/u/[username]` — section order: Header / bio / friendship UI / stats (4-cell) / Lists / Clubs / Books / merged Activity. Bg `#262728`.
13. `/settings/notifications` — single-panel sections, Switch `[aria-checked]`.
14. `/friend-invite/[token]` — claim-card chrome.
15. `/clubs/[clubId]/invite/[token]` — claim-card chrome.
16. Empty `/community` (test account with no follows) — `.empty` hero.
17. Empty `/reading-lists` (fresh account) — `.empty` hero.
18. Empty `/clubs` (fresh account) — `.empty` hero.
19. Empty own profile (fresh account) — empty state.
20. Empty `/sparks` — `.empty` hero.
21. Profile of a blocked user — `<ProfileUnavailable>` claim-card.
22. Notifications bell — DropdownMenu (NOT popover per Q1), per-row icon chip, unread tint, MENTION spinner.

- [ ] **Step 2: Confirm AppNav stays mounted on every authed route.**

- [ ] **Step 3: Run final test + tsc.**

```bash
npx tsc --noEmit
npm test
```

Expected: 634/634 tests, tsc clean.

- [ ] **Step 4: If any scenario fails, file `fix(c5d): ...` follow-ups before S2.**

---

### Task D2 (S2): AGENTS.md ship summary + close C5d

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add "Community Phase — C5d Claude Design Port" entry under "What Has Been Built".**

Use C5b's ship entry as a template. Include:
- 4-phase shape (A foundation / B visual polish / C structural / D smoke).
- Commit SHA map.
- 8 new tokens + 13th brand-yellow surface lock.
- Q1-Q4 decisions encoded.
- Patterns now load-bearing (community.css → globals.css single source of truth, `<PageHead>` + `<StatStrip>` shared components, 3-tab friends consolidation, club 6-tab reorder, profile section reorder, Owner pill = brand-yellow).
- Known follow-ups (`ClubSummary.viewerMembership.pendingJoinRequest` widening still open from C4 T13; `?invite_claimed=1` sonner toast handler verification).

- [ ] **Step 2: Update "📍 Resume Here" block.**

Set `Last updated` to the ship date. `Current focus` = "Community phase ✅ COMPLETE (C1 + C2 + C3 + C4 + C5a + C5b + C5d shipped end-to-end). Awaiting Chris's pick on next phase." `Next concrete step` = "Decide next phase: ..."

- [ ] **Step 3: Commit.**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs(agents): C5d ship summary — Community Claude Design port complete

22 surfaces ported across 4 phases (A foundation + B visual + C
structural + D smoke). 8 new tokens + 13th brand-yellow surface lock.
Q1-Q4 decisions encoded: bell stays DropdownMenu (Q1), sonner default
toast (Q2), 4-stat strip (Q3), Hives tile → /studio (Q4).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

### 1. Spec coverage

Walking each spec section:
- **§1 Tokens** → Task A1. All 8 new tokens land. Bent-rule documented in A1 step 4.
- **§2 Viewport / layout shell** → Task A2 (`.cm-wrap.w-md/-3xl/-5xl`, `.page-head`). `.route-tag` explicitly omitted per spec. No `<CommunityPageShell>` wrapper component (per spec).
- **§3 Structural deviations** — D1-D18:
  - D1 (pill-rail) → C1.
  - D2 (Hives tile → /studio) → Q4 lock in C1.
  - D3 (`is-friend-event` already shipped) → verified in C7.
  - D4 (discover bg fix) → B1.
  - D5 (profile bg + chrome) → C6.
  - D6 (sparks+activity merge) → C6 step 4.
  - D7 (profile 4-stat strip per Q3) → C6 step 5.
  - D8 (club cover-band) → C4.
  - D9 (club 2-col About) → C4 step 5.
  - D10 (list stat-strip) → C3 step 3.
  - D11 (book-row drag-handle col) → A2 (.book-row grid) + C3 step 4.
  - D12 (bell popover) → Q1 REJECTED — chrome polish only in B14.
  - D13 (sparks deadline chip) → B2 step 4.
  - D14 (.disc-card 2-col) → B8.
  - D15 (members forum-table + Owner brand-yellow) → C5.
  - D16 (VisibilityPicker selected polish) → B10 step 3.
  - D17 (bell unread tint) → B14 step 4.
  - D18 (notification prefs Switch) → B12 step 4.
- **§4 Per-surface table** → 22 surfaces mapped: 1=C1, 2=C2, 3=B1, 4=B2, 5=B3, 6=B4, 7=B5, 8=C3, 9=B6, 10=C4, 10b=B7, 10c=B8, 10d=C5, 10e=B9, 10f=B10, 11=B11, 12=C6, 13=B12, 14=B13, 15=B13, 16-20=B14, 21=B14, 22=B14.
- **§5 Shared components** → A3 lands `<PageHead>` + `<StatStrip>`. Per-component refreshes happen inside their consumer tasks.
- **§6 Roadmap** → 4 phases match: A (A1-A3) / B (B1-B14, 14 commits) / C (C1-C7, 7 commits) / D (D1-D2 smoke+ship).
- **§7 Do-not-disturb callouts** → repeated at the top of Phase B + inside each Phase C task brief.

**Gap check:** none. Every spec row maps to a task.

### 2. Placeholder scan

- No "TBD" / "TODO" in task code blocks.
- Each step is one action, 2-5 minutes.
- Concrete file paths everywhere.
- Code blocks complete in every step.
- Self-contained smoke walks in D1.

### 3. Type consistency

- `<PageHead>` props consistent across all consumers (A3 + B/C tasks): `eyebrow?: string; title: string; subtitle?: ReactNode; headerSlot?: ReactNode`.
- `<StatStrip>` props consistent: `cells: StatStripCell[]`.
- `StatStripCell` shape `{ value: string | number; label: string }` consistent in C3 (4-cell list detail) + C6 (4-cell profile).
- Friends tabs `?tab=friends|pending|suggested` + `?seg=received|sent` consistent in C2 step 2-4.
- Club tabs `?tab=about|books|discussions|members|schedule|settings` consistent in C4 step 2-3.
- `getProfileMergedFeedAction` return type `ActionResult<{ rows: ProfileFeedRow[]; nextCursor: string | null }>` consistent in C6 step 4.

### 4. Suggested execution waves

- **W1 (Phase A foundation, sequential):** A1 → A2 → A3. Each commits independently. ~3 commits.
- **W2 (Phase B visual polish, 4-5 way parallel per sub-wave):**
  - W2a parallel: B1 + B2 + B3 + B4 + B5 (isolated routes: discover, sparks index, spark detail, spark entry, reading-lists index).
  - W2b parallel: B6 + B7 + B8 + B9 + B10 (clubs index + 4 club panels — different files).
  - W2c parallel: B11 + B12 + B13 + B14 (thread, notif prefs, claim flows, empty states + bell).
- **W3 (Phase C structural, 3-way parallel where isolated):**
  - W3a parallel: C1 + C2 + C3 (community, friends, list detail — different surfaces).
  - W3b parallel: C4 + C5 (club detail + club members — both touch clubs/_components/ but isolated files).
  - W3c alone: C6 (profile full refresh — largest surface).
  - W3d alone: C7 (activity feed sweep — depends on C1 ship for context).
- **W4 (smoke + ship):** D1 → D2 sequential. ~2 commits.

**Total: ~25 commits across ~13 subagent dispatches.**

### Highest-risk tasks flagged

1. **C6 (Profile full refresh + Sparks+Activity merge)** — largest single surface; touches server action + multiple components + bg fix + section reorder + Q3 lock. Highest implementation risk. Should run alone (W3c) with a dedicated subagent context window.
2. **C5 (Members forum-table + 13th brand-yellow Owner pill)** — load-bearing: this commit locks the 13th brand-yellow surface in place. Smoke MUST visually confirm the Owner pill renders brand-yellow before ship.
3. **C4 (Club detail tab reorder + 2-col About + cover-band)** — touches 4 files in clubs/_components/ + the page.tsx tab parser. Default-tab logic for member vs non-member needs careful preservation.
4. **C2 (Friends 4→3 tab consolidation)** — URL contract change with legacy redirects. Worth a smoke pass on existing bookmarks.

### File-structure totals

- **New files:** ~3 (`page-head.tsx`, `stat-strip.tsx`, `pending-tab.tsx`).
- **Modified files:** ~30 across `app/`, `components/`, `lib/`, `AGENTS.md`.
- **Deleted files:** 0 (legacy `requests-tab.tsx` + `sent-tab.tsx` get their content absorbed into `pending-tab.tsx`; delete optional during C2 cleanup).

---
