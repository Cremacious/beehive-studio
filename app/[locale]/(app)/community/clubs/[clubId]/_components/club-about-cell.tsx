import { Info } from 'lucide-react'

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

export function ClubAboutCell({
  description,
  tags,
}: {
  description: string | null
  tags: string[] | null
}) {
  return (
    <div style={CELL_STYLE}>
      <div style={LABEL_STYLE}>
        <Info aria-hidden="true" style={{ width: 11, height: 11 }} />
        About
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {description ? (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--canvas-dark-ink)',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {description}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic', color: 'var(--canvas-dark-ink-muted)' }}>
            No description.
          </p>
        )}

        {tags && tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, overflow: 'hidden' }}>
            {tags.slice(0, 5).map((tag) => (
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
    </div>
  )
}
