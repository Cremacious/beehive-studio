'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { X, HelpCircle, Info } from 'lucide-react'
import { EmptyState } from '../empty-state'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

function sentenceLengthHistogram(text: string): { bins: number[]; total: number } {
  // bins: [<5, 5-10, 10-15, 15-20, 20-25, 25+]
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 2)
  const bins = [0, 0, 0, 0, 0, 0]
  for (const s of sentences) {
    const wc = s.trim().split(/\s+/).filter(Boolean).length
    if (wc < 5) bins[0]++
    else if (wc < 10) bins[1]++
    else if (wc < 15) bins[2]++
    else if (wc < 20) bins[3]++
    else if (wc < 25) bins[4]++
    else bins[5]++
  }
  return { bins, total: sentences.length }
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="py-4"
      style={{ borderBottom: '1px dashed var(--wa-section-sep)' }}
    >
      <p
        className="font-mono text-[10.5px] uppercase tracking-widest mb-2"
        style={{ color: 'var(--wa-ink-muted)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function StatRow({
  value,
  label,
  trailing,
}: {
  value: number | string
  label: string
  trailing?: ReactNode
}) {
  return (
    <div
      className="flex items-center gap-3 px-2.5 py-2 rounded-md"
      style={{
        background: 'var(--wa-stat-bg)',
        border: '1px solid var(--wa-stat-border)',
      }}
    >
      <span
        className="font-bold text-base w-10 text-right"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--wa-ink-strong)',
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </span>
      <span className="flex-1 text-xs" style={{ color: 'var(--wa-ink)' }}>
        {label}
      </span>
      {trailing}
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
  const [clichesListOpen, setClichesListOpen] = useState(false)
  const hist = useMemo(() => sentenceLengthHistogram(editorText), [editorText])

  if (!isOpen) return null

  const histMax = Math.max(1, ...hist.bins)
  const histLabels = ['<5', '5-10', '10-15', '15-20', '20-25', '25+']

  return (
    <aside
      data-slot="writing-analysis"
      className="w-72 flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        background: 'var(--wa-bg)',
        borderLeft: '1px solid var(--wa-border)',
        color: 'var(--wa-ink)',
      }}
    >
      {/* Theme-aware bridge — paper context for light mode */}
      <style>{`
        [data-slot="writing-analysis"] {
          --wa-bg: var(--chrome-900);
          --wa-border: var(--chrome-800);
          --wa-ink: var(--chrome-300);
          --wa-ink-strong: var(--chrome-100);
          --wa-ink-muted: var(--chrome-500);
          --wa-section-sep: var(--chrome-800);
          --wa-stat-bg: var(--chrome-800);
          --wa-stat-border: var(--chrome-800);
          --wa-bar-bg: var(--chrome-800);
          --wa-pill-bg: oklch(from var(--color-brand) l c h / 0.15);
        }
        [data-editor-theme="light"] [data-slot="writing-analysis"] {
          --wa-bg: var(--paper-100);
          --wa-border: var(--paper-300);
          --wa-ink: var(--paper-ink);
          --wa-ink-strong: var(--paper-ink-strong);
          --wa-ink-muted: var(--paper-ink-muted);
          --wa-section-sep: oklch(0.80 0.040 70 / 0.45);
          --wa-stat-bg: oklch(0.78 0.04 60 / 0.10);
          --wa-stat-border: oklch(0.78 0.04 60 / 0.25);
          --wa-bar-bg: oklch(0.78 0.04 60 / 0.20);
          --wa-pill-bg: oklch(from var(--color-brand) l c h / 0.22);
        }
      `}</style>

      <div
        className="flex items-center gap-2.5 px-4 py-3.5"
        style={{ borderBottom: '1px solid var(--wa-border)' }}
      >
        <h2
          className="flex-1 text-sm font-bold leading-tight"
          style={{
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.005em',
            color: 'var(--wa-ink-strong)',
          }}
        >
          Writing analysis
        </h2>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="How writing analysis works"
                className="transition-colors p-1 rounded hover:opacity-100"
                style={{ color: 'var(--wa-ink-muted)' }}
              >
                <HelpCircle size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-80 text-xs leading-relaxed">
              <h4
                className="text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--chrome-100)',
                }}
              >
                How this works
              </h4>
              <p className="mb-3" style={{ color: 'var(--chrome-200)' }}>
                Quick heuristic metrics — not linguistic analysis. Use as nudges, not rules.
              </p>
              <dl className="flex flex-col gap-2.5">
                <div>
                  <dt className="font-semibold" style={{ color: 'var(--chrome-100)' }}>Readability</dt>
                  <dd style={{ color: 'var(--chrome-200)' }}>Flesch-Kincaid grade level — higher = more complex sentences/words. 60-70 is &quot;plain English.&quot;</dd>
                </div>
                <div>
                  <dt className="font-semibold" style={{ color: 'var(--chrome-100)' }}>Sentence length</dt>
                  <dd style={{ color: 'var(--chrome-200)' }}>Histogram of words per sentence in 5-word bins. Varied lengths = better rhythm.</dd>
                </div>
                <div>
                  <dt className="font-semibold" style={{ color: 'var(--chrome-100)' }}>Adverbs (-ly)</dt>
                  <dd style={{ color: 'var(--chrome-200)' }}>Words ending in -ly. Catches false positives like <em>family</em>, <em>holy</em> — about ~5-10% noise.</dd>
                </div>
                <div>
                  <dt className="font-semibold" style={{ color: 'var(--chrome-100)' }}>Passive voice</dt>
                  <dd style={{ color: 'var(--chrome-200)' }}>&quot;To-be&quot; verb (was/were/is/are/etc.) followed by a past participle ending in -ed. Misses irregular participles (&quot;was given&quot;).</dd>
                </div>
                <div>
                  <dt className="font-semibold" style={{ color: 'var(--chrome-100)' }}>Clichés</dt>
                  <dd style={{ color: 'var(--chrome-200)' }}>Substring match against a curated list of ~30 common phrases. Click the info icon on the Clichés row to view the list.</dd>
                </div>
              </dl>
            </PopoverContent>
          </Popover>
          <button
            onClick={onClose}
            aria-label="Close writing analysis"
            className="transition-colors p-1 -mr-1 rounded hover:opacity-100"
            style={{ color: 'var(--wa-ink-muted)' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {editorText.trim().length === 0 ? (
        <EmptyState title="Nothing to analyze yet" body="Start writing to see analysis." />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {/* Readability */}
          <Section label="Readability">
            <div className="flex items-baseline gap-2.5">
              <span
                className="font-bold leading-none"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 44,
                  letterSpacing: '-0.025em',
                  color: 'var(--color-brand)',
                }}
              >
                {fk.score}
              </span>
              <span
                className="text-sm italic"
                style={{ fontFamily: 'var(--font-prose)', color: 'var(--wa-ink)' }}
              >
                {fk.label}
              </span>
            </div>
            <div
              className="relative h-2.5 rounded-full mt-2.5 overflow-hidden"
              style={{ background: 'var(--wa-bar-bg)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${fk.score}%`,
                  background:
                    'linear-gradient(90deg, oklch(from var(--color-brand) calc(l - 0.10) c h), var(--color-brand))',
                }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--wa-ink-muted)' }}>
              Flesch reading-ease · avg {avgLen} words/sentence
            </p>
          </Section>

          {/* Sentence-length distribution */}
          <Section label="Sentence length">
            <div className="flex items-end gap-1 h-20 mt-0.5 px-0.5">
              {hist.bins.map((n, i) => {
                const pct = (n / histMax) * 100
                const muted = n === 0
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${Math.max(4, pct)}%`,
                      background: muted
                        ? 'var(--wa-bar-bg)'
                        : 'linear-gradient(180deg, var(--color-brand), oklch(0.65 0.15 75))',
                      minHeight: 4,
                    }}
                    title={`${histLabels[i]} words: ${n} sentences`}
                  />
                )
              })}
            </div>
            <div
              className="flex gap-1 pt-1.5 font-mono text-[9px] tracking-wide"
              style={{ color: 'var(--wa-ink-muted)' }}
            >
              {histLabels.map(l => (
                <span key={l} className="flex-1 text-center">{l}</span>
              ))}
            </div>
          </Section>

          {/* Stats — adverbs / passive / clichés */}
          <Section label="Style flags">
            <div className="flex flex-col gap-2 mt-1">
              <StatRow value={adverbs.length} label="Adverbs (-ly)" />
              <StatRow value={passive.length} label="Passive voice" />
              <StatRow
                value={cliches.length}
                label="Clichés"
                trailing={
                  <button
                    onClick={() => setClichesListOpen(true)}
                    aria-label="View cliché list"
                    className="p-1 rounded transition-colors hover:opacity-100"
                    style={{ color: 'var(--wa-ink-muted)' }}
                  >
                    <Info size={12} />
                  </button>
                }
              />
            </div>
          </Section>

          {/* Adverbs list */}
          {adverbs.length > 0 && (
            <Section label={`Adverbs (${adverbs.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {adverbs.slice(0, 15).map((w, i) => (
                  <span
                    key={i}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: 'var(--wa-pill-bg)',
                      color: 'var(--color-brand)',
                    }}
                  >
                    {w}
                  </span>
                ))}
                {adverbs.length > 15 && (
                  <span className="text-xs" style={{ color: 'var(--wa-ink-muted)' }}>
                    +{adverbs.length - 15} more
                  </span>
                )}
              </div>
            </Section>
          )}

          {/* Passive voice samples */}
          {passive.length > 0 && (
            <Section label={`Passive voice (${passive.length})`}>
              <ul className="flex flex-col gap-1.5">
                {passive.map((s, i) => (
                  <li
                    key={i}
                    className="text-xs italic pl-2 line-clamp-2"
                    style={{
                      borderLeft: '2px solid oklch(from var(--color-brand) l c h / 0.4)',
                      color: 'var(--wa-ink)',
                      fontFamily: 'var(--font-prose)',
                    }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Clichés */}
          {cliches.length > 0 && (
            <Section label={`Clichés (${cliches.length})`}>
              <div className="flex flex-col gap-1">
                {cliches.map((c, i) => (
                  <span
                    key={i}
                    className="text-xs italic"
                    style={{ color: 'var(--wa-ink)', fontFamily: 'var(--font-prose)' }}
                  >
                    &ldquo;{c}&rdquo;
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Cliché list viewer — full list the app checks against. */}
      <Dialog open={clichesListOpen} onOpenChange={setClichesListOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>
              Cliché list
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">
            The app checks your prose against these {CLICHES.length} phrases (case-insensitive substring match). The list is curated, not exhaustive — meant as a nudge, not a rule.
          </p>
          <ul className="flex flex-col gap-1 overflow-y-auto pr-2 flex-1">
            {[...CLICHES].sort().map((c, i) => (
              <li
                key={i}
                className="text-sm italic"
                style={{ fontFamily: 'var(--font-prose)' }}
              >
                &ldquo;{c}&rdquo;
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
