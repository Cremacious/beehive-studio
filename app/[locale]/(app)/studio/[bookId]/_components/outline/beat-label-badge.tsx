'use client'

import type { BeatLabel } from './outline-board'

const LABEL_DISPLAY: Record<BeatLabel, string> = {
  character: 'Character',
  scene: 'Scene',
  plot_point: 'Plot point',
  subplot: 'Subplot',
  world_building: 'World building',
  character_arc: 'Character arc',
  conflict: 'Conflict',
  note: 'Note',
}

export function BeatLabelBadge({ label }: { label: BeatLabel | null | undefined }) {
  if (!label) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 9px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 'var(--r-pill)',
        color: 'var(--canvas-dark-ink-strong)',
        background: 'var(--canvas-dark-100)',
        boxShadow: 'var(--sh-inset)',
        whiteSpace: 'nowrap',
      }}
    >
      {LABEL_DISPLAY[label]}
    </span>
  )
}

export { LABEL_DISPLAY as BEAT_LABEL_DISPLAY }
