/**
 * Brand-yellow honeycomb 2:3 cover used as the fallback when a book has no
 * uploaded coverUrl. Lifted from app/[locale]/(app)/studio/_components/book-card.tsx
 * (the .bcv-cover / .honeycomb styles in globals.css) and packaged so other
 * surfaces (bookmarks shelf, suggestion strips, etc.) can use the same look
 * without re-implementing the SVG pattern.
 */

type Props = {
  /** Renders the uploaded cover when provided; otherwise the honeycomb default. */
  src?: string | null
  alt?: string
  /** Per-instance pattern id — required because multiple SVGs share the doc. */
  uid: string
}

export function HoneycombCover({ src, alt = '', uid }: Props) {
  return (
    <div
      className="absolute inset-0"
      style={{ background: 'var(--brand)' }}
      aria-hidden={src ? undefined : 'true'}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id={`hex-${uid}`}
              x="0"
              y="0"
              width="60"
              height="52"
              patternUnits="userSpaceOnUse"
            >
              <g
                fill="none"
                stroke="rgba(40, 25, 5, 0.22)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              >
                <polygon points="15,0 27,7 27,19 15,26 3,19 3,7" />
                <polygon points="45,26 57,33 57,45 45,52 33,45 33,33" />
                <polygon points="45,-26 57,-19 57,-7 45,0 33,-7 33,-19" />
                <polygon points="15,52 27,59 27,71 15,78 3,71 3,59" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#hex-${uid})`} />
        </svg>
      )}
    </div>
  )
}
