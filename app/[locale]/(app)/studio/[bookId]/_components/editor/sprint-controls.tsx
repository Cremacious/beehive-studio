'use client'

import { useState, useEffect, useRef } from 'react'
import { Timer, Pause, Play, Square } from 'lucide-react'

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
        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded text-foreground/80 hover:text-brand hover:bg-brand/10 transition-colors"
      >
        <Timer size={12} />
        <span>Start sprint</span>
      </button>
    )
  }

  if (state.type === 'setup') {
    return (
      <div className="relative inline-flex items-center gap-1">
        <span className="text-xs text-foreground mr-1">Sprint:</span>
        {DEFAULT_DURATIONS.map(m => (
          <button
            key={m}
            onClick={() => start(m)}
            className="text-xs px-2 py-1 rounded border border-border text-foreground hover:text-brand hover:border-brand/40 hover:bg-brand/10 transition-colors"
          >
            {m}m
          </button>
        ))}
        <button
          onClick={() => setState({ type: 'idle' })}
          aria-label="Cancel sprint setup"
          className="text-xs px-1.5 py-1 text-foreground/70 hover:text-foreground transition-colors"
        >
          Cancel
        </button>
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
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-brand/15 text-brand border border-brand/30 hover:bg-brand/25 transition-colors"
      title="Click to dismiss"
    >
      <Timer size={12} />
      <span>Sprint complete · +{state.wordsWritten} words</span>
    </button>
  )
}
