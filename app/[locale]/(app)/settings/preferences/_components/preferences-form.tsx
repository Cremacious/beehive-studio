'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updatePreferencesAction } from '@/lib/actions/settings.actions'
import { GENRES, GENRE_LABEL, type GenreSlug } from '@/lib/discover/genres'

interface PreferencesFormProps {
  defaultBookVisibility: string
  defaultGenre: string | null
  defaultSparkWordLimit: string | null
  genreInterests: string[]
}

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Private', description: 'Only you can see new books by default.' },
  { value: 'FRIENDS', label: 'Friends', description: 'New books are visible to friends by default.' },
  { value: 'PUBLIC', label: 'Public', description: 'New books are visible to everyone by default.' },
] as const

const WORD_LIMIT_OPTIONS = [
  { value: '', label: 'No default' },
  { value: '500', label: '500 words' },
  { value: '1000', label: '1,000 words' },
  { value: '2000', label: '2,000 words' },
  { value: '5000', label: '5,000 words' },
]

export function PreferencesForm({
  defaultBookVisibility,
  defaultGenre,
  defaultSparkWordLimit,
  genreInterests,
}: PreferencesFormProps) {
  const [isPending, startTransition] = useTransition()

  const [visibility, setVisibility] = useState(defaultBookVisibility)
  const [genre, setGenre] = useState(defaultGenre ?? '')
  const [wordLimit, setWordLimit] = useState(defaultSparkWordLimit ?? '')
  const [interests, setInterests] = useState<Set<string>>(new Set(genreInterests))

  function toggleInterest(slug: string) {
    setInterests((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updatePreferencesAction({
        defaultBookVisibility: visibility as 'PUBLIC' | 'FRIENDS' | 'PRIVATE',
        defaultGenre: genre || null,
        defaultSparkWordLimit: wordLimit || null,
        genreInterests: Array.from(interests),
      })
      if (!result.success) {
        toast.error(result.error ?? 'Could not save preferences.')
        return
      }
      toast.success('Preferences saved.')
    })
  }

  const inputStyle = {
    background: 'var(--canvas-dark-100)',
    boxShadow: 'var(--sh-inset)',
    color: 'var(--canvas-dark-ink-strong)',
    borderRadius: 'var(--r-row)',
  } as const

  const labelStyle = {
    color: 'var(--canvas-dark-ink-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-8">
      {/* Writing defaults */}
      <section
        className="rounded-[20px] p-6"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
        }}
      >
        <h2
          className="font-bold text-[15px] mb-5"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
        >
          Writing defaults
        </h2>

        <div className="flex flex-col gap-5">
          {/* Default book visibility */}
          <div>
            <div className="mb-2" style={labelStyle}>
              Default book visibility
            </div>
            <div className="flex flex-col gap-2">
              {VISIBILITY_OPTIONS.map(({ value, label, description }) => (
                <label
                  key={value}
                  className="flex items-start gap-3 py-3 px-4 rounded-[14px] cursor-pointer transition-all"
                  style={{
                    background:
                      visibility === value
                        ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                        : 'transparent',
                    boxShadow: visibility === value ? 'var(--sh-tile)' : 'none',
                    border: visibility === value ? '1px solid var(--brand)' : '1px solid oklch(1 0 0 / 0.06)',
                    borderRadius: '14px',
                  }}
                >
                  <input
                    type="radio"
                    name="defaultBookVisibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    className="mt-0.5 accent-[var(--brand)]"
                  />
                  <div>
                    <div
                      className="text-[13px] font-semibold"
                      style={{
                        color: visibility === value ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {label}
                    </div>
                    <div className="text-[12px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                      {description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Default genre + Spark word limit row */}
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="defaultGenre" style={labelStyle}>
                Default genre for new books
              </label>
              <select
                id="defaultGenre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                disabled={isPending}
                className="px-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 cursor-pointer appearance-none"
                style={inputStyle}
              >
                <option value="">No default</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {GENRE_LABEL[g]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="wordLimit" style={labelStyle}>
                Default spark word limit
              </label>
              <select
                id="wordLimit"
                value={wordLimit}
                onChange={(e) => setWordLimit(e.target.value)}
                disabled={isPending}
                className="px-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 cursor-pointer appearance-none"
                style={inputStyle}
              >
                {WORD_LIMIT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Genre interests */}
      <section
        className="rounded-[20px] p-6"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
        }}
      >
        <h2
          className="font-bold text-[15px] mb-1"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
        >
          Genre interests
        </h2>
        <p className="text-[12.5px] mb-5" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Select the genres you enjoy. This shapes your For You recommendations.
        </p>
        <div className="flex flex-wrap gap-2">
          {(GENRES as readonly string[]).map((slug) => {
            const isSelected = interests.has(slug)
            return (
              <button
                key={slug}
                type="button"
                onClick={() => toggleInterest(slug)}
                className="px-3.5 py-1.5 text-[13px] font-medium rounded-[999px] transition-all"
                style={
                  isSelected
                    ? {
                        background: 'var(--brand)',
                        color: 'var(--brand-ink)',
                        fontFamily: 'var(--font-display)',
                      }
                    : {
                        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                        boxShadow: 'var(--sh-tile)',
                        color: 'var(--canvas-dark-ink)',
                        fontFamily: 'var(--font-display)',
                      }
                }
              >
                {GENRE_LABEL[slug as GenreSlug]}
              </button>
            )
          })}
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end max-md:justify-stretch">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 text-[13px] font-semibold rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-px disabled:transform-none max-md:w-full"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {isPending ? 'Saving...' : 'Save preferences'}
        </button>
      </div>
    </form>
  )
}
