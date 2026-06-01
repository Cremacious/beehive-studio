'use client'

import { useEffect, useRef } from 'react'
import type { AnnotationLayer } from '@/lib/actions/hive-annotations.actions'

export type FilterState = {
  layers: Set<AnnotationLayer>
  showSuggestions: boolean
  showResolved: boolean
}

export function defaultFilterState(): FilterState {
  return {
    layers: new Set<AnnotationLayer>(),
    showSuggestions: true,
    showResolved: false,
  }
}

type LayerPill = {
  layer: AnnotationLayer
  label: string
  dot: string
}

const LAYER_PILLS: LayerPill[] = [
  { layer: 'GRAMMAR',    label: 'Grammar',    dot: 'oklch(0.72 0.10 165)' },
  { layer: 'PLOT',       label: 'Plot',       dot: 'oklch(0.72 0.13 25)' },
  { layer: 'TONE',       label: 'Tone',       dot: 'oklch(0.72 0.13 290)' },
  { layer: 'CONTINUITY', label: 'Continuity', dot: 'oklch(0.72 0.10 200)' },
  { layer: 'GENERAL',    label: 'General',    dot: 'oklch(0.74 0.13 80)' },
]

const SUGGESTION_DOT = 'oklch(0.78 0.10 65)'

type SerializedFilter = {
  layers: AnnotationLayer[]
  showSuggestions: boolean
  showResolved: boolean
}

function serialize(s: FilterState): SerializedFilter {
  return {
    layers: Array.from(s.layers),
    showSuggestions: s.showSuggestions,
    showResolved: s.showResolved,
  }
}

function deserialize(raw: string | null): FilterState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SerializedFilter
    if (!parsed || typeof parsed !== 'object') return null
    return {
      layers: new Set<AnnotationLayer>(
        Array.isArray(parsed.layers) ? parsed.layers : [],
      ),
      showSuggestions:
        typeof parsed.showSuggestions === 'boolean' ? parsed.showSuggestions : true,
      showResolved:
        typeof parsed.showResolved === 'boolean' ? parsed.showResolved : false,
    }
  } catch {
    return null
  }
}

type Props = {
  chapterId: string
  value: FilterState
  onChange: (next: FilterState) => void
}

export function GutterFilterStrip({ chapterId, value, onChange }: Props) {
  const hydratedRef = useRef(false)
  const storageKey = `collab:filter:${chapterId}`

  // Load on mount (once per chapterId).
  useEffect(() => {
    if (typeof window === 'undefined') return
    hydratedRef.current = false
    const raw = window.localStorage.getItem(storageKey)
    const restored = deserialize(raw)
    if (restored) onChange(restored)
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId])

  // Persist on change after hydration.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hydratedRef.current) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(serialize(value)))
    } catch {
      // ignore (quota/private mode)
    }
  }, [value, storageKey])

  const allActive = value.layers.size === 0

  function toggleLayer(layer: AnnotationLayer) {
    const next = new Set(value.layers)
    if (next.has(layer)) next.delete(layer)
    else next.add(layer)
    onChange({ ...value, layers: next })
  }

  function clickAll() {
    if (allActive) return
    onChange({ ...value, layers: new Set<AnnotationLayer>() })
  }

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border px-2 py-2">
      <Pill active={allActive} onClick={clickAll}>
        All
      </Pill>
      {LAYER_PILLS.map((p) => (
        <Pill
          key={p.layer}
          active={value.layers.has(p.layer)}
          onClick={() => toggleLayer(p.layer)}
          dot={p.dot}
        >
          {p.label}
        </Pill>
      ))}
      <Pill
        active={value.showSuggestions}
        onClick={() =>
          onChange({ ...value, showSuggestions: !value.showSuggestions })
        }
        dot={SUGGESTION_DOT}
      >
        Suggestions
      </Pill>
      <Pill
        active={value.showResolved}
        onClick={() =>
          onChange({ ...value, showResolved: !value.showResolved })
        }
      >
        Resolved
      </Pill>
    </div>
  )
}

function Pill({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean
  onClick: () => void
  dot?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition ' +
        (active
          ? 'border-brand bg-brand/10 text-foreground ring-1 ring-brand'
          : 'border-border bg-transparent text-muted-foreground hover:border-brand/50 hover:text-foreground')
      }
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: dot }}
        />
      ) : null}
      {children}
    </button>
  )
}
