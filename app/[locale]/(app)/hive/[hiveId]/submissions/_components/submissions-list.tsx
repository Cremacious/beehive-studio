'use client'

import Link from 'next/link'
import type { SubmissionRow as SubmissionRowData } from '@/lib/actions/hive-submissions.actions'
import {
  canReviewSubmissions,
  canSubmitChapter,
  type HiveRole,
} from '@/lib/hive/permissions'
import { HiveSubSectionHeader } from '../../_components/hive-sub-section-header'
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
  const canSubmit = canSubmitChapter(viewerRole)

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
    // BETA_READER (or any other persona with no sections) — the explainer
    // above already tells them why this page is empty. Render nothing.
    if (!canSubmit) return null

    // CONTRIBUTOR with nothing yet: explanatory empty state + CTA.
    return (
      <div className="px-6 py-10">
        <div
          className="mx-auto max-w-xl text-center"
          style={{ color: 'var(--canvas-dark-ink)' }}
        >
          <p className="mb-2 text-[15px] font-semibold">
            You haven&apos;t drafted anything yet.
          </p>
          <p
            className="mb-5 text-[13.5px] leading-relaxed"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Start a chapter draft and submit it. Owners and moderators will
            review, and if approved, it lands in the book as a new chapter
            authored by you.
          </p>
          <Link
            href={`/${locale}/hive/${hiveId}/submissions/new`}
            className="inline-block px-4 py-2 text-[13px] font-semibold"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              borderRadius: 'var(--r-pill)',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            + Start a draft
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {showDrafts && (
        <SubmissionsSection
          title="My drafts"
          count={myDrafts.length}
          countLabel={myDrafts.length === 1 ? 'draft' : 'drafts'}
          hideTopBorder={firstShown === 'drafts'}
        >
          <ForumRows rows={myDrafts} hiveId={hiveId} locale={locale} />
        </SubmissionsSection>
      )}
      {showMine && (
        <SubmissionsSection
          title="My submissions"
          count={mySubmissions.length}
          countLabel={mySubmissions.length === 1 ? 'submission' : 'submissions'}
          hideTopBorder={firstShown === 'mine'}
        >
          <ForumRows rows={mySubmissions} hiveId={hiveId} locale={locale} />
        </SubmissionsSection>
      )}
      {showAll && (
        <SubmissionsSection
          title="All in this hive"
          count={allInHive.length}
          countLabel={allInHive.length === 1 ? 'submission' : 'submissions'}
          hideTopBorder={firstShown === 'all'}
        >
          {allInHive.length === 0 ? (
            <div className="px-5 py-6">
              <p
                className="mb-1 text-[14px] font-medium"
                style={{ color: 'var(--canvas-dark-ink)' }}
              >
                Nothing to review yet.
              </p>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                When a contributor submits a chapter, it shows up here for
                approval or rejection.
              </p>
            </div>
          ) : (
            <ForumRows rows={allInHive} hiveId={hiveId} locale={locale} />
          )}
        </SubmissionsSection>
      )}
    </>
  )
}

function SubmissionsSection({
  title,
  count,
  countLabel,
  hideTopBorder,
  children,
}: {
  title: string
  count: number
  countLabel: string
  hideTopBorder: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <HiveSubSectionHeader
        title={title}
        count={count}
        countLabel={countLabel}
        hideTopBorder={hideTopBorder}
      />
      {/* Tier 2 — column sub-header bar (lighter than the section header) */}
      <div
        className="grid grid-cols-[1fr_110px_130px] gap-3 px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider"
        style={{
          background: 'var(--canvas-dark-300)',
          borderBottom: 'var(--br-card)',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        <span>Submission</span>
        <span className="text-center">Status</span>
        <span className="text-right">Submitted</span>
      </div>
      {/* Tier 3 — content rows on the panel's natural body */}
      {children}
    </section>
  )
}

function ForumRows({
  rows,
  hiveId,
  locale,
}: {
  rows: SubmissionRowData[]
  hiveId: string
  locale: string
}) {
  return (
    <ul className="divide-y divide-[var(--canvas-dark-300)]/40">
      {rows.map(r => (
        <li key={r.id}>
          <SubmissionRow row={r} hiveId={hiveId} locale={locale} />
        </li>
      ))}
    </ul>
  )
}
