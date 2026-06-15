'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSparkAction } from '@/lib/actions/sparks.actions'
import { TITLE_MAX, PROMPT_MAX } from '@/lib/validations/spark'
import { GENRES, GENRE_LABEL } from '@/lib/discover/genres'

const WORD_LIMIT_PRESETS = [300, 1000, 2500] as const
const VOTING_DURATION_OPTIONS = [
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours (default)' },
  { value: 72, label: '72 hours' },
  { value: 168, label: '7 days' },
] as const

// Returns a Date 7 days out at 23:59 in local time, formatted for datetime-local input.
function defaultDeadlineString(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Props = {
  locale: string
}

export function CreateSparkForm({ locale }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [description, setDescription] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [rules, setRules] = useState('')
  const [wordLimitMode, setWordLimitMode] = useState<'preset' | 'custom' | 'none'>('preset')
  const [wordLimitPreset, setWordLimitPreset] = useState<number>(1000)
  const [wordLimitCustom, setWordLimitCustom] = useState<string>('')
  const [deadline, setDeadline] = useState(defaultDeadlineString())
  const [votingDurationHours, setVotingDurationHours] = useState<number>(48)
  const [genre, setGenre] = useState<string>('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>('PUBLIC')
  const [discoverable, setDiscoverable] = useState(true)

  function resolveWordLimit(): number | null {
    if (wordLimitMode === 'none') return null
    if (wordLimitMode === 'custom') {
      const n = parseInt(wordLimitCustom, 10)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return wordLimitPreset
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createSparkAction({
        title: title.trim(),
        prompt: prompt.trim(),
        description: description.trim() || undefined,
        rules: rules.trim() || undefined,
        wordLimit: resolveWordLimit() ?? undefined,
        genre: genre || undefined,
        deadline: new Date(deadline),
        visibility,
        discoverable: visibility === 'PUBLIC' ? discoverable : false,
        votingDurationHours,
      })
      if (result.success) {
        toast.success('Spark created!')
        router.push(`/${locale}/sparks/${result.data.id}`)
      } else {
        toast.error(
          result.error === 'INVALID_INPUT'
            ? 'Please fix the highlighted fields.'
            : result.error === 'FREE_LIMIT_REACHED'
            ? "You've hit the free-tier Spark limit."
            : `Something went wrong (${result.error}).`,
        )
      }
    })
  }

  const titleCount = title.length
  const titleColor =
    titleCount > TITLE_MAX
      ? 'text-red-400'
      : titleCount >= 50
      ? 'text-yellow-400'
      : 'text-[var(--canvas-dark-ink-muted)]'

  const promptCount = prompt.length
  const promptColor =
    promptCount > PROMPT_MAX
      ? 'text-red-400'
      : promptCount >= 400
      ? 'text-yellow-400'
      : 'text-[var(--canvas-dark-ink-muted)]'

  const canSubmit =
    title.trim().length >= 3 &&
    title.trim().length <= TITLE_MAX &&
    prompt.trim().length >= 10 &&
    prompt.trim().length <= PROMPT_MAX &&
    deadline.length > 0 &&
    !pending

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl p-6"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="title" className="text-[11px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Title
          </label>
          <span className={`text-[10px] font-mono ${titleColor}`}>
            {titleCount} / {TITLE_MAX}
          </span>
        </div>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX + 10}
          required
          placeholder='Short, catchy. "Kingdom Heist"'
          className="w-full px-3 py-2 text-[14px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          style={{
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink-strong)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        />
      </div>

      {/* Prompt */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="prompt" className="text-[11px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Prompt
          </label>
          <span className={`text-[10px] font-mono ${promptColor}`}>
            {promptCount} / {PROMPT_MAX}
          </span>
        </div>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          required
          placeholder="The actual writing challenge. Be specific."
          className="w-full px-3 py-2 text-[14px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          style={{
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink-strong)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            fontFamily: 'var(--font-prose)',
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Description (optional) */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-[11px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Context (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Extra context, inspiration, examples, why you made this."
          className="w-full px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          style={{
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            fontFamily: 'var(--font-prose)',
          }}
        />
      </div>

      {/* Rules (expander) */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          className="text-[11px] uppercase tracking-[0.08em] font-bold hover:text-[var(--brand)] transition-colors"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {rulesOpen ? '− Hide rules' : '+ Add rules (optional)'}
        </button>
        {rulesOpen ? (
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={2}
            placeholder="Word limit format, forbidden tropes, etc."
            className="w-full px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            style={{
              background: 'var(--canvas-dark-100)',
              color: 'var(--canvas-dark-ink)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              fontFamily: 'var(--font-prose)',
            }}
          />
        ) : null}
      </div>

      {/* Word limit + Deadline + Genre — three-column row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Word limit */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Word limit
          </label>
          <select
            value={wordLimitMode === 'none' ? 'none' : wordLimitMode === 'custom' ? 'custom' : String(wordLimitPreset)}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'none') setWordLimitMode('none')
              else if (v === 'custom') setWordLimitMode('custom')
              else {
                setWordLimitMode('preset')
                setWordLimitPreset(parseInt(v, 10))
              }
            }}
            className="w-full h-9 px-2 text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            style={{
              background: 'var(--canvas-dark-100)',
              color: 'var(--canvas-dark-ink)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <option value="none">No limit</option>
            {WORD_LIMIT_PRESETS.map((n) => (
              <option key={n} value={n}>{n} words</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {wordLimitMode === 'custom' ? (
            <input
              type="number"
              min={1}
              value={wordLimitCustom}
              onChange={(e) => setWordLimitCustom(e.target.value)}
              placeholder="e.g. 1500"
              className="w-full h-9 px-2 text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              style={{
                background: 'var(--canvas-dark-100)',
                color: 'var(--canvas-dark-ink)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            />
          ) : null}
        </div>

        {/* Deadline */}
        <div className="space-y-1.5">
          <label htmlFor="deadline" className="text-[11px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Deadline
          </label>
          <input
            id="deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
            className="w-full h-9 px-2 text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            style={{
              background: 'var(--canvas-dark-100)',
              color: 'var(--canvas-dark-ink)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          />
        </div>

        {/* Genre */}
        <div className="space-y-1.5">
          <label htmlFor="genre" className="text-[11px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Genre
          </label>
          <select
            id="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full h-9 px-2 text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            style={{
              background: 'var(--canvas-dark-100)',
              color: 'var(--canvas-dark-ink)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <option value="">Any genre</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{GENRE_LABEL[g]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Voting duration */}
      <div className="space-y-1.5">
        <label htmlFor="voting-duration" className="text-[11px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Voting window (after deadline)
        </label>
        <select
          id="voting-duration"
          value={votingDurationHours}
          onChange={(e) => setVotingDurationHours(parseInt(e.target.value, 10))}
          className="w-full h-9 px-2 text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          style={{
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {VOTING_DURATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Visibility */}
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Visibility
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['PUBLIC', 'FRIENDS', 'PRIVATE'] as const).map((v) => {
            const active = visibility === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVisibility(v)
                  if (v !== 'PUBLIC') setDiscoverable(false)
                }}
                className="px-3 py-2 text-[11px] rounded-lg transition-colors"
                style={{
                  background: active ? 'var(--brand)' : 'var(--canvas-dark-100)',
                  color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
                  border: active ? '1px solid var(--brand)' : '1px solid rgba(255, 255, 255, 0.05)',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {v[0] + v.slice(1).toLowerCase()}
              </button>
            )
          })}
        </div>
        {visibility === 'PUBLIC' ? (
          <label className="flex items-center gap-2 text-[12px] mt-2">
            <input
              type="checkbox"
              checked={discoverable}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="accent-[var(--brand)] h-3 w-3"
            />
            <span style={{ color: 'var(--canvas-dark-ink)' }}>
              Show in Discover (otherwise it&apos;s only accessible by direct link)
            </span>
          </label>
        ) : null}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="px-4 py-2 text-[12px] rounded-lg transition-colors"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            background: 'transparent',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-5 py-2 text-[12px] font-bold rounded-lg transition-opacity"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            opacity: canSubmit ? 1 : 0.4,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {pending ? 'Sparking…' : 'Spark it →'}
        </button>
      </div>
    </form>
  )
}
