'use client'

import { useMemo } from 'react'
import { EmptyState } from '../empty-state'

// ---------------------------------------------------------------------------
// Text extraction helper
// ---------------------------------------------------------------------------

export function extractPlainText(json: unknown): string {
  if (!json || typeof json !== 'object') return ''
  const node = json as { type?: string; text?: string; content?: unknown[] }
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(extractPlainText).join(node.type === 'paragraph' ? '\n' : '')
}

// ---------------------------------------------------------------------------
// Analysis helpers
// ---------------------------------------------------------------------------

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '')
  if (word.length <= 3) return 1
  const vowelGroups = word.match(/[aeiouy]+/g)
  const count = vowelGroups ? vowelGroups.length : 1
  // subtract silent e
  const silentE = word.endsWith('e') && !word.endsWith('le') ? 1 : 0
  return Math.max(1, count - silentE)
}

function fleschKincaid(text: string): { score: number; label: string } {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0)
  if (sentences.length === 0 || words.length === 0) return { score: 0, label: 'N/A' }
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
  const clamped = Math.max(0, Math.min(100, score))
  const label =
    clamped >= 90 ? 'Very Easy'
    : clamped >= 70 ? 'Easy'
    : clamped >= 60 ? 'Standard'
    : clamped >= 50 ? 'Fairly Difficult'
    : clamped >= 30 ? 'Difficult'
    : 'Very Difficult'
  return { score: Math.round(clamped), label }
}

function avgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 2)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  if (sentences.length === 0) return 0
  return Math.round(words.length / sentences.length)
}

function findAdverbs(text: string): string[] {
  const matches = text.match(/\b\w+ly\b/gi) ?? []
  const notAdverbs = new Set([
    'only', 'family', 'early', 'likely', 'lonely', 'lovely', 'friendly',
    'lively', 'silly', 'holy', 'ugly', 'bully', 'belly', 'ally', 'folly',
    'rally', 'tally', 'sally',
  ])
  return matches.filter(w => !notAdverbs.has(w.toLowerCase()))
}

function findPassiveVoice(text: string): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 2)
  const passiveRegex = /\b(was|were|is|are|been|being|be)\s+\w+ed\b/i
  return sentences
    .filter(s => passiveRegex.test(s))
    .map(s => s.trim())
    .slice(0, 5)
}

const CLICHES = [
  'at the end of the day', 'when all is said and done', 'in the nick of time',
  'bite the bullet', 'back to square one', 'the bottom line', 'think outside the box',
  'break a leg', 'under the weather', 'it goes without saying', 'at this point in time',
  'in terms of', 'on the same page', 'hit the ground running', 'move the goalposts',
  'touch base', 'circle back', 'deep dive', 'unpack', 'pivotal moment',
  'heart of gold', 'crystal clear', 'bone dry', 'pitch black', 'dead silence',
  'time will tell', 'easier said than done', 'all in all', 'needless to say',
  'last but not least', 'in the blink of an eye', 'head over heels',
]

function findCliches(text: string): string[] {
  const lower = text.toLowerCase()
  return CLICHES.filter(c => lower.includes(c))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  editorText: string
  isOpen: boolean
  onClose: () => void
}

export function WritingAnalysis({ editorText, isOpen, onClose }: Props) {
  const fk = useMemo(() => fleschKincaid(editorText), [editorText])
  const avgLen = useMemo(() => avgSentenceLength(editorText), [editorText])
  const adverbs = useMemo(() => findAdverbs(editorText), [editorText])
  const passive = useMemo(() => findPassiveVoice(editorText), [editorText])
  const cliches = useMemo(() => findCliches(editorText), [editorText])

  if (!isOpen) return null

  return (
    <aside className="w-60 flex-shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-bold text-foreground/70 uppercase tracking-wide">Writing Analysis</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">×</button>
      </div>

      {editorText.trim().length === 0 ? (
        <EmptyState title="Nothing to analyze yet" body="Start writing to see analysis." />
      ) : (
        <div className="p-4 flex flex-col gap-5">
          {/* Readability */}
          <Section title="Readability">
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-foreground">{fk.score}</span>
              <span className="text-xs text-muted-foreground">{fk.label}</span>
            </div>
            <div className="h-1.5 bg-surface rounded-full mt-1.5">
              <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${fk.score}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Avg {avgLen} words/sentence</p>
          </Section>

          {/* Adverbs */}
          <Section title={`Adverbs (${adverbs.length})`}>
            {adverbs.length === 0 ? (
              <p className="text-xs text-muted-foreground">None found. ✓</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {adverbs.slice(0, 15).map((w, i) => (
                  <span key={i} className="text-xs bg-brand/10 text-brand px-1.5 py-0.5 rounded">{w}</span>
                ))}
                {adverbs.length > 15 && (
                  <span className="text-xs text-muted-foreground">+{adverbs.length - 15} more</span>
                )}
              </div>
            )}
          </Section>

          {/* Passive voice */}
          <Section title={`Passive Voice (${passive.length})`}>
            {passive.length === 0 ? (
              <p className="text-xs text-muted-foreground">None detected. ✓</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {passive.map((s, i) => (
                  <li key={i} className="text-xs text-foreground/70 border-l-2 border-brand/30 pl-2 line-clamp-2">{s}</li>
                ))}
              </ul>
            )}
          </Section>

          {/* Clichés */}
          <Section title={`Clichés (${cliches.length})`}>
            {cliches.length === 0 ? (
              <p className="text-xs text-muted-foreground">None found. ✓</p>
            ) : (
              <div className="flex flex-col gap-1">
                {cliches.map((c, i) => (
                  <span key={i} className="text-xs text-foreground/70 italic">&ldquo;{c}&rdquo;</span>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </aside>
  )
}
