'use client'

import { useState } from 'react'
import { ScrollText, Info } from 'lucide-react'
import { ClubRulesEmptyCta } from './club-empty-ctas'

const CELL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: '14px 16px',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--brand)',
  fontWeight: 700,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  marginBottom: 8,
}

const SUB_LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
  color: 'var(--canvas-dark-ink-muted)',
  margin: '0 0 6px',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
}

const READ_MORE_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--brand)',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 700,
  padding: 0,
  marginTop: 5,
}

export function ClubInfoSidebar({
  rules,
  description,
  tags,
  clubId,
  isModOrOwner,
}: {
  rules: string | null
  description: string | null
  tags: string[] | null
  clubId: string
  isModOrOwner: boolean
}) {
  const [rulesExpanded, setRulesExpanded] = useState(false)
  const [aboutExpanded, setAboutExpanded] = useState(false)

  const rulesLines = rules
    ? rules.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : []

  return (
    <div style={CELL_STYLE}>
      {/* RULES SECTION */}
      <div style={LABEL_STYLE}>
        <ScrollText aria-hidden="true" style={{ width: 11, height: 11 }} />
        Club Rules
      </div>

      {rulesLines.length === 0 ? (
        <ClubRulesEmptyCta clubId={clubId} isModOrOwner={isModOrOwner} />
      ) : (
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              overflow: 'hidden',
              maxHeight: rulesExpanded ? 'none' : 92,
              maskImage:
                !rulesExpanded && rulesLines.length > 3
                  ? 'linear-gradient(180deg, #000 70%, transparent 100%)'
                  : 'none',
              WebkitMaskImage:
                !rulesExpanded && rulesLines.length > 3
                  ? 'linear-gradient(180deg, #000 70%, transparent 100%)'
                  : 'none',
            }}
          >
            {rulesLines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 7,
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
                  }}
                >
                  {line}
                </p>
              </div>
            ))}
          </div>
          {(rulesLines.length > 3 ||
            rulesLines.some((l) => l.length > 80)) && (
            <button
              type="button"
              onClick={() => setRulesExpanded((v) => !v)}
              style={READ_MORE_STYLE}
            >
              {rulesExpanded ? '← Show less' : 'Read more →'}
            </button>
          )}
        </div>
      )}

      {/* DIVIDER */}
      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.05)',
          margin: '14px 0 12px',
          flexShrink: 0,
        }}
      />

      {/* ABOUT SECTION */}
      <div style={SUB_LABEL_STYLE}>
        <Info aria-hidden="true" style={{ width: 10, height: 10 }} />
        About
      </div>

      <div style={{ flexShrink: 0 }}>
        {description ? (
          <>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--canvas-dark-ink)',
                lineHeight: 1.55,
                overflow: 'hidden',
                display: aboutExpanded ? 'block' : '-webkit-box',
                WebkitLineClamp: aboutExpanded ? 'unset' : 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </p>
            {description.length > 140 && (
              <button
                type="button"
                onClick={() => setAboutExpanded((v) => !v)}
                style={READ_MORE_STYLE}
              >
                {aboutExpanded ? '← Show less' : 'Read more →'}
              </button>
            )}
          </>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontStyle: 'italic',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            No description.
          </p>
        )}
      </div>

      {tags && tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 10,
            flexShrink: 0,
          }}
        >
          {tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              style={{
                padding: '2px 7px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--canvas-dark-350)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--canvas-dark-ink-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
