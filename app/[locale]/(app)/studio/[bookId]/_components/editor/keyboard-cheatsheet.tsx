'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type Shortcut = { keys: string; action: string }

function getMod(): string {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'
}

// Paper-key <kbd> visual — raised pill with subtle top highlight + bottom shadow,
// per overlays-modes/styles.css `.kbcap`. Renders one cap per key with a thin
// monospaced "+" between caps.
function KbCombo({ keys }: { keys: string }) {
  const parts = keys.split('+')
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((k, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span
              className="font-mono text-[10px]"
              style={{ color: 'var(--chrome-500)' }}
            >
              +
            </span>
          )}
          <kbd
            className="inline-flex items-center justify-center font-mono"
            style={{
              minWidth: 22,
              height: 24,
              padding: '0 7px',
              fontSize: 11.5,
              fontWeight: 500,
              color: 'var(--chrome-100)',
              background:
                'linear-gradient(180deg, var(--chrome-800), var(--chrome-850))',
              border: '1px solid var(--chrome-700)',
              borderRadius: 4,
              boxShadow:
                '0 1px 0 rgba(255,255,255,0.06) inset, 0 -1px 0 rgba(0,0,0,0.3) inset, 0 1px 0 rgba(0,0,0,0.6), 0 2px 3px rgba(0,0,0,0.35)',
            }}
          >
            {k}
          </kbd>
        </span>
      ))}
    </span>
  )
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
    { keys: `${mod}+/`,         action: 'This help' },
  ]

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Always allow Esc to close
      if (open && e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }

      // Cmd/Ctrl+/ toggle — works from any focus context (editor included)
      // because the modifier makes conflict with typing impossible. The `/`
      // key and `?` share the same physical key on most layouts, so muscle
      // memory matches the "press ? for help" convention.
      if (e.key === '/' && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    // Capture phase so we hear the event before ProseMirror/TipTap can
    // stopPropagation on it. Without this, keys handled by the editor
    // never bubble up to the window-level bubble-phase listener.
    window.addEventListener('keydown', handleKeyDown, true)

    // Also listen for a custom event so the toolbar Help button can open us.
    function handleToggle() { setOpen(o => !o) }
    window.addEventListener('beehive:toggle-cheatsheet', handleToggle)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('beehive:toggle-cheatsheet', handleToggle)
    }
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
        className="w-[480px] max-w-[90vw] rounded-lg border border-border bg-popover shadow-xl"
      >
        <div className="flex items-center justify-between px-[22px] pt-[18px] pb-[14px] gap-[18px]">
          <h3
            id="cheatsheet-title"
            className="text-foreground m-0"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.005em',
            }}
          >
            Keyboard shortcuts
          </h3>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
            className="inline-flex items-center justify-center rounded-md transition-colors hover:bg-surface-elevated"
            style={{
              width: 30,
              height: 30,
              color: 'var(--chrome-400)',
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-[22px] pb-[18px]">
          <ul
            className="grid items-center"
            style={{
              gridTemplateColumns: '1fr auto',
              rowGap: 2,
              columnGap: 16,
            }}
          >
            {shortcuts.map(s => (
              <li key={s.keys} className="contents">
                <span
                  className="py-2 text-foreground/85"
                  style={{ fontSize: 13 }}
                >
                  {s.action}
                </span>
                <span className="py-2 text-right">
                  <KbCombo keys={s.keys} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
