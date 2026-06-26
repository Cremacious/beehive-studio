import type { CSSProperties, ElementType, ReactNode } from 'react'

/**
 * Shared responsive page container (issue #49).
 *
 * Single source of truth for content max-width per device tier. Centers
 * content, applies stepped horizontal gutters, and caps the max content
 * width so nothing runs edge-to-edge on large/ultrawide monitors. The
 * width tokens + breakpoint ladder live in `app/globals.css` (`.page-x`
 * + `.page-x.tier-*`); this component is a thin wrapper over them so the
 * caps never drift between component and CSS consumers.
 *
 * Tiers (each steps UP its cap across the shared breakpoints):
 *   narrow   440                         — auth cards, claim/redeem pages
 *   prose    768 → 820 → 860             — legal, long-form reading measure
 *   reader   1080                        — book / chapter reader
 *   standard fluid → 1200 → 1320         — profile, support, detail pages
 *   wide     fluid → 1280 → 1440 → 1680  — dashboards, hubs, card grids
 *   max      fluid → 1280 → 1536 → 1920  — discover, studio editor shell
 */
export type PageTier =
  | 'narrow'
  | 'prose'
  | 'reader'
  | 'standard'
  | 'wide'
  | 'max'

type PageContainerProps = {
  tier: PageTier
  children: ReactNode
  /** Extra classes appended after the container classes. */
  className?: string
  /** Inline styles (e.g. vertical padding); horizontal gutters are owned by `.page-x`. */
  style?: CSSProperties
  /** Render element. Defaults to `div`; pass `main` / `section` as needed. */
  as?: ElementType
}

export function PageContainer({
  tier,
  children,
  className,
  style,
  as: Tag = 'div',
}: PageContainerProps) {
  return (
    <Tag className={`page-x tier-${tier}${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </Tag>
  )
}
