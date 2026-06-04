'use client'

import Link from 'next/link'
import type { GetSubmissionData, SubmissionDraftStatus } from '@/lib/actions/hive-submissions.actions'
import { HivePill } from '../../_components/hive-pill'

const STATUS_LABEL: Record<SubmissionDraftStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const STATUS_TOKEN: Record<SubmissionDraftStatus, string> = {
  DRAFT: '--status-idea',
  PENDING: '--status-warning',
  APPROVED: '--status-success',
  REJECTED: '--status-error',
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
  return <HivePill token={STATUS_TOKEN[status]}>{STATUS_LABEL[status]}</HivePill>
}

/**
 * Submitter meta block — avatar + identity + word-count badge.
 * Renders FLAT (no panel chrome) because callers mount it inside <HiveSectionDivider>.
 * Mirrors the `.review-meta` shape from the Claude Design mockup.
 */
export function SubmissionMetaHeader({
  submission,
  submitter,
}: {
  submission: GetSubmissionData['submission']
  submitter: GetSubmissionData['submitter']
}) {
  const initial = (submitter.username?.[0] ?? '?').toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[13px] font-semibold shrink-0"
        style={{
          background: 'oklch(from var(--color-brand) l c h / 0.18)',
          color: 'var(--color-brand)',
        }}
      >
        {initial}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="font-comfortaa font-medium text-[14px] truncate"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {submitter.username ? `@${submitter.username}` : 'Unknown submitter'}
        </div>
        <div
          className="flex items-center gap-2 text-[11px] font-mono mt-0.5 flex-wrap"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <span>Submitted {fmtDate(submission.createdAt)}</span>
          <span>·</span>
          <span>{targetOrderLabel(submission.targetChapterOrder)}</span>
        </div>
      </div>
      <span
        aria-hidden
        className="inline-flex items-center font-mono text-[11px] px-2.5 py-1 shrink-0"
        style={{
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          borderRadius: 'var(--r-pill)',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        {submission.wordCount.toLocaleString()} words
      </span>
    </div>
  )
}

/**
 * Scoped ProseMirror typography for the read-only submission body.
 * Mounted in both review + read panes (they share `data-slot="submission-read-pane"`).
 * Sits on the dark walnut tile, not on cream paper — uses canvas-dark-ink tokens.
 */
export function ReadOnlyBodyStyles() {
  return (
    <style>{`
      [data-slot="submission-read-pane"] .ProseMirror {
        color: var(--canvas-dark-ink);
        outline: none;
        font-family: var(--font-prose, var(--font-newsreader, serif));
        font-size: 17px;
        line-height: 1.7;
      }
      [data-slot="submission-read-pane"] .ProseMirror p { margin: 0 0 1em; }
      [data-slot="submission-read-pane"] .ProseMirror h1,
      [data-slot="submission-read-pane"] .ProseMirror h2,
      [data-slot="submission-read-pane"] .ProseMirror h3 {
        color: var(--canvas-dark-ink-strong);
        font-family: var(--font-display);
        font-weight: 700;
      }
      [data-slot="submission-read-pane"] .ProseMirror strong { color: var(--canvas-dark-ink-strong); font-weight: 600; }
      [data-slot="submission-read-pane"] .ProseMirror blockquote {
        color: var(--canvas-dark-ink-muted);
        border-left: 3px solid oklch(from var(--brand) l c h / 0.55);
        padding-left: 0.9em; margin: 0.6em 0;
      }
      [data-slot="submission-read-pane"] .ProseMirror ul,
      [data-slot="submission-read-pane"] .ProseMirror ol { padding-left: 1.4em; margin: 0 0 1em; }
      [data-slot="submission-read-pane"] .ProseMirror ul { list-style: disc; }
      [data-slot="submission-read-pane"] .ProseMirror ol { list-style: decimal; }
      [data-slot="submission-read-pane"] .ProseMirror li { margin: 0.3em 0; }
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
        className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
        style={{ color: 'var(--brand)' }}
      >
        View in book →
      </Link>
    )
  }
  return (
    <Link
      href={`/${locale}/books/${bookId}/read/${createdChapterId}`}
      className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
      style={{ color: 'var(--brand)' }}
    >
      Read the chapter →
    </Link>
  )
}
