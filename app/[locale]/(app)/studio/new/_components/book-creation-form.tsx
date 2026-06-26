'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { createBookAction } from '@/lib/actions/book.actions'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { StepOne } from '../../_components/create-book-wizard/step-one'
import { StepTwo } from '../../_components/create-book-wizard/step-two'
import { StepThree, type BookTemplate } from '../../_components/create-book-wizard/step-three'
import { StepHeader } from '../../_components/create-book-wizard/step-header'
import { WizardFooter } from '../../_components/create-book-wizard/wizard-field'
import { SharingControls, type Visibility } from '@/components/book/sharing-controls'
import { CreationPathLanding } from './creation-path-landing'
import { ImportWizardPanel } from './import-wizard-panel'
import { UpgradeModal } from '@/components/upgrade/upgrade-modal'
import type { ImportedChapter } from '@/lib/import/types'

type Step = 1 | 2 | 3 | 4

type FormData = {
  title: string
  subtitle: string
  synopsis: string
  coverUrl: string | null
  coverFile: File | null
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
  title: '', subtitle: '', synopsis: '', coverUrl: null, coverFile: null,
  genre: '', subgenre: '', tags: [], targetAudience: '',
  contentWarnings: [], compTitles: [''], language: 'English',
  templateId: '', isSeriesBook: false, seriesName: '',
  seriesNumber: '', publisherName: '', trimSize: '', edition: '',
  visibility: 'PRIVATE', discoverable: false,
}

const STEP_LABELS = ['Basics', 'Discovery', 'Structure', 'Sharing'] as const
const REASSURE = { color: 'var(--canvas-dark-ink-strong)', fontWeight: 600 } as const
const STEP_HEADLINES = [
  "Let's start with the basics.",
  'How will readers find this book?',
  'Pick a starting structure.',
  'Who should see this book?',
] as const
const STEP_LEDES: ReactNode[] = [
  <>A few quick details so we can set up your book. <strong style={REASSURE}>You can change any of this later.</strong></>,
  <>Tags and comp titles help readers discover your book on /discover. You can come back to any of this whenever.</>,
  <>We&apos;ll create the binder for you. <strong style={REASSURE}>You can rearrange or rename anything later.</strong></>,
  <>Most writers start private and switch later. Pick what feels right today.</>,
]

const TOTAL_STEPS = 4

type Props = {
  locale: string
  templates: BookTemplate[]
  isPremium: boolean
}

type Path = 'choose' | 'import' | 'scratch'

export function BookCreationForm({ locale, templates, isPremium }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const withHive = searchParams.get('withHive') === '1'
  // Entry path: the landing choice (scratch vs import) shows first. Starting
  // "with a hive" jumps straight into the scratch wizard.
  const [path, setPath] = useState<Path>(withHive ? 'scratch' : 'choose')
  const [importedChapters, setImportedChapters] = useState<ImportedChapter[]>([])
  const [step, setStep] = useState<Step>(1)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  // Scroll back to the top of the page on every step OR path change so the
  // user doesn't land mid-page (e.g. landing -> scratch keeps step=1, and the
  // first field's autofocus would otherwise pull the view down). Runs after
  // the focus commit so the top wins. Smooth scroll respects
  // prefers-reduced-motion automatically in modern browsers.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step, path])
  const [form, setForm] = useState<FormData>(initial)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookLimitOpen, setBookLimitOpen] = useState(false)
  const { upload: uploadCover } = useCloudinaryUpload('covers')

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
      // Deferred cover upload: if the user picked a file during the wizard,
      // upload it to Cloudinary now (just-in-time). If they pasted a URL,
      // use it as-is. If neither, ship null.
      let finalCoverUrl: string | null = form.coverUrl
      if (form.coverFile) {
        const result = await uploadCover(form.coverFile)
        if (!result.url) {
          toast.error(`Cover upload failed: ${result.error}`)
          setError(`Cover upload failed: ${result.error}`)
          return
        }
        finalCoverUrl = result.url
      }

      const result = await createBookAction({
        title: form.title.trim(),
        subtitle: form.subtitle || undefined,
        synopsis: form.synopsis || undefined,
        coverUrl: finalCoverUrl,
        genre: form.genre || undefined,
        subgenre: form.subgenre || undefined,
        tags: form.tags.length ? form.tags : undefined,
        targetAudience: form.targetAudience || undefined,
        contentWarnings: form.contentWarnings.length ? form.contentWarnings : undefined,
        compTitles: form.compTitles.filter(Boolean).length ? form.compTitles.filter(Boolean) : undefined,
        language: form.language || undefined,
        // Imported chapters seed the binder directly, so skip any template
        // structure to avoid colliding chapter orders.
        templateId: importedChapters.length > 0 ? undefined : form.templateId || undefined,
        seriesName: form.isSeriesBook && form.seriesName ? form.seriesName : undefined,
        seriesNumber: form.isSeriesBook && form.seriesNumber ? parseInt(form.seriesNumber, 10) : undefined,
        publisherName: form.publisherName || undefined,
        trimSize: form.trimSize || undefined,
        edition: form.edition || undefined,
        visibility: form.visibility,
        discoverable: form.discoverable,
        importedChapters: importedChapters.length > 0 ? importedChapters : undefined,
      })

      if (!result.success) {
        if (result.error === 'FREE_LIMIT_REACHED') {
          setBookLimitOpen(true)
          return
        }
        setError(result.error)
        return
      }

      if (withHive) {
        router.push(`/${locale}/studio?createHive=${result.data.bookId}`)
      } else {
        router.push(`/${locale}/studio/${result.data.bookId}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const animClass = direction === 'forward' ? 'step-enter-forward' : 'step-enter-back'

  if (path === 'choose') {
    return (
      <CreationPathLanding
        locale={locale}
        isPremium={isPremium}
        onPickScratch={() => setPath('scratch')}
        onPickImport={() => setPath('import')}
      />
    )
  }

  if (path === 'import') {
    return (
      <ImportWizardPanel
        locale={locale}
        isPremium={isPremium}
        onBack={() => setPath('choose')}
        onConfirm={(chapters, detectedTitle) => {
          setImportedChapters(chapters)
          // Pre-fill the title from the detected title (or filename) so the
          // user lands in Basics with a sensible starting point (Option B).
          if (detectedTitle && !form.title.trim()) update({ title: detectedTitle })
          setPath('scratch')
          setStep(1)
        }}
      />
    )
  }

  return (
    <div
      className="wizard-root min-h-screen w-full flex flex-col"
      style={{
        background: 'transparent',
        color: 'var(--canvas-dark-ink-strong, #fff)',
        padding: '28px',
      }}
    >
      <div
        className="wizard-card mx-auto w-full flex flex-col"
        style={{
          maxWidth: '1040px',
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
      >
        {/* ── Progress bar ── */}
        <div
          className="flex items-center gap-2 px-6 py-[18px] max-md:px-3 max-md:gap-1"
          style={{ borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}
        >
          {([1, 2, 3, 4] as const).map((n, i) => {
            const isActive = step === n
            const isDone = step > n
            const isReached = step >= n
            return (
              <div key={n} className="flex items-center gap-2 flex-1">
                {i > 0 && (
                  <div
                    style={{
                      height: '1px',
                      flex: 1,
                      background: isReached ? 'var(--brand)' : 'oklch(1 0 0 / 0.06)',
                      transition: 'background 0.25s',
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => isReached && jumpTo(n)}
                  disabled={!isReached}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${n}: ${STEP_LABELS[n - 1]}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 max-md:px-1.5 max-md:gap-0"
                  style={{
                    borderRadius: 'var(--r-pill)',
                    background: isActive || isDone
                      ? 'var(--brand)'
                      : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    color: isActive || isDone
                      ? 'var(--brand-ink)'
                      : 'var(--canvas-dark-ink-muted)',
                    boxShadow: isActive || isDone ? 'none' : 'var(--sh-tile)',
                    cursor: isReached ? 'pointer' : 'default',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: 'var(--r-pill)',
                      background: isActive || isDone
                        ? 'var(--brand-ink)'
                        : 'var(--canvas-dark-100)',
                      color: isActive || isDone ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '10px',
                    }}
                  >
                    {isDone ? <Check size={11} strokeWidth={3} /> : n}
                  </span>
                  <span
                    className="max-md:hidden"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {STEP_LABELS[n - 1]}
                  </span>
                </button>
              </div>
            )
          })}

          <Link
            href={`/${locale}/studio`}
            aria-label="Cancel and return to studio"
            className="inline-flex items-center justify-center ml-3 shrink-0 max-md:ml-1"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--r-pill)',
              boxShadow: 'var(--sh-tile)',
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            <X size={14} />
          </Link>
        </div>

        {/* ── Step viewport ── */}
        <div className="flex-1 relative overflow-hidden">
          <div
            key={step}
            className={animClass}
            style={{
              position: 'relative',
              overflowY: 'auto',
            }}
          >
            <div
              className="wizard-step-pad mx-auto w-full"
              style={{
                maxWidth: '880px',
                padding: '26px 36px 18px',
              }}
            >
              <div style={{ marginBottom: '36px' }}>
                <StepHeader
                  step={step}
                  total={TOTAL_STEPS}
                  headline={STEP_HEADLINES[step - 1]}
                  lede={STEP_LEDES[step - 1]}
                />
              </div>

              {importedChapters.length > 0 && (
                <div
                  className="flex items-center gap-2.5 mb-6"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--r-row)',
                    background: 'var(--brand-soft)',
                    border: '1px solid oklch(0.85 0.18 90 / 0.4)',
                    fontSize: 12.5,
                    color: 'var(--canvas-dark-ink)',
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: 'var(--font-display)' }}>
                    {importedChapters.length} {importedChapters.length === 1 ? 'chapter' : 'chapters'} ready to import
                  </span>
                  <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    They&apos;ll be added when you create the book.
                  </span>
                </div>
              )}

              {step === 1 && (
                <StepOne
                  title={form.title}
                  subtitle={form.subtitle}
                  synopsis={form.synopsis}
                  coverUrl={form.coverUrl}
                  coverFile={form.coverFile}
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
                    <p
                      style={{
                        fontSize: 13,
                        color: 'oklch(0.72 0.21 25)',
                        background: 'oklch(0.62 0.21 25 / 0.10)',
                        border: '1px solid oklch(0.62 0.21 25 / 0.25)',
                        borderRadius: 'var(--r-row)',
                        padding: '12px 16px',
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <WizardFooter
                    onBack={goBack}
                    onNext={submit}
                    nextLabel="Create your book"
                    submitting={submitting}
                  />
                </div>
              )}

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
      </div>

      <UpgradeModal
        feature="book-limit"
        locale={locale}
        isAuthed
        open={bookLimitOpen}
        onOpenChange={setBookLimitOpen}
      />

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
        .back-link {
          font-size: 13px;
          color: var(--canvas-dark-ink-muted);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 150ms ease;
        }
        .back-link:hover { color: var(--canvas-dark-ink-strong); }
        @keyframes wizardSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
