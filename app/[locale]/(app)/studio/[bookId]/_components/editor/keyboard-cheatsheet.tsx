'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type Shortcut = { keys: string; action: string }

function getMod(): string {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'
}

export function KeyboardCheatsheet() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mod = getMod()

  const shortcuts: Shortcut[] = [
    { keys: `${mod}+S`,         action: 'Save' },
    { keys: `${mod}+F`,         action: 'Find & replace' },
    { keys: `${mod}+B`,         action: 'Bold' },
    { keys: `${mod}+I`,         action: 'Italic' },
    { keys: `${mod}+U`,         action: 'Underline' },
    { keys: `${mod}+Z`,         action: 'Undo' },
    { keys: `${mod}+Shift+Z`,   action: 'Redo' },
    { keys: 'Esc',              action: 'Close panels' },
    { keys: '?',                action: 'This help' },
  ]

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Always allow Esc to close
      if (open && e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }

      // `?` toggle — only when focus is in editor or on body
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const active = document.activeElement
        const tag = active?.tagName?.toLowerCase()
        const inEditable =
          tag === 'input' ||
          tag === 'textarea' ||
          (active as HTMLElement | null)?.isContentEditable === true
        if (inEditable) return
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    // Defer one tick so the opening click doesn't immediately close
    const t = setTimeout(() => window.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheatsheet-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70"
    >
      <div
        ref={containerRef}
        className="w-[480px] max-w-[90vw] rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 id="cheatsheet-title" className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
            className="text-foreground/60 hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <ul className="p-5 flex flex-col gap-2">
          {shortcuts.map(s => (
            <li key={s.keys} className="flex items-center justify-between text-xs">
              <span className="text-foreground/80">{s.action}</span>
              <kbd className="rounded border border-border bg-surface-elevated px-2 py-0.5 text-foreground/90 font-mono">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
