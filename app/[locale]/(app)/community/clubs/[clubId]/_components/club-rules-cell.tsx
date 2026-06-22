import { ScrollText } from 'lucide-react'
import type { ClubSummary } from '@/lib/actions/book-clubs.actions'
import { ClubRulesEmptyCta } from './club-empty-ctas'

const CELL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: '12px 14px',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--brand)',
  fontWeight: 700,
  marginBottom: 8,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
}

export function ClubRulesCell({
  rules,
  clubId,
  isModOrOwner,
}: {
  rules: string | null
  clubId: string
  isModOrOwner: boolean
}) {
  return (
    <div style={CELL_STYLE}>
      <div style={LABEL_STYLE}>
        <ScrollText aria-hidden="true" style={{ width: 11, height: 11 }} />
        Club Rules
      </div>

      {rules ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Split on newlines to render as numbered list */}
          {rules
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 7,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--brand)',
                    fontWeight: 700,
                    flexShrink: 0,
                    paddingTop: 1,
                    minWidth: 14,
                    textAlign: 'right',
                  }}
                >
                  {i + 1}.
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--canvas-dark-ink)',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {line}
                </p>
              </div>
            ))}
        </div>
      ) : (
        <ClubRulesEmptyCta clubId={clubId} isModOrOwner={isModOrOwner} />
      )}
    </div>
  )
}
