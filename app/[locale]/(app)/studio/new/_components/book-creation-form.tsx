'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createBookAction } from '@/lib/actions/book.actions'
import { StepOne } from '../../_components/create-book-wizard/step-one'
import { StepTwo } from '../../_components/create-book-wizard/step-two'
import { StepThree, type BookTemplate } from '../../_components/create-book-wizard/step-three'
import { SharingControls, type Visibility } from '@/components/book/sharing-controls'

type Step = 1 | 2 | 3 | 4

type FormData = {
  title: string
  subtitle: string
  synopsis: string
  coverUrl: string | null
  genre: string
  subgenre: string
  tags: string[]
  targetAudience: string
  contentWarnings: string[]
  compTitles: string[]
  language: string
  templateId: string
  isSeriesBook: boolean
  seriesName: string
  seriesNumber: string
  publisherName: string
  trimSize: string
  edition: string
  visibility: Visibility
  discoverable: boolean
}

const initial: FormData = {
  title: '', subtitle: '', synopsis: '', coverUrl: null,
  genre: '', subgenre: '', tags: [], targetAudience: '',
  contentWarnings: [], compTitles: [''], language: 'English',
  templateId: '', isSeriesBook: false, seriesName: '',
  seriesNumber: '', publisherName: '', trimSize: '', edition: '',
  visibility: 'PRIVATE', discoverable: false,
}

const STEP_LABELS = ['The Basics', 'Discovery', 'Structure', 'Sharing'] as const
const STEP_HEADLINES = [
  'Let’s start with the basics.',
  'Help readers discover it.',
  'Shape the structure.',
  'Who can read it?',
] as const
const STEP_SUBHEADS = [
  'Every story begins with a title and a thread of an idea.',
  'Genre, tags, and audience — these help your book find its readers.',
  'Pick a template and add publishing details. You can change all of this later.',
  'Choose who sees this book. You can change this anytime from Book details.',
] as const

const TOTAL_STEPS = 4

type Props = {
  locale: string
  templates: BookTemplate[]
}

export function BookCreationForm({ locale, templates }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [form, setForm] = useState<FormData>(initial)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(fields: Partial<FormData>) {
    setForm(prev => ({ ...prev, ...fields }))
  }

  function goNext() {
    if (step === 1) {
      if (!form.title.trim()) { setTitleError('Title is required'); return }
      setTitleError(null)
    }
    setDirection('forward')
    setStep(s => Math.min(s + 1, TOTAL_STEPS) as Step)
  }

  function goBack() {
    setDirection('back')
    setStep(s => Math.max(s - 1, 1) as Step)
  }

  function jumpTo(target: Step) {
    setDirection(target > step ? 'forward' : 'back')
    setStep(target)
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await createBookAction({
        title: form.title.trim(),
        subtitle: form.subtitle || undefined,
        synopsis: form.synopsis || undefined,
        coverUrl: form.coverUrl,
        genre: form.genre || undefined,
        subgenre: form.subgenre || undefined,
        tags: form.tags.length ? form.tags : undefined,
        targetAudience: form.targetAudience || undefined,
        contentWarnings: form.contentWarnings.length ? form.contentWarnings : undefined,
        compTitles: form.compTitles.filter(Boolean).length ? form.compTitles.filter(Boolean) : undefined,
        language: form.language || undefined,
        templateId: form.templateId || undefined,
        seriesName: form.isSeriesBook && form.seriesName ? form.seriesName : undefined,
        seriesNumber: form.isSeriesBook && form.seriesNumber ? parseInt(form.seriesNumber, 10) : undefined,
        publisherName: form.publisherName || undefined,
        trimSize: form.trimSize || undefined,
        edition: form.edition || undefined,
        visibility: form.visibility,
        discoverable: form.discoverable,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      router.push(`/${locale}/studio/${result.data.bookId}`)
    } finally {
      setSubmitting(false)
    }
  }

  const animClass = direction === 'forward' ? 'step-enter-forward' : 'step-enter-back'

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: 'calc(100vh - 56px)',
        background: 'var(--canvas-dark-50, #141414)',
        color: 'var(--canvas-dark-ink-strong, #fff)',
      }}
    >
      {/* ── Top bar: progress + close ── */}
      <header
        className="flex items-center gap-6 px-6 sm:px-10"
        style={{
          height: '64px',
          borderBottom: '1px solid var(--canvas-dark-300, #2a2a2a)',
          background: 'var(--canvas-dark-100, #1a1a1a)',
        }}
      >
        <div className="flex-1 flex items-center justify-center gap-2">
          {([1, 2, 3, 4] as const).map((n, i) => {
            const reached = step >= n
            const current = step === n
            return (
              <div key={n} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    style={{
                      width: '36px',
                      height: '1px',
                      background: step > n - 1
                        ? 'var(--brand, #FFC300)'
                        : 'var(--canvas-dark-300, #2a2a2a)',
                      transition: 'background 0.25s',
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => reached && jumpTo(n)}
                  disabled={!reached}
                  aria-label={`Step ${n}: ${STEP_LABELS[n - 1]}`}
                  className="inline-flex items-center gap-2"
                  style={{
                    padding: '4px 10px 4px 6px',
                    borderRadius: '999px',
                    background: current ? 'var(--brand-soft, rgba(255,195,0,0.12))' : 'transparent',
                    border: '1px solid',
                    borderColor: current
                      ? 'oklch(0.85 0.18 90 / 0.35)'
                      : reached
                        ? 'var(--canvas-dark-300, #2a2a2a)'
                        : 'transparent',
                    cursor: reached ? 'pointer' : 'default',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '999px',
                      background: current
                        ? 'var(--brand, #FFC300)'
                        : step > n
                          ? 'rgba(255,195,0,0.18)'
                          : 'var(--canvas-dark-200, #1f1f1f)',
                      color: current
                        ? 'var(--brand-ink, #0a0a0a)'
                        : step > n
                          ? 'var(--brand, #FFC300)'
                          : 'var(--canvas-dark-ink-muted, #777)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '11px',
                    }}
                  >
                    {step > n ? '✓' : n}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: current
                        ? 'var(--brand, #FFC300)'
                        : reached
                          ? 'var(--canvas-dark-ink, #aaa)'
                          : 'var(--canvas-dark-ink-muted, #777)',
                    }}
                  >
                    {STEP_LABELS[n - 1]}
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        <Link
          href={`/${locale}/studio`}
          aria-label="Cancel and return to studio"
          className="inline-flex items-center justify-center"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '999px',
            border: '1px solid var(--canvas-dark-300, #2a2a2a)',
            color: 'var(--canvas-dark-ink-muted, #777)',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          <X size={16} />
        </Link>
      </header>

      {/* ── Step viewport ── */}
      <div className="flex-1 relative overflow-hidden">
        <div
          key={step}
          className={animClass}
          style={{
            position: 'absolute',
            inset: 0,
            overflowY: 'auto',
          }}
        >
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: '640px',
              padding: '56px 24px 96px',
            }}
          >
            <div style={{ marginBottom: '36px' }}>
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.18em',
                  color: 'var(--brand, #FFC300)',
                  marginBottom: '14px',
                }}
              >
                Step {step} of {TOTAL_STEPS}
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(28px, 4vw, 40px)',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.1,
                  margin: 0,
                  color: 'var(--canvas-dark-ink-strong, #fff)',
                  textWrap: 'balance' as const,
                }}
              >
                {STEP_HEADLINES[step - 1]}
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-prose)',
                  fontSize: '16px',
                  lineHeight: 1.55,
                  marginTop: '12px',
                  color: 'var(--canvas-dark-ink-muted, #999)',
                  textWrap: 'pretty' as const,
                }}
              >
                {STEP_SUBHEADS[step - 1]}
              </p>
            </div>

            <div
              style={{
                background: 'var(--canvas-dark-100, #1a1a1a)',
                border: '1px solid var(--canvas-dark-300, #2a2a2a)',
                borderRadius: '16px',
                padding: '28px',
              }}
            >
              {step === 1 && (
                <StepOne
                  title={form.title}
                  subtitle={form.subtitle}
                  synopsis={form.synopsis}
                  coverUrl={form.coverUrl}
                  onUpdate={update}
                  onNext={goNext}
                  onCancel={() => router.push(`/${locale}/studio`)}
                  titleError={titleError}
                />
              )}

              {step === 2 && (
                <StepTwo
                  genre={form.genre}
                  subgenre={form.subgenre}
                  tags={form.tags}
                  targetAudience={form.targetAudience}
                  contentWarnings={form.contentWarnings}
                  compTitles={form.compTitles}
                  language={form.language}
                  onUpdate={update}
                  onNext={goNext}
                  onBack={goBack}
                  onSkip={() => { setDirection('forward'); setStep(3) }}
                />
              )}

              {step === 3 && (
                <StepThree
                  templateId={form.templateId}
                  isSeriesBook={form.isSeriesBook}
                  seriesName={form.seriesName}
                  seriesNumber={form.seriesNumber}
                  publisherName={form.publisherName}
                  trimSize={form.trimSize}
                  edition={form.edition}
                  templates={templates}
                  onUpdate={update}
                  onBack={goBack}
                  onSkip={goNext}
                  onNext={goNext}
                  error={error}
                />
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <SharingControls
                    visibility={form.visibility}
                    discoverable={form.discoverable}
                    onChange={({ visibility, discoverable }) => {
                      const patch: Partial<FormData> = {}
                      if (visibility !== undefined) {
                        patch.visibility = visibility
                        if (visibility !== 'PUBLIC') patch.discoverable = false
                      }
                      if (discoverable !== undefined) patch.discoverable = discoverable
                      update(patch)
                    }}
                  />

                  {error && (
                    <p className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                      {error === 'FREE_LIMIT_REACHED'
                        ? "You've reached the free plan limit of 3 books. Upgrade to create more."
                        : error}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={goBack} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">← Back</button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={submit}
                        disabled={submitting}
                        className="bg-brand text-[#0a0a0a] font-bold font-comfortaa rounded-full px-6 py-2.5 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-hover hover:-translate-y-px transition-all"
                      >
                        {submitting ? 'Creating…' : 'Create Book'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer reassurance — every field here is editable later from
                the book's Book details page (settings cog in the binder). */}
            <p
              className="text-center"
              style={{
                marginTop: 20,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'var(--canvas-dark-ink-muted, #777)',
              }}
            >
              You can edit everything here later from Book details (⚙ in the binder).
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes stepEnterForward {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes stepEnterBack {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .step-enter-forward { animation: stepEnterForward 320ms cubic-bezier(0.22, 0.61, 0.36, 1); }
        .step-enter-back    { animation: stepEnterBack    320ms cubic-bezier(0.22, 0.61, 0.36, 1); }
        @media (prefers-reduced-motion: reduce) {
          .step-enter-forward, .step-enter-back { animation: none; }
        }
      `}</style>
    </div>
  )
}
