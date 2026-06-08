'use client'
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from 'react'
import { MentionPopover } from './mention-popover'

type Result = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (next: string) => void
}

type State =
  | { kind: 'idle' }
  | { kind: 'active'; queryStart: number; query: string; anchorRect: DOMRect }

export const MentionableTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function MentionableTextarea({ value, onChange, ...rest }, ref) {
    const localRef = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(ref, () => localRef.current!, [])
    const [state, setState] = useState<State>({ kind: 'idle' })

    const updateState = useCallback(() => {
      const ta = localRef.current
      if (!ta) return
      const caret = ta.selectionStart
      const upto = value.slice(0, caret)
      const match = upto.match(/(?:^|\s)@([a-z0-9_]{0,20})$/i)
      if (match) {
        const queryStart = caret - match[1].length - 1 // include '@'
        const rect = ta.getBoundingClientRect()
        // Anchor below the textarea (caret-line precision deferred per plan).
        const anchorRect = new DOMRect(rect.left + 8, rect.bottom - 4, 0, 0)
        setState({ kind: 'active', queryStart, query: match[1], anchorRect })
      } else {
        setState({ kind: 'idle' })
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
      queueMicrotask(updateState)
    }

    const handleSelect = () => {
      updateState()
    }

    const handleBlur = () => {
      // Defer so popover click can land first.
      setTimeout(() => setState({ kind: 'idle' }), 100)
    }

    const handlePick = (user: Result) => {
      if (state.kind !== 'active') return
      const ta = localRef.current
      if (!ta) return
      const before = value.slice(0, state.queryStart)
      const after = value.slice(state.queryStart + 1 + state.query.length)
      const next = `${before}@${user.username} ${after}`
      onChange(next)
      setState({ kind: 'idle' })
      requestAnimationFrame(() => {
        ta.focus()
        const newCaret = before.length + 1 + user.username.length + 1
        ta.setSelectionRange(newCaret, newCaret)
      })
    }

    return (
      <>
        <textarea
          {...rest}
          ref={localRef}
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onBlur={handleBlur}
        />
        <MentionPopover
          isActive={state.kind === 'active'}
          query={state.kind === 'active' ? state.query : ''}
          anchorRect={state.kind === 'active' ? state.anchorRect : null}
          onPick={handlePick}
          onClose={() => setState({ kind: 'idle' })}
        />
      </>
    )
  }
)
