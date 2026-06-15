'use client'
import { useState, useTransition } from 'react'
import { submitSparkEntryAction } from '@/lib/actions/sparks.actions'
import { useRouter } from 'next/navigation'

type Props = { sparkId: string; wordLimit: number | null }

export function SparkSubmitPanel({ sparkId, wordLimit }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const overLimit = wordLimit !== null && wordCount > wordLimit

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await submitSparkEntryAction(sparkId, content, title.trim() || null)
      if (result.success) {
        setTitle('')
        setContent('')
        router.refresh()
      } else {
        const msgs: Record<string, string> = {
          ALREADY_SUBMITTED: 'You already have an entry in this Spark.',
          SPARK_NOT_OPEN: 'This Spark is no longer accepting entries.',
          WORD_LIMIT_EXCEEDED: `Entry exceeds the ${wordLimit}-word limit.`,
          NOT_ALLOWED: "You don't have permission to enter this Spark.",
          NOT_FOUND: 'This Spark no longer exists.',
          INVALID_INPUT: 'Please check your entry and try again.',
        }
        setError(msgs[result.error] ?? `Failed to submit (${result.error}). Try again.`)
      }
    })
  }

  const inputStyle = {
    background: '#1E1E1E',
    boxShadow: 'var(--sh-inset)',
    color: 'var(--canvas-dark-ink)',
  } as const

  const labelStyle = { color: 'var(--canvas-dark-ink-muted)' } as const

  return (
    <div style={{ padding: '20px 22px' }}>
      <p
        className="text-[10px] font-mono uppercase tracking-[0.14em]"
        style={{ ...labelStyle, marginBottom: 14 }}
      >
        Your Entry
      </p>

      <div className="flex flex-col gap-2 mb-4">
        <label
          htmlFor="spark-title"
          className="text-[10px] font-mono uppercase tracking-[0.14em]"
          style={labelStyle}
        >
          Title
          <span
            className="ml-2 normal-case tracking-normal"
            style={{ color: 'var(--canvas-dark-ink-faint)' }}
          >
            optional
          </span>
        </label>
        <input
          id="spark-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Leave blank to derive from your first line."
          className="w-full h-10 px-3.5 rounded-[var(--r-row)] text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
          style={inputStyle}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="spark-content"
          className="text-[10px] font-mono uppercase tracking-[0.14em]"
          style={labelStyle}
        >
          Response <span style={{ color: 'var(--brand)' }}>*</span>
        </label>
        <textarea
          id="spark-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your response…"
          rows={5}
          className="w-full px-3.5 py-2.5 rounded-[var(--r-row)] text-[14px] resize-y outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
          style={{ ...inputStyle, lineHeight: 1.5, minHeight: '120px' }}
        />
      </div>

      <div className="flex items-center justify-between mt-3">
        <span
          className="text-[11px]"
          style={{
            color: overLimit ? 'var(--status-error)' : 'rgb(255 255 255 / 0.65)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {wordCount} words{wordLimit ? ` / ${wordLimit} limit` : ''}
        </span>
        <div className="flex items-center gap-2">
          {error && (
            <span
              className="text-[11px]"
              style={{ color: 'var(--status-error)' }}
            >
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !content.trim() || overLimit}
            className="inline-flex items-center justify-center h-9 px-5 rounded-[var(--r-pill)] text-[13px] font-semibold disabled:opacity-40 cursor-pointer"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {isPending ? 'Submitting…' : 'Submit Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
