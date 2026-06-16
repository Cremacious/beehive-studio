import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Props = {
  href: string
  /** Label after "Back to". e.g. "community" → "Back to community". */
  label?: string
}

/**
 * Standalone "Back to {label}" link styled with the existing
 * `.page-head .back` CSS (defined in app/globals.css ~L760).
 *
 * Pulled out of <PageHead> so the hub pages (/sparks, /hives,
 * /reading-lists, /clubs) can mount it without adopting the rest of
 * PageHead's title/subtitle structure (those pages have their own
 * inline headers with custom typography + CTAs).
 */
export function BackToCommunity({ href, label = 'community' }: Props) {
  return (
    <div className="page-head" style={{ marginBottom: 16 }}>
      <Link href={href} className="back">
        <span className="icn">
          <ArrowLeft aria-hidden="true" />
        </span>
        <span>Back to {label}</span>
      </Link>
    </div>
  )
}
