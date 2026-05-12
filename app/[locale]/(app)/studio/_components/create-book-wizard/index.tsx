'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBookAction } from '@/lib/actions/book.actions'
import { WizardProgress } from './wizard-progress'
import { StepOne } from './step-one'
import { StepTwo } from './step-two'
import { StepThree, type BookTemplate } from './step-three'

type Step = 1 | 2 | 3

type FormData = {
  // Step 1
  title: string
  subtitle: string
  synopsis: string
  coverUrl: string | null
  // Step 2
  genre: string
  subgenre: string
  tags: string[]
  targetAudience: string
  contentWarnings: string[]
  compTitles: string[]
  language: string
  // Step 3
  templateId: string
  isSeriesBook: boolean
  seriesName: string
  seriesNumber: string
  publisherName: string
  trimSize: string
  edition: string
}

const initial: FormData = {
  title: '', subtitle: '', synopsis: '', coverUrl: null,
  genre: '', subgenre: '', tags: [], targetAudience: '',
  contentWarnings: [], compTitles: [''], language: 'English',
  templateId: '', isSeriesBook: false, seriesName: '',
  seriesNumber: '', publisherName: '', trimSize: '', edition: '',
}

type Props = {
  locale: string
  templates: BookTemplate[]
  onClose: () => void
}

export function CreateBookWizard({ locale, templates, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
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
    setStep(s => Math.min(s + 1, 3) as Step)
  }

  function goBack() {
    setStep(s => Math.max(s - 1, 1) as Step)
  }

  async function submit() {
    setSubmitting(true)
    setError(null)

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
    })

    if (!result.success) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    router.push(`/${locale}/studio/${result.data.bookId}`)
  }

  return (
    <div className="p-6 sm:p-8">
      <WizardProgress step={step} />

      {step === 1 && (
        <StepOne
          title={form.title}
          subtitle={form.subtitle}
          synopsis={form.synopsis}
          coverUrl={form.coverUrl}
          onUpdate={update}
          onNext={goNext}
          onCancel={onClose}
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
          onSkip={() => setStep(3)}
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
          onSkip={submit}
          onSubmit={submit}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  )
}
