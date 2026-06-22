'use client'

import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { DiscussionComposer } from '../../../_components/discussion-composer'

const PROMPTS = [
  'What chapter is everyone on?',
  'Favorite quote so far?',
  'Hot takes about the protagonist',
  'What surprised you most?',
]

export function StarterZone({
  clubId,
  isEmpty,
}: {
  clubId: string
  isEmpty: boolean
}) {
  const [open, setOpen] = useState(false)
  const [seed, setSeed] = useState<string | undefined>(undefined)

  function openWith(prompt?: string) {
    setSeed(prompt)
    setOpen(true)
  }

  return (
    <>
      <div
        style={{
          margin: '0 22px 22px',
          padding: '18px 18px 16px',
          background: 'linear-gradient(180deg, rgba(255,195,0,0.06), rgba(255,195,0,0.02))',
          border: '1px dashed rgba(255,195,0,0.25)',
          borderRadius: 'var(--r-row)',
          flexShrink: 0,
        }}
      >
        <h4
          style={{
            margin: '0 0 3px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--canvas-dark-ink-strong)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <MessageSquarePlus
            aria-hidden="true"
            style={{ width: 16, height: 16, color: 'var(--brand)' }}
          />
          {isEmpty ? 'Start the conversation' : "Don't see your topic?"}
        </h4>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 12,
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          {isEmpty
            ? 'Pick a prompt to kick off a new thread, or write your own.'
            : 'Pick a prompt or write your own.'}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          {PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => openWith(p)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--r-btn)',
                padding: '9px 12px',
                fontSize: 12,
                color: 'var(--canvas-dark-ink)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,195,0,0.08)'
                e.currentTarget.style.borderColor = 'rgba(255,195,0,0.3)'
                e.currentTarget.style.color = 'var(--brand)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.color = 'var(--canvas-dark-ink)'
              }}
            >
              <span style={{ color: 'var(--brand)', flexShrink: 0 }}>›</span>
              <span>{p}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openWith(undefined)}
          style={{
            marginTop: 10,
            background: 'transparent',
            border: 'none',
            color: 'var(--canvas-dark-ink-muted)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          or write your own →
        </button>
      </div>
      <DiscussionComposer
        clubId={clubId}
        open={open}
        onOpenChange={setOpen}
        initialTitle={seed}
      />
    </>
  )
}
