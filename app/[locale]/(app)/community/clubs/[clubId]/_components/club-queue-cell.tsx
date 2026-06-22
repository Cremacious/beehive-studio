import Link from 'next/link'
import { BookMarked, ChevronRight } from 'lucide-react'
import { getClubBooksAction } from '@/lib/actions/book-clubs.actions'
import { ClubQueueEmptyCta } from './club-empty-ctas'

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

export async function ClubQueueCell({
  clubId,
  locale,
  isModOrOwner,
}: {
  clubId: string
  locale: string
  isModOrOwner: boolean
}) {
  const result = await getClubBooksAction({ clubId, status: 'QUEUE' })
  const allQueue = result.success ? result.data.rows : []
  const books = allQueue.slice(0, 4)
  const totalQueue = allQueue.length

  return (
    <div style={CELL_STYLE}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          flexShrink: 0,
          gap: 8,
        }}
      >
        <span style={{ ...LABEL_STYLE, marginBottom: 0 }}>
          <BookMarked aria-hidden="true" style={{ width: 11, height: 11 }} />
          Up Next
          {totalQueue > 0 && (
            <span
              style={{
                marginLeft: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--canvas-dark-ink-muted)',
                fontWeight: 400,
              }}
            >
              · {totalQueue}
            </span>
          )}
        </span>
        <Link
          href={`/${locale}/community/clubs/${clubId}/queue`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            padding: '3px 9px 3px 10px',
            borderRadius: 999,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.10)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            color: 'var(--canvas-dark-ink-muted)',
            textDecoration: 'none',
          }}
        >
          View all
          <ChevronRight aria-hidden="true" style={{ width: 11, height: 11 }} />
        </Link>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {books.length === 0 ? (
          <ClubQueueEmptyCta clubId={clubId} isModOrOwner={isModOrOwner} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 6,
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {books.map((book, i) => (
              <div
                key={book.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '5px 7px',
                  borderRadius: 'var(--r-row)',
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  boxShadow: 'var(--sh-tile)',
                  overflow: 'hidden',
                  minWidth: 0,
                }}
              >
                {/* Queue position */}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--brand)',
                    fontWeight: 700,
                    flexShrink: 0,
                    width: 14,
                    textAlign: 'center',
                  }}
                >
                  {i + 1}
                </span>

                {/* Tiny cover */}
                <div
                  style={{
                    width: 24,
                    height: 34,
                    borderRadius: 2,
                    flexShrink: 0,
                    overflow: 'hidden',
                    background: 'var(--canvas-dark-400)',
                  }}
                >
                  {book.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.coverUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>

                {/* Title + author */}
                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      color: 'var(--canvas-dark-ink-strong)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {book.title}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      color: 'var(--canvas-dark-ink-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {book.author}
                  </p>
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 4 - books.length) }).map((_, i) => (
              <SkeletonTile key={`skel-${i}`} position={books.length + i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SkeletonTile({ position }: { position: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 7px',
        borderRadius: 'var(--r-row)',
        background: 'var(--canvas-dark-100)',
        boxShadow: 'var(--sh-inset)',
        border: '1px dashed rgba(255,255,255,0.08)',
        overflow: 'hidden',
        minWidth: 0,
      }}
      aria-hidden="true"
    >
      {/* Faded position number */}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--canvas-dark-ink-muted)',
          fontWeight: 700,
          flexShrink: 0,
          width: 14,
          textAlign: 'center',
          opacity: 0.4,
        }}
      >
        {position}
      </span>

      {/* Placeholder cover */}
      <div
        style={{
          width: 24,
          height: 34,
          borderRadius: 2,
          flexShrink: 0,
          background:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 4px, rgba(255,255,255,0.05) 4px 8px)',
          border: '1px dashed rgba(255,255,255,0.08)',
        }}
      />

      {/* Faint title + author bars */}
      <div
        style={{
          minWidth: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          style={{
            height: 8,
            width: '75%',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.05)',
          }}
        />
        <div
          style={{
            height: 6,
            width: '50%',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
          }}
        />
      </div>
    </div>
  )
}
