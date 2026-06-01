'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import type { SubmissionRow as SubmissionRowData } from '@/lib/actions/hive-submissions.actions'
import { canSubmitChapter, canReviewSubmissions, type HiveRole } from '@/lib/hive/permissions'
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
  const canSubmit = canSubmitChapter(viewerRole)
  const canReview = canReviewSubmissions(viewerRole)
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(['drafts', 'mine', 'all']),
  )

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const newSubmissionHref = `/${locale}/hive/${hiveId}/submissions/new`

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            border: 'var(--br-card)',
          }}
          className="p-6"
        >
          <header className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h1
                style={{ color: 'var(--brand)' }}
                className="font-comfortaa font-bold text-2xl"
              >
                Submissions
              </h1>
              <p
                className="text-sm mt-0.5"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Chapter drafts submitted for review.
              </p>
            </div>
            {canSubmit ? (
              <Link
                href={newSubmissionHref}
                style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
                className="inline-flex items-center gap-1.5 font-geist font-semibold text-sm px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
              >
                <Plus size={14} />
                New Submission
              </Link>
            ) : (
              <span
                title="Only Contributors can draft submissions"
                style={{ borderRadius: 'var(--r-btn)' }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-geist font-semibold opacity-50 cursor-not-allowed"
              >
                <Plus size={14} />
                New Submission
              </span>
            )}
          </header>

          <div className="space-y-5">
            <Section
              keyId="drafts"
              title="My drafts"
              count={myDrafts.length}
              expanded={expanded.has('drafts')}
              onToggle={() => toggle('drafts')}
            >
              {myDrafts.length === 0 ? (
                <EmptyHint>
                  No drafts yet.{canSubmit && (
                    <> <Link href={newSubmissionHref} className="text-brand hover:underline">Start a new submission</Link>.</>
                  )}
                </EmptyHint>
              ) : (
                <div className="space-y-2">
                  {myDrafts.map(r => (
                    <SubmissionRow key={r.id} row={r} hiveId={hiveId} locale={locale} />
                  ))}
                </div>
              )}
            </Section>

            <Section
              keyId="mine"
              title="My submissions"
              count={mySubmissions.length}
              expanded={expanded.has('mine')}
              onToggle={() => toggle('mine')}
            >
              {mySubmissions.length === 0 ? (
                <EmptyHint>No past submissions.</EmptyHint>
              ) : (
                <div className="space-y-2">
                  {mySubmissions.map(r => (
                    <SubmissionRow key={r.id} row={r} hiveId={hiveId} locale={locale} />
                  ))}
                </div>
              )}
            </Section>

            {canReview && (
              <Section
                keyId="all"
                title="All in this hive"
                count={allInHive.length}
                expanded={expanded.has('all')}
                onToggle={() => toggle('all')}
              >
                {allInHive.length === 0 ? (
                  <EmptyHint>No submissions to review.</EmptyHint>
                ) : (
                  <div className="space-y-2">
                    {allInHive.map(r => (
                      <SubmissionRow key={r.id} row={r} hiveId={hiveId} locale={locale} />
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function Section({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  keyId: string
  title: string
  count: number
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-1 py-2 text-left"
      >
        {expanded ? (
          <ChevronDown size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
        )}
        <span
          className="font-comfortaa font-bold text-sm"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {title}
        </span>
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          ({count})
        </span>
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 'var(--r-row)',
        border: '1px dashed var(--canvas-dark-300)',
        color: 'var(--canvas-dark-ink-muted)',
      }}
      className="px-3 py-4 text-sm italic"
    >
      {children}
    </div>
  )
}
