// Read-only web display for front/back matter items. Mirrors the structured
// fields shape that the studio editor writes (lib/front-back-matter/types.ts)
// but renders for the reader surface (no 3-inch print padding, responsive).
// Custom subtype + legacy items fall back to TipTap rendering — handled by
// the caller, not here.

import type {
  TitlePageFields,
  CopyrightFields,
  DedicationFields,
  AcknowledgmentsFields,
  AboutAuthorFields,
} from '@/lib/front-back-matter/types'

function tipTapToPlainText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const lines: string[] = []
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; content?: unknown[] }
    if (typeof n.text === 'string') {
      if (lines.length === 0) lines.push('')
      lines[lines.length - 1] += n.text
      return
    }
    const blockTypes = new Set([
      'paragraph',
      'heading',
      'blockquote',
      'listItem',
      'codeBlock',
    ])
    if (n.type && blockTypes.has(n.type)) lines.push('')
    if (Array.isArray(n.content)) for (const c of n.content) walk(c)
  }
  walk(value)
  return lines.map(l => l.trim()).filter(Boolean).join('\n\n')
}

function paragraphs(text: string) {
  return text.split(/\n\n+/).filter(p => p.trim().length > 0)
}

const sharedSection: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '64px 24px',
  textAlign: 'center',
  color: 'var(--prose-ink-strong)',
}

export function TitlePageDisplay({ f }: { f: Partial<TitlePageFields> }) {
  return (
    <div style={sharedSection}>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--brand)',
          margin: '0 0 14px',
        }}
      >
        {f.bookTitle ?? 'Untitled'}
      </h1>
      {f.subtitle && (
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontStyle: 'italic',
            color: 'var(--prose-ink-muted)',
            margin: '0 0 64px',
          }}
        >
          {f.subtitle}
        </p>
      )}
      <p
        style={{
          fontSize: 16,
          color: 'var(--prose-ink)',
          margin: '64px 0 0',
        }}
      >
        {f.authorName ?? ''}
      </p>
      {f.publisherName && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--prose-ink-muted)',
            margin: '96px 0 0',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {f.publisherName}
        </p>
      )}
    </div>
  )
}

export function CopyrightDisplay({ f }: { f: Partial<CopyrightFields> }) {
  return (
    <div style={{ ...sharedSection, textAlign: 'left', fontSize: 13, lineHeight: 1.6 }}>
      <p style={{ margin: '0 0 8px' }}>
        © {f.copyrightYear ?? new Date().getFullYear()} {f.copyrightHolder ?? ''}
      </p>
      {f.publisherName && <p style={{ margin: '0 0 8px' }}>Published by {f.publisherName}</p>}
      {f.isbn && <p style={{ margin: '0 0 8px' }}>ISBN: {f.isbn}</p>}
      {f.extraNotice ? (
        paragraphs(f.extraNotice).map((p, i) => (
          <p key={i} style={{ margin: '12px 0 0' }}>
            {p}
          </p>
        ))
      ) : (
        <p style={{ margin: '12px 0 0' }}>All rights reserved.</p>
      )}
    </div>
  )
}

export function DedicationDisplay({ f }: { f: Partial<DedicationFields> }) {
  const ps = paragraphs(f.text ?? '')
  return (
    <div style={sharedSection}>
      {ps.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: 'var(--prose-ink-muted)' }}>—</p>
      ) : (
        ps.map((p, i) => (
          <p
            key={i}
            style={{
              fontSize: 17,
              fontStyle: 'italic',
              fontFamily: 'var(--font-prose)',
              color: 'var(--prose-ink-strong)',
              margin: '12px 0',
              lineHeight: 1.5,
            }}
          >
            {p}
          </p>
        ))
      )}
    </div>
  )
}

export function AcknowledgmentsDisplay({ f }: { f: Partial<AcknowledgmentsFields> }) {
  const text = tipTapToPlainText(f.text)
  const ps = paragraphs(text)
  return (
    <div style={{ ...sharedSection, textAlign: 'left' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--prose-ink-strong)',
          margin: '0 0 8px',
        }}
      >
        Acknowledgments
      </h2>
      <div
        aria-hidden
        style={{
          width: 24,
          height: 1,
          background: 'var(--prose-ink-muted)',
          opacity: 0.35,
          margin: '0 0 20px',
        }}
      />
      {ps.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: 'var(--prose-ink-muted)' }}>
          The author hasn&apos;t written acknowledgments yet.
        </p>
      ) : (
        ps.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: 'var(--font-prose)',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--prose-ink)',
              margin: '0 0 12px',
            }}
          >
            {p}
          </p>
        ))
      )}
    </div>
  )
}

export function AboutAuthorDisplay({ f }: { f: Partial<AboutAuthorFields> }) {
  const text = tipTapToPlainText(f.bio)
  const ps = paragraphs(text)
  return (
    <div style={{ ...sharedSection, textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--prose-ink-muted)',
          margin: '0 0 16px',
        }}
      >
        About the Author
      </div>
      {f.photoUrl && (
        <img
          src={f.photoUrl}
          alt="Author photo"
          style={{
            display: 'block',
            width: 96,
            height: 96,
            borderRadius: '50%',
            objectFit: 'cover',
            margin: '0 auto 16px',
          }}
        />
      )}
      {ps.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: 'var(--prose-ink-muted)' }}>
          The author hasn&apos;t written a bio yet.
        </p>
      ) : (
        ps.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: 'var(--font-prose)',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--prose-ink)',
              margin: '0 auto 12px',
              maxWidth: '52ch',
            }}
          >
            {p}
          </p>
        ))
      )}
      {f.links && f.links.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: '24px 0 0',
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            letterSpacing: '0.04em',
            color: 'var(--prose-ink-muted)',
          }}
        >
          {f.links.map((l, i) => (
            <li key={i}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--brand)' }}
              >
                {l.label || l.url}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Display label for a subtype (used as the chapter-reader "subtitle" instead
// of "Chapter N of M" when reading an FBM item).
export function fbmSubtypeLabel(
  subtype: string | null,
  type: 'front_matter' | 'back_matter',
): string {
  switch (subtype) {
    case 'title_page':
      return 'Title page'
    case 'copyright':
      return 'Copyright'
    case 'dedication':
      return 'Dedication'
    case 'acknowledgments':
      return 'Acknowledgments'
    case 'about_author':
      return 'About the author'
    default:
      return type === 'front_matter' ? 'Front matter' : 'Back matter'
  }
}
