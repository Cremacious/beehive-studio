// Central registry of one-time tip definitions. Adding a tip is a one-line
// entry here, then a `<PageExplainer tipKey="..." />` or `<CoachMark tipKey="..." />`
// at the surface. Keys are stable strings persisted in localStorage by
// useDismissedTips, so renaming a key re-shows the tip (treat keys as permanent).
//
// Copy honors the no-em-dash rule and brand-yellow restraint.

export type TipDef = {
  key: string
  title: string
  body: string
}

export const TIPS = {
  'editor-intro': {
    key: 'editor-intro',
    title: 'Welcome to your studio',
    body: 'The binder on the left holds your chapters, characters, and notes. The center is where you write. The panel on the right shows status and details for whatever is open. On desktop, drag the edge of either side panel to make it larger or smaller. Everything autosaves as you go.',
  },
  'editor-resize-panels': {
    key: 'editor-resize-panels',
    title: 'Resize your panels',
    body: 'Drag this edge to make the binder wider or narrower. Drag the matching edge on the right to resize the details panel. Press Cmd or Ctrl plus B to hide the binder entirely.',
  },
  'community-intro': {
    key: 'community-intro',
    title: 'Your community dashboard',
    body: 'This is your home base for everything social. See what writers you follow are posting, track your hives, sparks, and clubs, and jump into recent activity. Empty panels show what to try next.',
  },
  'discover-intro': {
    key: 'discover-intro',
    title: 'Find your next read',
    body: 'Browse books, sparks, reading lists, clubs, and hives from across the community. Use the tabs to switch what you are exploring and the filters on the left to narrow things down.',
  },
} satisfies Record<string, TipDef>

export type TipKey = keyof typeof TIPS

export function getTip(key: TipKey): TipDef {
  return TIPS[key]
}
