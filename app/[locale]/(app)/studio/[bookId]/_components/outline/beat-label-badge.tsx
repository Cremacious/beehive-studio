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
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 'var(--r-pill)',
        color: 'var(--outline-ink-strong)',
        background: 'oklch(from var(--outline-ink-strong) l c h / 0.08)',
        border: '1px solid var(--outline-rule)',
        whiteSpace: 'nowrap',
      }}
    >
      {LABEL_DISPLAY[label]}
    </span>
  )
}

export { LABEL_DISPLAY as BEAT_LABEL_DISPLAY }
