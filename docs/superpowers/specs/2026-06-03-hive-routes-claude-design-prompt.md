# Claude Design Handoff Prompt — Hive Routes (2026-06-03)

> **Use:** Paste the prompt block at the bottom into Claude Design (claude.ai/design) to produce HTML/CSS mockups for any of the 18 hive route surfaces. The mockup output is the input for a future Claude Code mechanical import cycle. This file is the deliverable for Phase 2 of the two-phase plan locked in [docs/superpowers/specs/2026-06-03-hive-routes-unified-ui-design.md](./2026-06-03-hive-routes-unified-ui-design.md) Appendix A.

---

```text
PROJECT: Beehive Studio — a writing platform for solo authors and small collaboration groups called "hives." The hive routes are the collaboration surfaces. Members of a hive share access to a book (outlines, wiki, chapters, discussions) and use feed-style surfaces (Buzz, Word Goals) to keep momentum. Roles are OWNER, MODERATOR, CONTRIBUTOR, BETA_READER. Recreate the 18 surfaces below as a single coherent dark-mode app.

AESTHETIC: iOS-inspired stacked depth. Cool-gray chrome (NO pure black), warm-yellow brand accent used sparingly, soft 20px-radius panels with subtle gradient + multi-layer drop shadow, hairline-divided sections with uppercase-mono labels, alpha-tinted categorical pills. NEVER use cream paper (that's reserved for the studio editor only — these are dark walnut surfaces).

═══════════════════════════════════════════════════════════════════════
DESIGN TOKENS (use these CSS custom property names + values verbatim)
═══════════════════════════════════════════════════════════════════════

/* Page backdrop and chrome scale (cool gray, hue 256°) */
--canvas-dark-100: #262728;                  /* page bg, recessed inputs */
--canvas-dark-200: oklch(0.295 0.003 256);   /* panel bg base */
--canvas-dark-250: oklch(0.325 0.003 256);   /* panel bg top of gradient */
--canvas-dark-300: oklch(0.360 0.003 256);   /* tile bg base, row hover */
--canvas-dark-350: oklch(0.400 0.003 256);   /* tile bg top of gradient */
--canvas-dark-ink-muted:  oklch(0.680 0.003 256);  /* secondary text */
--canvas-dark-ink:        oklch(0.880 0.003 256);  /* body text */
--canvas-dark-ink-strong: oklch(0.965 0.003 256);  /* emphasized text */

/* Brand accent */
--brand:     #FFC300;                       /* warm yellow */
--brand-ink: oklch(0.20 0.05 75);           /* dark text on brand bg */

/* Chrome details */
--r-card: 20px;                             /* panel corner radius */
--r-row:  14px;                             /* tile / list-row radius */
--r-pill: 999px;                            /* fully rounded */
--br-card: 0.5px solid oklch(1 0 0 / 0.04); /* hairline top highlight */
--sh-card: 0 1px 0 oklch(1 0 0 / 0.06) inset, 0 8px 24px oklch(0 0 0 / 0.35), 0 2px 4px oklch(0 0 0 / 0.25);
--sh-tile: 0 1px 0 oklch(1 0 0 / 0.08) inset, 0 1px 2px oklch(0 0 0 / 0.3);
--sh-inset: inset 0 1px 2px oklch(0 0 0 / 0.2);

/* Categorical pill tokens */
/* Chapter status (5) */
--status-idea:        oklch(0.74 0.045 245);  /* steel blue */
--status-outline:     oklch(0.74 0.070 295);  /* violet */
--status-first-draft: oklch(0.80 0.140 88);   /* warm gold */
--status-revised:     oklch(0.74 0.080 155);  /* mint */
--status-final:       oklch(0.68 0.130 35);   /* coral */
/* Submission status (4) */
--status-warning: oklch(0.78 0.13 70);    /* warm gold — PENDING */
--status-success: oklch(0.74 0.12 145);   /* mint — APPROVED */
--status-error:   oklch(0.66 0.18 25);    /* coral — REJECTED */
/* Hive role (4) */
--role-owner:       oklch(0.78 0.13 70);   /* warm gold */
--role-moderator:   oklch(0.72 0.11 250);  /* slate blue */
--role-contributor: oklch(0.74 0.12 145);  /* mint */
--role-reader:      oklch(0.66 0.04 240);  /* cool gray */
/* Word goal type (4) */
--goal-daily:   oklch(0.78 0.13 70);   /* warm gold */
--goal-weekly:  oklch(0.74 0.12 145);  /* mint */
--goal-monthly: oklch(0.72 0.11 280);  /* lilac */
--goal-custom:  oklch(0.66 0.04 240);  /* cool gray */

/* Wiki category accents (14) — used as left-stripe / icon-chip / pill accent */
--wiki-character: oklch(0.58 0.15 75);   --wiki-location:    oklch(0.55 0.14 160);
--wiki-lore:      oklch(0.55 0.16 290);  --wiki-plot:        oklch(0.55 0.18 25);
--wiki-artifact:  oklch(0.58 0.13 60);   --wiki-faction:     oklch(0.55 0.15 245);
--wiki-culture:   oklch(0.55 0.14 135);  --wiki-language:    oklch(0.55 0.12 200);
--wiki-biology:   oklch(0.58 0.15 105);  --wiki-theme:       oklch(0.55 0.16 320);
--wiki-economy:   oklch(0.58 0.13 50);   --wiki-terminology: oklch(0.55 0.06 270);
--wiki-timeline:  oklch(0.58 0.12 180);  --wiki-other:       oklch(0.55 0.04 270);

/* Fonts */
font-display (headings):  Comfortaa, system-ui, sans-serif  (bold, brand color)
font-ui     (body):       Geist, ui-sans-serif, system-ui
font-prose  (TipTap):     Newsreader, 'Source Serif 4', Georgia, serif
font-mono   (labels):     'JetBrains Mono', ui-monospace, monospace

═══════════════════════════════════════════════════════════════════════
UNIVERSAL PAGE SHELL
═══════════════════════════════════════════════════════════════════════

Every page renders this exact outer structure on the page backdrop `#262728`:

<div class="mx-auto w-full {max-w-3xl | max-w-5xl} p-6">

  {/* OPTIONAL back link — only when the page has a parent */}
  <a class="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider"
     style="color: var(--canvas-dark-ink-muted)">
    <svg class="h-3 w-3"><!-- lucide ArrowLeft --></svg>
    Back to {parent}
  </a>

  {/* PANEL — every page has exactly one */}
  <section
    class="rounded-[20px] overflow-hidden"
    style="background: linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200));
           border-top: var(--br-card);
           box-shadow: var(--sh-card);">

    {/* HEADER */}
    <header class="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
      <div class="min-w-0 flex-1">
        <h1 class="font-comfortaa font-bold text-[28px] leading-tight"
            style="color: var(--brand)">
          {Page Title}
        </h1>
        <p class="mt-1 text-[13px]" style="color: var(--canvas-dark-ink-muted)">
          {Subtitle in plain Geist — NEVER mono}
        </p>
      </div>

      {/* HEADER SLOT — holds ONE of these three shapes (or nothing): */}
      {/*   a) primary CTA: solid brand pill button */}
      {/*   b) 2-button group: flex gap-2 of brand pill + tile-gradient button */}
      {/*   c) status/role pill: alpha-tint pill (no action) */}
      <div class="shrink-0">
        <button style="background: var(--brand); color: var(--brand-ink);
                       border-radius: var(--r-pill); box-shadow: var(--sh-tile);"
                class="px-4 py-2 text-[13px] font-semibold">
          + New {Thing}
        </button>
      </div>
    </header>

    {/* BODY — sections divided by hairlines */}
    {sections}
  </section>
</div>

═══════════════════════════════════════════════════════════════════════
SECTION DIVIDER (no sub-panels — every section uses this)
═══════════════════════════════════════════════════════════════════════

<section class="px-6 py-5"
         style="border-top: 1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)">
  <p class="mb-3 font-mono text-[10px] uppercase tracking-wider"
     style="color: var(--canvas-dark-ink-muted)">
    {SECTION LABEL}
  </p>
  {section content}
</section>

For the FIRST section in a panel, omit the border-top (it's already against the header).
For the Settings "Danger zone" section, swap the label color to oklch(0.66 0.18 25) (matches --status-error).

NEVER nest panel chrome inside a panel. NEVER use a sub-panel with its own gradient + radius + shadow. Sections are flat, hairline-divided.

═══════════════════════════════════════════════════════════════════════
PILL CONVENTION (universal — all categorical tags use this shape)
═══════════════════════════════════════════════════════════════════════

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
      style="background: oklch(from var(--TOKEN) l c h / 0.14);
             color: var(--TOKEN);
             border: 1px solid oklch(from var(--TOKEN) l c h / 0.3);">
  {Label}
</span>

Token mapping:
  Chapter status pill   → --status-{idea|outline|first-draft|revised|final}
  Submission status pill → --status-{idea (DRAFT) | warning (PENDING) | success (APPROVED) | error (REJECTED)}
  Hive role pill        → --role-{owner|moderator|contributor|reader}
  Goal-type pill        → --goal-{daily|weekly|monthly|custom}
  Discussion topic pill → --wiki-{...} (reuses wiki category tokens; existing TOPIC_META map in codebase)
  Annotation layer pill → existing LAYER_META oklch values (5 layers)

═══════════════════════════════════════════════════════════════════════
LIST CHROME — two shapes, both inside the panel body
═══════════════════════════════════════════════════════════════════════

FORUM-TABLE shape (when rows have parallel meta columns):
  1) Column-header strip (mono uppercase labels in 10px tracking-wider muted):
     <div style="background: var(--canvas-dark-100); border-top: var(--br-card); border-bottom: var(--br-card)"
          class="grid grid-cols-[{template}] gap-3 px-6 py-2.5 font-mono text-[10px] uppercase tracking-wider"
          {...}>
       <span>{Col1}</span><span>{Col2}</span><span class="text-right">{Col3}</span>
     </div>
  2) <ul class="divide-y divide-[var(--canvas-dark-300)]/40">
       <li class="grid grid-cols-[{template}] items-center gap-3 px-6 py-3 hover:bg-[var(--canvas-dark-300)] transition-colors">
         ...
       </li>
     </ul>
  NEVER add per-row tile chrome. Rows are flat. Hover is ONLY the bg change — no translate, no shadow swap, no scale.

CARD-STACK shape (when rows are self-contained posts/cards with no parallel meta):
  <div class="px-6 pb-6 flex flex-col gap-3">
    <article
      class="p-4"
      style="background: linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300));
             border-radius: var(--r-row);
             box-shadow: var(--sh-tile);">
      ...
    </article>
  </div>

═══════════════════════════════════════════════════════════════════════
18-PAGE SPECIFICATION (Tier · Back · Title · Subtitle · HeaderSlot · Body)
═══════════════════════════════════════════════════════════════════════

Each row below specifies the page's HivePageShell config + body layout.

 1. DASHBOARD                  ─ 3xl · no back · "Welcome to {Hive Name}" · {description} · — ·
       Sections: Overview (member count + last active) · Linked Book (cover + title + Read CTA + Open in Studio CTA if author) · Standalone (only when no linked book)

 2. OUTLINE INDEX              ─ 5xl · no back · "Outlines" · "{N} outlines in this hive" · — ·
       Sections: Filter (search input + sort dropdown) · Outlines (forum-table: Outline | Beats | Last edit; grid 1fr 90px 130px; each row shows title + up to 6 deduplicated --beat-* color dots in first-appearance order, beat count, relTime)

 3. OUTLINE DETAIL             ─ 5xl · back="outlines" · "{Outline Title}" · "Last edited by @{username} · {relTime}" · — ·
       Body is the beat sheet: vertical sortable list of acts. Each act has a labeled header strip (act name) + per-act "+ Add a beat" button + sortable beat rows. Each beat row: drag handle (left) + color dot (--beat-{color}) + title + optional label badge + linked-chapter chip (right). "+ New Act" dashed-border button at bottom.

 4. WIKI SHELL                 ─ 5xl · no back · "Wiki" · "{N} entries across {M} folders" · + New Entry brand pill ·
       Sections: View (3-tab switch: By Category / By Folder / Notes) · Search (search input, omit when zero entries) · Active view body (grid of entry cards or recursive folder tree or flat notes grid)

 5. WIKI ENTRY EDITOR          ─ 5xl · back="wiki" · "{Entry Title}" · "{Category Label}" · — ·
       Sections: Meta (category breadcrumb + tag chips via wiki category --wiki-{...} pill) · Body (TipTap rich text canvas, dark walnut bg, color var(--canvas-dark-ink)) · Footer line: "Last edited by @{username} · {relTime}"

 6. CHAPTERS INDEX             ─ 3xl · no back · "Chapters" · "{N} chapters · {Book Title}" · — ·
       Forum-table: # | Chapter | Activity (grid 40px 1fr 180px). Each row: chapter number (tabular-nums muted) + title (clickable Link) + activity badges (annotation count + suggestion count; brand-yellow accent on suggestion badge when viewer canReview). When both counts are 0, render an invisible "—" placeholder so row heights stay uniform.

 7. CHAPTER VIEW               ─ 5xl · back="chapters" · "{Chapter Title}" · "Chapter from {Book Title} by @{author}" (or "Written by @{contributor} — chapter contribution to {Book} by @{owner}" when chapter has a distinct contributor) · role pill (alpha-tint --role-* with viewer's role) ·
       Sections: Metadata (status pill via --status-* + line-clamp-3 italic synopsis + collapsible <details> Scene Planner with goal/conflict/outcome stanzas; omit entire section when all 3 are empty) · Body (read-only TipTap prose at editor font scale, dark walnut bg)

 8. DISCUSSIONS LIST           ─ 5xl · no back · "Discussions" · "Talk shop with your hive." · + New Discussion brand pill ·
       Sections: Filter (multi-select topic pill chips) · Threads (forum-table: Thread | Replies | Last activity; grid 1fr 90px 130px). Thread column: topic pill (--wiki-* via TOPIC_META) + derived title (body.split('\n')[0].slice(0,80) in Comfortaa semibold) + body excerpt (line-clamp-1 muted). Replies column: count number above small "replies" label, centered. Last activity: relTime mono muted right-aligned.

 9. DISCUSSION THREAD          ─ 5xl · back="discussions" · {Derived Title from body.split('\n')[0].slice(0,80)} · "Started by @{username}" · — ·
       Sections: Original post (avatar + identity + relTime + topic pill + body; (edited) indicator if updatedAt > createdAt) · "{N} replies" (flat reply list — each reply: avatar + @username + relTime + body + kebab when viewer canEdit) · Reply (composer textarea + Post Reply brand pill; clicking Reply on a reply prepends "@{username} " to the input)

10. SUBMISSIONS LIST           ─ 3xl · no back · "Submissions" · "Chapter drafts submitted for review." · + New Submission brand pill (gated on canSubmitChapter) ·
       Sections: My drafts (forum-table: Submission | Status | Submitted; grid 1fr 110px 130px) · My submissions (same shape) · All in this hive (same shape; gated on canReviewSubmissions). Status pill uses --status-{idea (DRAFT)|warning (PENDING)|success (APPROVED)|error (REJECTED)}.

11. SUBMISSION COMPOSER       ─ 3xl · back="submissions" · "New submission" (or existing title) · "Auto-saves as you type." · — ·
       Body: SaveStatusBadge inline at top + title input (large) + target-order select + TipTap composer (StarterKit, no marks beyond bold/italic/lists). Submit brand pill button at body bottom.

12. SUBMISSION REVIEW         ─ 3xl · back="submissions" · "{Submission Title}" · "Pending review from @{submitter}" · 2-button group: Approve brand pill + Reject tile-gradient with --status-error tint ·
       Sections: Submission (avatar + meta line + status pill) · Body (read-only prose)

13. SUBMISSION READ           ─ 3xl · back="submissions" · "{Submission Title}" · "Submitted by @{submitter}" · status pill (--status-* per draftStatus) ·
       Sections: Submission (meta) · Body (read-only prose) · Review note (only when REJECTED with non-null reviewNote) · Approved chapter (only when APPROVED with createdChapterId; links to public reader)

14. SUGGESTIONS               ─ 3xl · no back · "Edit Suggestions" · "{N} pending across {M} chapters" (or "No pending suggestions.") · — ·
       Body: per-chapter hairline sections labeled "CHAPTER {N}: {TITLE}". Each section's body is a card-stack of tile-gradient suggestion cards. Each card: avatar + @author + relTime header; inline diff (original strikethrough + arrow + suggestedText); "Has replies" badge if applicable; action row with brand pill Accept + tile-gradient destructive-tinted Reject (opens custom dialog with reviewNote textarea) + brand-yellow Open link (deep-links into chapter).

15. WORD GOALS                ─ 3xl · no back · "Word Goals" · "Set a shared writing target with your hive." · + New Goal brand pill (gated on canSetWordGoal) ·
       Sections: Active goals (card-stack of goal cards with --goal-* type pill + progress bar with brand-yellow fill on inset track + words/target + remaining time + kebab Edit/Archive) · Contributors (per-member word-delta breakdown within primary goal's window) · Recent activity (last 20 logs with Load older trigger) · History (archived goals list, rendered INLINE — NEVER as a collapsible accordion)

16. BUZZ                      ─ 3xl · no back · "Buzz Board" · "Inspiration, links, and vibes from your hive." · + New Buzz brand pill (gated on canPostBuzz) ·
       Body: card-stack of buzz post cards. Each card: avatar (32px) + @username + · separator + relTime mono muted + (edited) indicator if applicable + kebab pushed right via ml-auto when canEdit. Below header: derived title (body.split('\n')[0].slice(0,80) in Comfortaa bold 16px brand-yellow). Below title: line-clamp-2 excerpt (remainder of body after first line; omit when body is single-line). Below excerpt: LinkCard if type=LINK. Footer row: like button (heart + count) using --status-success when liked else muted.

17. MEMBERS                   ─ 3xl · no back · "Members" · "{N} members" · — ·
       Sections: Invite link (generate/copy/regenerate with members count line "{N} / {LIMIT} members"; only for owner/editor) · Invite by username (username form; only for owner/editor) · Members (forum-table: Member | Role | Actions; grid 1fr 140px 60px). Member column: avatar + name + joined relTime. Role column: role pill (--role-*) OR role <select> dropdown (when viewer is owner + target is not self + target is not OWNER). Actions: remove button (X icon).

18. SETTINGS                  ─ 3xl · back="dashboard" · "Settings" · "Manage your hive." · — ·
       Sections: Basics (name input + description textarea) · Visibility (3-card visibility picker: Private / Friends / Public) · Discoverability (checkbox + helper text; disabled when visibility ≠ Public) · Danger zone (destructive-tinted label + delete button). Save button at body bottom as brand pill.

═══════════════════════════════════════════════════════════════════════
HARD CONSTRAINTS
═══════════════════════════════════════════════════════════════════════

- NO new features. Every affordance listed above must appear; nothing else.
- NO pure black (#000) anywhere. Darkest legitimate surface is --canvas-dark-100 (#262728).
- Brand yellow (--brand) is RESTRAINED. Use only for: chrome headings (h1/h2/h3 inside panels), primary CTAs, active states, premium badge, progress fills, save indicator, derived-title text on Buzz posts (sanctioned: Buzz titles are the post's primary identity), unsaved-changes dot. NEVER for hover states, neutral chrome borders, decorative accents.
- Cream paper (light tan) appears ONLY in the studio chapter editor — NOT on any hive route. Every prose surface on hive routes uses dark walnut chrome with var(--canvas-dark-ink) text color.
- Dark mode only. No light-mode variant.
- Desktop layout only. No mobile/tablet responsive.
- Forum-table rows are flat. NEVER add per-row tile chrome to forum-table rows. Hover state is ONLY bg-change; no translate, no scale, no shadow swap.
- Card-stack cards ARE tile-gradient. Use the same chrome formula every time.
- NEVER nest panel chrome. One panel per page. Sub-sections are hairline-divided.
- Primary CTAs are solid brand pills (--brand bg + --brand-ink text + --r-pill + --sh-tile). Secondary actions (e.g. Reject) are tile-gradient with destructive tint. Tertiary actions are text-only brand-color links.
- All categorical tags wear the unified pill convention (alpha-tint bg + accent ink + 0.3-alpha border + 999px radius + uppercase 11px tracking-wider).

═══════════════════════════════════════════════════════════════════════
DELIVERABLE
═══════════════════════════════════════════════════════════════════════

Produce HTML + CSS mockups for ALL 18 pages above. Each page is a separate file or section with the universal page shell + the page-specific body. Use the locked tokens, the universal shell DOM, the forum-table OR card-stack rules, and the pill convention. Populate with realistic-looking placeholder content (lorem-ipsum is fine but make it feel like a writing community: book titles, chapter titles, member usernames @someone, plausible synopses).

The deliverable is a visual reference for mechanical Claude Code import — match the structure exactly so the import can map mockup DOM → existing React components without rework.
```

---

## How to use this prompt

1. Open https://claude.ai/design.
2. Paste the prompt block above (everything between the triple backticks).
3. Claude Design will generate HTML/CSS mockups for the 18 surfaces.
4. Review the output, request iterations if needed.
5. When satisfied, hand off the resulting HTML to Claude Code for mechanical import: the existing React components (`<HivePageShell>`, `<HivePill>`, `<HiveSectionDivider>`) already match this structure, so the import is a CSS-token consumption + per-page apply pass.

## Source

Page-by-page anatomy derived verbatim from [docs/superpowers/specs/2026-06-03-hive-routes-unified-ui-design.md](./2026-06-03-hive-routes-unified-ui-design.md) §1, §2, §3, §4, §5, §6, §7. Token values copied from `app/globals.css` `:root`.
