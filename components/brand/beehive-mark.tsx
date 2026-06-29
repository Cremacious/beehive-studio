/**
 * Beehive Books logo mark — a stack of books narrowing into a beehive
 * silhouette. Brand yellow (#FFC300) books with white page blocks + spine
 * curves on a transparent background, so it reads on the dark UI everywhere.
 *
 * This is the canonical in-app rendering of the mark. The same artwork lives at
 * public/brand/beehive-logo.svg, from which the favicon / app-icon raster set is
 * generated (scripts/generate-brand-icons.mjs).
 *
 * Fixed two-color mark (not currentColor-themeable). Size it with className,
 * e.g. <BeehiveMark className="h-6 w-auto" />. The viewBox keeps the aspect
 * ratio, so set the height and let the width follow.
 *
 * Decorative by default (aria-hidden) since it is normally paired with the
 * "Beehive Books" wordmark text. Pass a `title` to give it an accessible name
 * when it stands alone.
 */
export function BeehiveMark({
  className,
  title,
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 791 398"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g>
        <path
          d="M 171.5,10 L 678,10 A 22 22 0 0 1 700,32 L 700,91 A 22 22 0 0 1 678,113 L 171.5,113 A 51.5 51.5 0 0 1 171.5,10 Z"
          fill="#FFC300"
        />
        <rect x="445" y="24" width="241" height="75" rx="13" fill="#FFFFFF" />
        <g stroke="#FFC300" strokeWidth="5" strokeLinecap="round">
          <line x1="456" y1="34" x2="675" y2="34" />
          <line x1="456" y1="48" x2="675" y2="48" />
          <line x1="456" y1="62" x2="675" y2="62" />
          <line x1="456" y1="76" x2="675" y2="76" />
          <line x1="456" y1="90" x2="675" y2="90" />
        </g>
        <path
          d="M 149,32.7 A 36.5 36.5 0 0 0 149,90.3"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
      <g>
        <path
          d="M 119.5,120 L 713,120 A 22 22 0 0 1 735,142 L 735,201 A 22 22 0 0 1 713,223 L 119.5,223 A 51.5 51.5 0 0 1 119.5,120 Z"
          fill="#FFC300"
        />
        <rect x="442" y="134" width="279" height="75" rx="13" fill="#FFFFFF" />
        <g stroke="#FFC300" strokeWidth="5" strokeLinecap="round">
          <line x1="453" y1="144" x2="710" y2="144" />
          <line x1="453" y1="158" x2="710" y2="158" />
          <line x1="453" y1="172" x2="710" y2="172" />
          <line x1="453" y1="186" x2="710" y2="186" />
          <line x1="453" y1="200" x2="710" y2="200" />
        </g>
        <path
          d="M 97,142.7 A 36.5 36.5 0 0 0 97,200.3"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
      <g>
        <path
          d="M 76,232 L 738,232 A 22 22 0 0 1 760,254 L 760,318 A 22 22 0 0 1 738,340 L 76,340 A 54 54 0 0 1 76,232 Z"
          fill="#FFC300"
        />
        <rect x="435" y="247" width="311" height="78" rx="13" fill="#FFFFFF" />
        <g stroke="#FFC300" strokeWidth="5" strokeLinecap="round">
          <line x1="446" y1="257" x2="735" y2="257" />
          <line x1="446" y1="273" x2="735" y2="273" />
          <line x1="446" y1="289" x2="735" y2="289" />
          <line x1="446" y1="305" x2="735" y2="305" />
          <line x1="446" y1="321" x2="735" y2="321" />
        </g>
        <path
          d="M 52,255.3 A 39 39 0 0 0 52,316.7"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
      <rect x="6" y="352" width="779" height="44" rx="16" fill="#FFC300" />
    </svg>
  )
}
