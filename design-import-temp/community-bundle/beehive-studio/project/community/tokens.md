# Community C5d — Proposed tokens & bent-rule rationale

Reviewer: Chris · Designer pass on the social-media-hub layer.
These are **additive** to `app/globals.css`. Nothing existing is renamed or removed. Alpha tints are produced inline via `oklch(from var(--token) l c h / 0.X)` and need no token churn.

---

## 1. Token-value reconciliation (no new tokens — just confirming the base)

The C5d brief §2 lists `--canvas-dark-100: #262728` and the full `100→400` cool-gray scale, plus `--sh-card / --sh-tile / --sh-inset` and `--r-card / row / btn / pill`. **The shipped surfaces already use exactly these values** — see `share-dialog.html` and `Reader Theme Toggle.html` (`--app-bg: #262728`). The earlier `library.html` page-bg of `#1E1E1E` is a *studio-library* surface and is out of scope here. So Community builds on the §2 values verbatim; `community.css` is the canonical copy.

---

## 2. New categorical accent tokens (8)

The rule allows ~8 new categorical accents with scoped semantic names. I'm proposing **8**, in three families. Each replaces a current piggyback on `--status-*`, which was the single biggest source of "this phase looks accreted" — visibility, spark-state, and club-role were all borrowing chapter-status colors, so a *Voting* spark and a *First-draft* chapter were the same gold with no semantic link.

### 2a. List/visibility — 3 tokens
Used by every visibility pill across books, lists, clubs, and sparks. Previously no dedicated accent (pills borrowed status colors ad hoc).

```css
--list-visibility-public:  oklch(0.72 0.11 230);  /* sky blue — open to the world (Globe) */
--list-visibility-friends: oklch(0.74 0.12 145);  /* mint — your circle (Users)        */
--list-visibility-private: oklch(0.66 0.04 240);  /* cool gray — closed (Lock)          */
```
Rationale: visibility is a *cross-cutting* concept (5+ surfaces). It deserves one stable triad so "Public" always reads the same blue everywhere. Blue/mint/gray map intuitively to world→circle→closed and avoid colliding with the warm status ramp.

### 2b. Spark status — 3 tokens
```css
--spark-status-open:   oklch(0.74 0.12 145);  /* mint — accepting entries */
--spark-status-voting: oklch(0.78 0.13 70);   /* warm gold — voting live   */
--spark-status-closed: oklch(0.66 0.04 240);  /* cool gray — finished      */
```
Rationale: the spark state machine is the heartbeat of /sparks. Open (go, submit) reads green; Voting (active, urgent — pairs with the countdown deadline display) reads gold; Closed reads neutral. Semantically distinct from chapter-status even where hues rhyme.

### 2c. Club role — 2 tokens (owner reuses `--brand`, see §3)
```css
--club-role-mod:    oklch(0.72 0.11 250);   /* slate blue */
--club-role-member: oklch(0.680 0.003 256); /* muted ink  */
```
Rationale: clubs piggybacked on `--status-*` for role pills, which made "Owner" the same gold as "First-draft". Mod = slate blue (authority, distinct from owner), Member = muted ink (recedes). Hive roles keep their existing `--role-*` tokens unchanged; these are the *club* equivalents the brief flagged as candidates.

**Total new: 8** (`list-visibility ×3`, `spark-status ×3`, `club-role ×2`).

### Considered but NOT added
- `--topic-*` (discussion topics): the brief says "verify if it already exists for hive." Rather than spend tokens, topic pills **reuse the existing `--layer-*` palette** via `.pill.topic-*` mappings. If hive already ships `--topic-*`, point these at them during the port — no new tokens needed either way.
- `--goal-*` (word-goal types): word goals live mainly in the hive/studio scope, not Community. The `.pill.goal-*` classes map onto existing status/visibility tokens; promote to real tokens only if/when a goals surface lands in Community.

---

## 3. Bent rule — brand-yellow on the club Owner role pill (13th surface)

The restraint rule sanctions 12 brand-yellow placements and asks for explicit rationale on a 13th.

**Request:** allow `--club-role-owner` to map to `--brand` (i.e. the Owner pill is brand-yellow), as the §6 surface table (#10d) explicitly dictates ("OWNER brand / MOD blue / MEMBER muted").

**Rationale:** this isn't really a *new* surface — the owner pill is the categorical twin of the already-sanctioned "active status pill" and "premium badge" uses, and it appears at most once per members table. It reinforces the existing brand semantics (yellow = the locus of authority/ownership, same as the app logo and save indicator) rather than introducing decorative yellow. It is **not** applied to mod/member rows, so there's no yellow sprawl down the table. If you'd rather keep the count at 12, the fallback is `--club-role-owner: oklch(0.80 0.14 88)` (a warm gold one step off brand) — say the word and I'll swap it.

No other rules were bent: pure black stays banned (darkest surface is `#262728`), radii/depth recipes are used verbatim from §2.8/§2.9, Newsreader is prose-only (entry bodies, discussion post bodies, commentary), forum rows flip background without lifting, and tiles lift `-1px` with a brand-tinted ring.

---

## 4. Pill class map (for the mechanical port)

`community.css` defines `.pill` once and exposes every family as a modifier that sets `--pt` (pill token):

| Family | Classes | Token source |
|---|---|---|
| Chapter status | `.idea .outline .first-draft .revised .final` | `--status-*` |
| Submission status | `.pending .approved .rejected` | `--status-warning/success/error` |
| Visibility | `.vis-public .vis-friends .vis-private` | **new** `--list-visibility-*` |
| Spark status | `.spark-open .spark-voting .spark-closed` | **new** `--spark-status-*` |
| Club role | `.role-owner .role-mod .role-member` | `--brand` / **new** `--club-role-*` |
| Hive role | `.role-moderator .role-contributor .role-reader` | `--role-*` |
| Topic | `.topic-general .topic-worldbuilding .topic-feedback .topic-offtopic` | `--layer-*` (reused) |
| Annotation layer | `.layer-grammar .layer-plot .layer-tone .layer-continuity .layer-general` | `--layer-*` |
| Word goal | `.goal-daily .goal-weekly .goal-monthly .goal-custom` | reused status/visibility |
| Open-join / Auto | `.open-join .auto` | `--status-success` / `--status-error` |
