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
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-comfortaa font-bold text-2xl text-foreground">
              Submissions
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Chapter drafts submitted for review.
            </p>
          </div>
          {canSubmit ? (
            <Link
              href={newSubmissionHref}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{
                background: 'var(--color-brand)',
                color: 'var(--brand-ink, oklch(0.18 0.02 60))',
              }}
            >
              <Plus size={14} />
              New Submission
            </Link>
          ) : (
            <span
              title="Only Contributors can draft submissions"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
            >
              <Plus size={14} />
              New Submission
            </span>
          )}
        </header>

        <div className="space-y-6">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  {allInHive.map(r => (
                    <SubmissionRow key={r.id} row={r} hiveId={hiveId} locale={locale} />
                  ))}
                </div>
              )}
            </Section>
          )}
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
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
        <span className="font-comfortaa font-bold text-sm text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-4 rounded-md border border-dashed border-border text-sm text-muted-foreground italic">
      {children}
    </div>
  )
}
