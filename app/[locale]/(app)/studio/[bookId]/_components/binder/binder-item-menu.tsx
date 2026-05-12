'use client'

import type { TreeNode } from './binder-tree'

type Props = { node: TreeNode; onRenameStart: () => void }

export function BinderItemMenu({ }: Props) {
  return <span className="opacity-0 group-hover:opacity-100 text-muted-foreground text-xs ml-auto">⋯</span>
}
