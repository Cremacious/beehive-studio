import { Globe, Users, Lock } from 'lucide-react'
import type { SparkVisibility } from '@/db/schema/social'

const META: Record<SparkVisibility, { label: string; Icon: typeof Globe }> = {
  PUBLIC: { label: 'Public', Icon: Globe },
  FRIENDS: { label: 'Friends', Icon: Users },
  PRIVATE: { label: 'Private', Icon: Lock },
}

export function VisibilityPill({ visibility }: { visibility: SparkVisibility }) {
  const { label, Icon } = META[visibility]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}
