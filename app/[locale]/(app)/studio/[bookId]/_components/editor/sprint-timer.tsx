'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

type Props = { currentWordCount: number }

export function SprintTimer({ currentWordCount }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [duration, setDuration] = useState(25 * 60)
  const [remaining, setRemaining] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [startWordCount, setStartWordCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false)
          setDone(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const handleStart = useCallback(() => {
    setStartWordCount(currentWordCount)
    setRemaining(duration)
    setDone(false)
    setIsRunning(true)
  }, [currentWordCount, duration])

  const handlePause = useCallback(() => setIsRunning(false), [])
  const handleResume = useCallback(() => setIsRunning(true), [])

  const handleReset = useCallback(() => {
    setIsRunning(false)
    setDone(false)
    setRemaining(duration)
  }, [duration])

  const handleNewSprint = useCallback(() => {
    setIsRunning(false)
    setDone(false)
    setRemaining(duration)
  }, [duration])

  const handleDurationChange = useCallback((secs: number) => {
    setDuration(secs)
    if (!isRunning && !done) setRemaining(secs)
  }, [isRunning, done])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const nearEnd = remaining <= 5 * 60

  const isPaused = !isRunning && !done && remaining < duration && remaining > 0

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 right-4 text-xs text-foreground/40 hover:text-foreground/70 bg-surface border border-border rounded-full px-3 py-1.5 transition-colors"
      >
        ⏱ Sprint
      </button>
    )
  }

  return (
    <div className="absolute bottom-4 right-4 bg-surface-elevated border border-border rounded-xl p-4 w-56 shadow-xl z-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-foreground/70">Writing Sprint</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-foreground/40 hover:text-foreground/70 text-sm leading-none transition-colors"
        >
          ×
        </button>
      </div>

      {!isRunning && !done && !isPaused && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {[10, 15, 25, 45, 60].map(min => (
            <button
              key={min}
              onClick={() => handleDurationChange(min * 60)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border',
                duration === min * 60
                  ? 'border-brand text-brand bg-brand/10'
                  : 'border-border text-muted-foreground hover:border-brand/40',
              )}
            >
              {min}m
            </button>
          ))}
        </div>
      )}

      <div className={cn('text-3xl font-mono font-semibold tracking-tight mb-3', nearEnd ? 'text-brand' : 'text-foreground')}>
        {mm}:{ss}
      </div>

      {done ? (
        <div className="mb-3 space-y-1">
          <p className="text-xs text-foreground/70">Sprint complete! ✓</p>
          <p className="text-sm font-medium text-brand">+{Math.max(0, currentWordCount - startWordCount)} words</p>
        </div>
      ) : null}

      <div className="flex gap-2">
        {done && (
          <button
            onClick={handleNewSprint}
            className="flex-1 text-xs bg-brand text-black font-medium rounded-lg py-1.5 hover:bg-brand/90 transition-colors"
          >
            New Sprint
          </button>
        )}

        {!isRunning && !done && !isPaused && (
          <button
            onClick={handleStart}
            className="flex-1 text-xs bg-brand text-black font-medium rounded-lg py-1.5 hover:bg-brand/90 transition-colors"
          >
            Start
          </button>
        )}

        {isRunning && (
          <button
            onClick={handlePause}
            className="flex-1 text-xs bg-surface border border-border text-foreground/70 font-medium rounded-lg py-1.5 hover:text-foreground transition-colors"
          >
            Pause
          </button>
        )}

        {isPaused && (
          <>
            <button
              onClick={handleResume}
              className="flex-1 text-xs bg-brand text-black font-medium rounded-lg py-1.5 hover:bg-brand/90 transition-colors"
            >
              Resume
            </button>
            <button
              onClick={handleReset}
              className="flex-1 text-xs bg-surface border border-border text-foreground/70 font-medium rounded-lg py-1.5 hover:text-foreground transition-colors"
            >
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  )
}
