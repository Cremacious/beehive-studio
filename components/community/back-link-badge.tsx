import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Standalone back-link badge for detail pages that don't use <PageHead>.
 * Same dark-iOS chrome as PageHead's `back` prop — single source of truth.
 */
export function BackLinkBadge({ href, label }: { href: string; label: string }) {
  return (
    <div className="page-head" style={{ marginBottom: 18 }}>
      <Link href={href} className="back">
        <span className="icn">
          <ArrowLeft />
        </span>
        <span>Back to {label}</span>
      </Link>
    </div>
  )
}
