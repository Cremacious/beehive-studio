'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GripVertical, X, Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { updateClubAction } from '@/lib/actions/book-clubs.actions'
import { SettingsCard } from './settings-card'
import { ScrollText } from 'lucide-react'

const MAX_RULE_LEN = 200
const MAX_RULES = 20

function parseRules(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
}

export function RulesEditor({
  clubId,
  initialRules,
}: {
  clubId: string
  initialRules: string | null
}) {
  const router = useRouter()
  const initial = parseRules(initialRules)
  const [rules, setRules] = useState<string[]>(initial)
  const [savedRules, setSavedRules] = useState<string[]>(initial)
  const [pending, startSave] = useTransition()

  const isDirty =
    rules.length !== savedRules.length ||
    rules.some((r, i) => r !== savedRules[i])

  function addRule() {
    if (rules.length >= MAX_RULES) {
      toast.error(`Max ${MAX_RULES} rules`)
      return
    }
    setRules((prev) => [...prev, ''])
  }

  function updateRule(i: number, value: string) {
    setRules((prev) => prev.map((r, idx) => (idx === i ? value : r)))
  }

  function removeRule(i: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== i))
  }

  function moveRule(from: number, dir: -1 | 1) {
    const to = from + dir
    if (to < 0 || to >= rules.length) return
    setRules((prev) => {
      const next = [...prev]
      const tmp = next[from]
      next[from] = next[to]
      next[to] = tmp
      return next
    })
  }

  function save() {
    const cleaned = rules.map((r) => r.trim()).filter(Boolean)
    if (cleaned.some((r) => r.length > MAX_RULE_LEN)) {
      toast.error(`Each rule must be under ${MAX_RULE_LEN} chars`)
      return
    }
    const serialized = cleaned.length > 0 ? cleaned.join('\n') : null
    startSave(async () => {
      const result = await updateClubAction({ clubId, rules: serialized })
      if (!result.success) {
        toast.error('Could not save rules')
        return
      }
      toast.success('Rules saved')
      setSavedRules(cleaned)
      setRules(cleaned)
      router.refresh()
    })
  }

  function discard() {
    setRules(savedRules)
  }

  return (
    <SettingsCard
      title="Club Rules"
      icon={<ScrollText size={16} />}
      description="Add one rule per row. Each is numbered automatically. Use the arrows to reorder. Click × to remove. Members see these on the club page."
      rightSlot={
        isDirty ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'oklch(0.75 0.13 70)',
            }}
          >
            Unsaved
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'oklch(0.7 0.13 145)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: 'oklch(0.7 0.13 145)',
              }}
            />
            Saved
          </span>
        )
      }
    >
      {/* Rules list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {rules.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              fontStyle: 'italic',
              color: 'var(--canvas-dark-ink-muted)',
              padding: '14px 12px',
              textAlign: 'center',
              background: 'var(--canvas-dark-100)',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-inset)',
              margin: 0,
            }}
          >
            No rules yet. Click + Add rule to get started.
          </p>
        ) : (
          rules.map((rule, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background:
                  'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-tile)',
              }}
            >
              {/* Reorder buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => moveRule(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: i === 0 ? 'not-allowed' : 'pointer',
                    color: 'var(--canvas-dark-ink-muted)',
                    padding: 0,
                    opacity: i === 0 ? 0.3 : 1,
                    height: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <ArrowUp size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => moveRule(i, 1)}
                  disabled={i === rules.length - 1}
                  aria-label="Move down"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: i === rules.length - 1 ? 'not-allowed' : 'pointer',
                    color: 'var(--canvas-dark-ink-muted)',
                    padding: 0,
                    opacity: i === rules.length - 1 ? 0.3 : 1,
                    height: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <ArrowDown size={10} />
                </button>
              </div>

              {/* Grip glyph (decorative — Drag is just the visual cue) */}
              <GripVertical
                size={14}
                style={{ color: 'var(--canvas-dark-ink-muted)', flexShrink: 0, opacity: 0.5 }}
                aria-hidden="true"
              />

              {/* Auto-number */}
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--brand)',
                  fontWeight: 700,
                  minWidth: 22,
                  textAlign: 'right',
                }}
              >
                {i + 1}.
              </span>

              {/* Rule text */}
              <input
                type="text"
                value={rule}
                onChange={(e) => updateRule(i, e.target.value)}
                placeholder="Type a rule…"
                maxLength={MAX_RULE_LEN}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid transparent',
                  color: 'var(--canvas-dark-ink)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  padding: '4px 0',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderBottomColor = 'var(--brand)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderBottomColor = 'transparent'
                }}
              />

              {/* Delete */}
              <button
                type="button"
                onClick={() => removeRule(i)}
                aria-label={`Remove rule ${i + 1}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--canvas-dark-ink-muted)',
                  padding: 4,
                  borderRadius: 6,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add + footer counter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          onClick={addRule}
          disabled={rules.length >= MAX_RULES}
          style={{
            background: 'transparent',
            border: '1px dashed rgba(255,195,0,0.30)',
            borderRadius: 'var(--r-btn)',
            padding: '7px 14px',
            color: 'var(--brand)',
            cursor: rules.length >= MAX_RULES ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            opacity: rules.length >= MAX_RULES ? 0.4 : 1,
          }}
        >
          <Plus size={11} /> Add rule
        </button>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          {rules.length} / {MAX_RULES}
        </span>
      </div>

      {/* Live preview */}
      {rules.length > 0 && (
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--canvas-dark-100)',
            borderRadius: 'var(--r-row)',
            boxShadow: 'var(--sh-inset)',
            marginBottom: 14,
          }}
        >
          <p
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--canvas-dark-ink-muted)',
              margin: '0 0 8px',
            }}
          >
            Preview · how readers see it
          </p>
          {rules
            .map((r) => r.trim())
            .filter(Boolean)
            .map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--brand)',
                    fontWeight: 700,
                    minWidth: 14,
                    textAlign: 'right',
                    paddingTop: 1,
                  }}
                >
                  {i + 1}.
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--canvas-dark-ink)',
                    lineHeight: 1.5,
                  }}
                >
                  {r}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Save bar */}
      {isDirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={discard}
            disabled={pending}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--canvas-dark-ink-muted)',
              borderRadius: 999,
              padding: '7px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              cursor: pending ? 'wait' : 'pointer',
            }}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              border: 'none',
              borderRadius: 999,
              padding: '7px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
              cursor: pending ? 'wait' : 'pointer',
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? 'Saving…' : 'Save rules'}
          </button>
        </div>
      )}
    </SettingsCard>
  )
}
