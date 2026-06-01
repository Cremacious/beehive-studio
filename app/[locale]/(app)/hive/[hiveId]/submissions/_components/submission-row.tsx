'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import type { SubmissionRow as SubmissionRowData, SubmissionDraftStatus } from '@/lib/actions/hive-submissions.actions'

function relTime(d: Date | string): string {
  const date = new Date(d)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function targetOrderLabel(order: number | null): string {
  if (order === null) return 'End'
  if (order === 0) return 'Beginning'
  return `Position ${order}`
}

const STATUS_META: Record<SubmissionDraftStatus, { label: string; tokenVar: string }> = {
  DRAFT:    { label: 'Draft',    tokenVar: '--status-idea' },
  PENDING:  { label: 'Pending',  tokenVar: '--status-warning' },
  APPROVED: { label: 'Approved', tokenVar: '--status-success' },
  REJECTED: { label: 'Rejected', tokenVar: '--status-error' },
}

export function SubmissionRow({
  row,
  hiveId,
  locale,
}: {
  row: SubmissionRowData
  hiveId: string
  locale: string
}) {
  const status = STATUS_META[row.draftStatus]
  const fallbackVar = '--color-brand'
  const styleColor = `var(${status.tokenVar}, var(${fallbackVar}))`

  return (
    <Link
      href={`/${locale}/hive/${hiveId}/submissions/${row.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:bg-muted/40 transition-colors"
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground bg-muted/40 shrink-0"
      >
        <FileText size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate text-foreground">
            {row.title || 'Untitled submission'}
          </span>
          {row.authorUsername && (
            <span className="text-[11px] text-muted-foreground truncate">@{row.authorUsername}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          <span>{row.wordCount.toLocaleString()} words</span>
          <span>·</span>
          <span>{targetOrderLabel(row.targetChapterOrder)}</span>
        </div>
      </div>
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0"
        style={{
          color: styleColor,
          background: `oklch(from ${styleColor} l c h / 0.14)`,
        }}
      >
        {status.label}
      </span>
      <span className="text-[11px] text-muted-foreground shrink-0">
        {relTime(row.updatedAt)}
      </span>
    </Link>
  )
}
