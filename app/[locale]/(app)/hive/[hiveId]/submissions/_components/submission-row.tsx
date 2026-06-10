'use client'

import Link from 'next/link'
import type { SubmissionRow as SubmissionRowData } from '@/lib/actions/hive-submissions.actions'
import { HivePill } from '../../_components/hive-pill'
import { STATUS_TOKEN } from './submission-shared'

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

const STATUS_LABEL: Record<SubmissionRowData['draftStatus'], string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
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
  return (
    <Link
      href={`/${locale}/hive/${hiveId}/submissions/${row.id}`}
      className="grid grid-cols-[1fr_110px_130px] items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--canvas-dark-300)]"
    >
      <div className="min-w-0">
        <p
          className="font-comfortaa font-semibold text-sm truncate"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {row.title || 'Untitled submission'}
        </p>
        <p
          className="text-[11px] font-mono mt-0.5 truncate"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {row.authorUsername && <>@{row.authorUsername} · </>}
          {row.wordCount.toLocaleString()} words · {targetOrderLabel(row.targetChapterOrder)}
        </p>
      </div>
      <div className="flex justify-center">
        <HivePill token={STATUS_TOKEN[row.draftStatus]}>{STATUS_LABEL[row.draftStatus]}</HivePill>
      </div>
      <p
        className="text-[11px] font-mono tracking-wider text-right"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        {row.draftStatus === 'DRAFT' ? '–' : relTime(row.updatedAt)}
      </p>
    </Link>
  )
}
