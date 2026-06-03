'use client'

import type { ChapterStatus } from '@/lib/books/is-chapter-reader-visible'

const STATUS_DISPLAY: Record<ChapterStatus, string> = {
  IDEA: 'Idea',
  OUTLINE: 'Outline',
  FIRST_DRAFT: 'First Draft',
  REVISED: 'Revised',
  FINAL: 'Final',
}

type Props = {
  status: ChapterStatus
  synopsis: string | null
  scenePlanner: {
    goal: string | null
    conflict: string | null
    outcome: string | null
  }
}

export function ChapterMetadataHeader({ status, synopsis, scenePlanner }: Props) {
  const hasAnyScene =
    scenePlanner.goal !== null ||
    scenePlanner.conflict !== null ||
    scenePlanner.outcome !== null

  return (
    <div className="mb-6 pb-4 border-b" style={{ borderColor: 'var(--canvas-dark-300)' }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 10px',
            borderRadius: 'var(--r-pill)',
            background: `oklch(from var(--status-${statusToken(status)}) l c h / 0.18)`,
            color: `var(--status-${statusToken(status)})`,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'ui-monospace, "SF Mono", monospace',
          }}
        >
          {STATUS_DISPLAY[status] ?? status}
        </span>
      </div>

      {synopsis !== null && synopsis !== '' && (
        <p
          className="text-sm italic line-clamp-3 mb-3"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {synopsis}
        </p>
      )}

      {hasAnyScene && (
        <details className="text-sm">
          <summary
            className="cursor-pointer font-mono uppercase tracking-wider text-[10px] font-semibold"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Scene planner
          </summary>
          <div className="mt-2 space-y-3 pl-1">
            {scenePlanner.goal !== null && (
              <SceneStanza label="Goal" body={scenePlanner.goal} />
            )}
            {scenePlanner.conflict !== null && (
              <SceneStanza label="Conflict" body={scenePlanner.conflict} />
            )}
            {scenePlanner.outcome !== null && (
              <SceneStanza label="Outcome" body={scenePlanner.outcome} />
            )}
          </div>
        </details>
      )}
    </div>
  )
}

function SceneStanza({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div
        className="font-mono uppercase tracking-wider text-[9px] font-semibold mb-1"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        {label}
      </div>
      <p
        className="text-sm whitespace-pre-wrap"
        style={{ color: 'var(--canvas-dark-ink)' }}
      >
        {body}
      </p>
    </div>
  )
}

function statusToken(s: ChapterStatus): string {
  switch (s) {
    case 'IDEA': return 'idea'
    case 'OUTLINE': return 'outline'
    case 'FIRST_DRAFT': return 'first-draft'
    case 'REVISED': return 'revised'
    case 'FINAL': return 'final'
  }
}
