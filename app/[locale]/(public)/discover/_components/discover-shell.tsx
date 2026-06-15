import type { ReactNode } from 'react'

type Props = {
  sidebar: ReactNode
  main: ReactNode
}

/**
 * Two-column shell for the Discover redesign. Sidebar is fixed-width
 * (`--w-discover-sidebar`); main fills remaining space. Stacks vertically
 * on small viewports (mobile drawer pattern is deferred per spec §11).
 */
export function DiscoverShell({ sidebar, main }: Props) {
  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      {sidebar}
      <div className="flex-1 min-w-0 flex flex-col gap-4">{main}</div>
    </div>
  )
}
