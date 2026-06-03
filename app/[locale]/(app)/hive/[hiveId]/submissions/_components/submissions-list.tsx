'use client'

import type { SubmissionRow as SubmissionRowData } from '@/lib/actions/hive-submissions.actions'
import { canReviewSubmissions, type HiveRole } from '@/lib/hive/permissions'
import { HiveSectionDivider } from '../../_components/hive-section-divider'
import { SubmissionRow } from './submission-row'

type Props = {
  hiveId: string
  locale: string
  viewerRole: HiveRole
  myDrafts: SubmissionRowData[]
  mySubmissions: SubmissionRowData[]
  allInHive: SubmissionRowData[]
}

export function SubmissionsList({
  hiveId,
  locale,
  viewerRole,
  myDrafts,
  mySubmissions,
  allInHive,
}: Props) {
  const canReview = canReviewSubmissions(viewerRole)

  // Determine which sections render so we can correctly suppress the top
  // border on the first one.
  const showDrafts = myDrafts.length > 0
  const showMine = mySubmissions.length > 0
  const showAll = canReview

  let firstShown: 'drafts' | 'mine' | 'all' | null = null
  if (showDrafts) firstShown = 'drafts'
  else if (showMine) firstShown = 'mine'
  else if (showAll) firstShown = 'all'

  const noContent = !showDrafts && !showMine && !showAll

  if (noContent) {
    return (
      <HiveSectionDivider label="Submissions" hideTopBorder>
        <p
          className="text-sm italic"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          No submissions yet.
        </p>
      </HiveSectionDivider>
    )
  }

  return (
    <>
      {showDrafts && (
        <HiveSectionDivider label="My drafts" hideTopBorder={firstShown === 'drafts'}>
          <ForumTable rows={myDrafts} hiveId={hiveId} locale={locale} />
        </HiveSectionDivider>
      )}
      {showMine && (
        <HiveSectionDivider label="My submissions" hideTopBorder={firstShown === 'mine'}>
          <ForumTable rows={mySubmissions} hiveId={hiveId} locale={locale} />
        </HiveSectionDivider>
      )}
      {showAll && (
        <HiveSectionDivider label="All in this hive" hideTopBorder={firstShown === 'all'}>
          {allInHive.length === 0 ? (
            <p
              className="text-sm italic"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              No submissions to review.
            </p>
          ) : (
            <ForumTable rows={allInHive} hiveId={hiveId} locale={locale} />
          )}
        </HiveSectionDivider>
      )}
    </>
  )
}

function ForumTable({
  rows,
  hiveId,
  locale,
}: {
  rows: SubmissionRowData[]
  hiveId: string
  locale: string
}) {
  return (
    <div
      className="overflow-hidden rounded-[var(--r-row)]"
      style={{ border: 'var(--br-card)' }}
    >
      <div
        className="grid grid-cols-[1fr_110px_130px] gap-3 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider"
        style={{
          background: 'var(--canvas-dark-100)',
          borderTop: 'var(--br-card)',
          borderBottom: 'var(--br-card)',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        <span>Submission</span>
        <span>Status</span>
        <span className="text-right">Submitted</span>
      </div>
      <ul className="divide-y divide-[var(--canvas-dark-300)]/40">
        {rows.map(r => (
          <li key={r.id}>
            <SubmissionRow row={r} hiveId={hiveId} locale={locale} />
          </li>
        ))}
      </ul>
    </div>
  )
}
