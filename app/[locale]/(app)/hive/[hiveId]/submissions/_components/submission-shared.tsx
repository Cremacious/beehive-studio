'use client'

import Link from 'next/link'
import type { GetSubmissionData, SubmissionDraftStatus } from '@/lib/actions/hive-submissions.actions'

const STATUS_META: Record<SubmissionDraftStatus, { label: string; tokenVar: string }> = {
  DRAFT:    { label: 'Draft',    tokenVar: '--status-idea' },
  PENDING:  { label: 'Pending',  tokenVar: '--status-warning' },
  APPROVED: { label: 'Approved', tokenVar: '--status-success' },
  REJECTED: { label: 'Rejected', tokenVar: '--status-error' },
}

function targetOrderLabel(order: number | null): string {
  if (order === null) return 'End of book'
  if (order === 0) return 'Beginning of book'
  return `Position ${order}`
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function StatusPill({ status }: { status: SubmissionDraftStatus }) {
  const meta = STATUS_META[status]
  const color = `var(${meta.tokenVar}, var(--color-brand))`
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{
        color,
        background: `oklch(from ${color} l c h / 0.14)`,
      }}
    >
      {meta.label}
    </span>
  )
}

export function SubmissionMetaHeader({
  submission,
  submitter,
}: {
  submission: GetSubmissionData['submission']
  submitter: GetSubmissionData['submitter']
}) {
  const initial = (submitter.username?.[0] ?? '?').toUpperCase()

  return (
    <section className="composer-card rounded-lg p-5 flex items-center gap-3">
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold shrink-0"
        style={{ background: 'oklch(from var(--color-brand) l c h / 0.18)', color: 'var(--color-brand)' }}
      >
        {initial}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h1 className="composer-title font-comfortaa font-bold text-lg truncate">
            {submission.title || 'Untitled submission'}
          </h1>
          <StatusPill status={submission.draftStatus} />
        </div>
        <div className="flex items-center gap-2 text-[11px] composer-muted mt-1 flex-wrap">
          {submitter.username && <span>@{submitter.username}</span>}
          <span>·</span>
          <span>Submitted {fmtDate(submission.createdAt)}</span>
          <span>·</span>
          <span>{targetOrderLabel(submission.targetChapterOrder)}</span>
          <span>·</span>
          <span>{submission.wordCount.toLocaleString()} words</span>
        </div>
      </div>
    </section>
  )
}

export function ReadOnlyBodyStyles() {
  return (
    <style>{`
      [data-slot="submission-read-pane"] {
        --composer-canvas:    oklch(0.22 0.005 256);
        --composer-card-bg:   var(--paper-100);
        --composer-card-bord: var(--paper-300);
        --composer-ink:       var(--paper-ink);
        --composer-ink-strong:var(--paper-ink-strong);
        --composer-ink-muted: var(--paper-ink-muted);
      }
      [data-editor-theme="light"] [data-slot="submission-read-pane"] {
        --composer-canvas:    var(--paper-300);
        --composer-card-bg:   var(--paper-50);
        --composer-card-bord: var(--paper-200);
      }
      [data-slot="submission-read-pane"] .composer-card {
        background: var(--composer-card-bg);
        border: 1px solid var(--composer-card-bord);
      }
      [data-slot="submission-read-pane"] .composer-title { color: var(--composer-ink-strong); }
      [data-slot="submission-read-pane"] .composer-muted { color: var(--composer-ink-muted); }
      [data-slot="submission-read-pane"] .ProseMirror {
        color: var(--composer-ink);
        outline: none;
        font-family: var(--font-prose, var(--font-newsreader, serif));
        font-size: 17px;
        line-height: 1.7;
      }
      [data-slot="submission-read-pane"] .ProseMirror p { margin: 0 0 1em; }
      [data-slot="submission-read-pane"] .ProseMirror h1,
      [data-slot="submission-read-pane"] .ProseMirror h2,
      [data-slot="submission-read-pane"] .ProseMirror h3 {
        color: var(--composer-ink-strong);
        font-family: var(--font-display);
        font-weight: 700;
      }
      [data-slot="submission-read-pane"] .ProseMirror strong { color: var(--composer-ink-strong); font-weight: 600; }
      [data-slot="submission-read-pane"] .ProseMirror blockquote {
        color: var(--composer-ink-muted);
        border-left: 3px solid oklch(0.78 0.04 60 / 0.45);
        padding-left: 0.9em; margin: 0.6em 0;
      }
      [data-slot="submission-read-pane"] .ProseMirror ul,
      [data-slot="submission-read-pane"] .ProseMirror ol { padding-left: 1.4em; margin: 0 0 1em; }
      [data-slot="submission-read-pane"] .ProseMirror ul { list-style: disc; }
      [data-slot="submission-read-pane"] .ProseMirror ol { list-style: decimal; }
    `}</style>
  )
}

export function ApprovedChapterLink({
  locale,
  bookId,
  createdChapterId,
}: {
  locale: string
  bookId: string
  createdChapterId: string | null
}) {
  if (!createdChapterId) {
    return (
      <Link
        href={`/${locale}/books/${bookId}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
      >
        View in book →
      </Link>
    )
  }
  return (
    <Link
      href={`/${locale}/books/${bookId}/read/${createdChapterId}`}
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
    >
      Read the chapter →
    </Link>
  )
}
