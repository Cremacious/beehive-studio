'use client'

import { useState, useEffect, useRef } from 'react'
import { Timer, Pause, Play, Square, X } from 'lucide-react'

type SprintState =
  | { type: 'idle' }
  | { type: 'setup' }
  | { type: 'running'; startedAt: number; durationMs: number; startWordCount: number; remainingMs: number }
  | { type: 'paused'; remainingMs: number; durationMs: number; startWordCount: number }
  | { type: 'finished'; wordsWritten: number }

type Props = { currentWordCount: number }

// Matches the durations the old SprintTimer offered (10/15/25/45/60).
// Trimmed to 15/25/50 per the plan; 10 and 45 are uncommon — the picker stays
// compact in the status bar's right cluster.
const DEFAULT_DURATIONS = [15, 25, 50] // minutes

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SprintControls({ currentWordCount }: Props) {
  const [state, setState] = useState<SprintState>({ type: 'idle' })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.type !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    intervalRef.current = setInterval(() => {
      setState(prev => {
        if (prev.type !== 'running') return prev
        const elapsed = Date.now() - prev.startedAt
        const remaining = prev.durationMs - elapsed
        if (remaining <= 0) {
          return {
            type: 'finished',
            wordsWritten: Math.max(0, currentWordCount - prev.startWordCount),
          }
        }
        return { ...prev, remainingMs: remaining }
      })
    }, 250)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [state.type, currentWordCount])

  function start(minutes: number) {
    const durationMs = minutes * 60_000
    setState({
      type: 'running',
      startedAt: Date.now(),
      durationMs,
      startWordCount: currentWordCount,
      remainingMs: durationMs,
    })
  }

  function pause() {
    if (state.type !== 'running') return
    setState({
      type: 'paused',
      remainingMs: state.remainingMs,
      durationMs: state.durationMs,
      startWordCount: state.startWordCount,
    })
  }

  function resume() {
    if (state.type !== 'paused') return
    setState({
      type: 'running',
      startedAt: Date.now() - (state.durationMs - state.remainingMs),
      durationMs: state.durationMs,
      startWordCount: state.startWordCount,
      remainingMs: state.remainingMs,
    })
  }

  function stop() {
    setState({ type: 'idle' })
  }

  function dismissFinished() {
    setState({ type: 'idle' })
  }

  if (state.type === 'idle') {
    return (
      <button
        onClick={() => setState({ type: 'setup' })}
        aria-label="Start writing sprint"
        style={{
          borderRadius: 'var(--r-pill)',
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          color: 'var(--canvas-dark-ink-strong)',
        }}
        className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 hover:opacity-90 transition-opacity"
      >
        <Timer size={12} />
        <span>Start sprint</span>
      </button>
    )
  }

  if (state.type === 'setup') {
    return (
      <div className="relative inline-block">
        {/* Anchor placeholder — keeps the setup state in flow */}
        <span
          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded text-brand"
          style={{ background: 'var(--brand-soft)' }}
        >
          <Timer size={12} />
          <span>Choose duration…</span>
        </span>
        {/* Popover surface — anchored above the anchor */}
        <div
          role="dialog"
          aria-label="Sprint duration"
          className="absolute z-50"
          style={{
            bottom: 'calc(100% + 10px)',
            right: 0,
            width: 260,
            background:
              'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            border: 'var(--br-card)',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            padding: 14,
          }}
        >
          {/* Callout tail */}
          <span
            aria-hidden
            className="absolute"
            style={{
              bottom: -7,
              right: 18,
              width: 14,
              height: 14,
              background: 'var(--canvas-dark-200)',
              borderRight: 'var(--br-card)',
              borderBottom: 'var(--br-card)',
              transform: 'rotate(45deg)',
            }}
          />
          <div className="flex items-start justify-between mb-1">
            <div
              className="inline-flex items-center gap-2"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--brand)',
                letterSpacing: '-0.005em',
              }}
            >
              <Timer size={13} className="text-brand" />
              Writing sprint
            </div>
            <button
              onClick={() => setState({ type: 'idle' })}
              aria-label="Cancel sprint setup"
              className="inline-flex items-center justify-center rounded transition-colors hover:bg-surface-elevated"
              style={{ width: 22, height: 22, color: 'var(--canvas-dark-ink-muted)' }}
            >
              <X size={12} />
            </button>
          </div>
          <p
            className="mb-3"
            style={{ fontSize: 11, color: 'var(--chrome-400)' }}
          >
            Pick a focused writing block — pause anytime.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {DEFAULT_DURATIONS.map(m => (
              <button
                key={m}
                onClick={() => start(m)}
                className="text-center transition-colors group"
                style={{
                  padding: '10px 6px',
                  borderRadius: 'var(--r-btn)',
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  boxShadow: 'var(--sh-tile)',
                  color: 'var(--canvas-dark-ink-strong)',
                  border: '1px solid transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-brand)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--canvas-dark-ink-strong)',
                    lineHeight: 1,
                  }}
                >
                  {m}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: 'var(--canvas-dark-ink-muted)',
                    marginTop: 3,
                  }}
                >
                  Min
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (state.type === 'running' || state.type === 'paused') {
    return (
      <div className="inline-flex items-center gap-2">
        <span
          data-slot="sprint-time"
          className="inline-flex items-center gap-1 text-xs tabular-nums"
          style={{ color: 'var(--chrome-300)' }}
        >
          <Timer size={12} className="text-brand" />
          {formatTime(state.remainingMs)}
        </span>
        {state.type === 'running' ? (
          <button onClick={pause} aria-label="Pause sprint" className="text-foreground/80 hover:text-brand transition-colors">
            <Pause size={12} />
          </button>
        ) : (
          <button onClick={resume} aria-label="Resume sprint" className="text-foreground/80 hover:text-brand transition-colors">
            <Play size={12} />
          </button>
        )}
        <button onClick={stop} aria-label="Stop sprint" className="text-foreground/80 hover:text-brand transition-colors">
          <Square size={12} />
        </button>
      </div>
    )
  }

  // finished — carries forward the old SprintTimer's "+N words" celebration.
  return (
    <button
      onClick={dismissFinished}
      className="animate-sprint-finished inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-brand/15 text-brand border border-brand/30 hover:bg-brand/25 transition-colors"
      title="Click to dismiss"
    >
      <Timer size={12} />
      <span>Sprint complete · +{state.wordsWritten} words</span>
    </button>
  )
}
