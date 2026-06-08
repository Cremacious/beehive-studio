import { Globe, Users, Lock } from 'lucide-react'

const META = {
  PUBLIC: { label: 'Public', Icon: Globe },
  FRIENDS: { label: 'Friends', Icon: Users },
  PRIVATE: { label: 'Private', Icon: Lock },
} as const

type Visibility = keyof typeof META

export function VisibilityPill({ visibility }: { visibility: Visibility }) {
  const { label, Icon } = META[visibility]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}
