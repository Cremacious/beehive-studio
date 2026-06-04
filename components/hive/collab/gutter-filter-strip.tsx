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
    showSuggestions: false,
    showResolved: false,
  }
}

type LayerPill = {
  layer: AnnotationLayer
  label: string
  dot: string
}

const LAYER_PILLS: LayerPill[] = [
  { layer: 'GRAMMAR',    label: 'Grammar',    dot: 'var(--layer-grammar)' },
  { layer: 'PLOT',       label: 'Plot',       dot: 'var(--layer-plot)' },
  { layer: 'TONE',       label: 'Tone',       dot: 'var(--layer-tone)' },
  { layer: 'CONTINUITY', label: 'Continuity', dot: 'var(--layer-continuity)' },
  { layer: 'GENERAL',    label: 'General',    dot: 'var(--layer-general)' },
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
        typeof parsed.showSuggestions === 'boolean' ? parsed.showSuggestions : false,
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
    <div
      className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2"
      style={{ borderColor: 'var(--canvas-dark-300)' }}
    >
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
      style={{
        borderRadius: 'var(--r-pill)',
        background: active
          ? 'var(--brand)'
          : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-strong)',
        boxShadow: 'var(--sh-tile)',
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-geist font-semibold transition hover:opacity-90"
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
