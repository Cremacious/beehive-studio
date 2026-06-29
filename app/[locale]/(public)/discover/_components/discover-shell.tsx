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
    // items-stretch on mobile (flex-col) so the main column fills the width
    // instead of sizing to its widest child (issue #50 — the hero card was
    // spilling off-screen). Desktop keeps items-start for top alignment.
    <div className="flex flex-col md:flex-row gap-6 items-stretch md:items-start">
      {sidebar}
      <div className="flex-1 min-w-0 flex flex-col gap-4">{main}</div>
    </div>
  )
}
