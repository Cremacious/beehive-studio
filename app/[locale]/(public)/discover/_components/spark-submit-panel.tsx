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
        }
        setError(msgs[result.error] ?? 'Failed to submit. Try again.')
      }
    })
  }

  return (
    <div className="px-6 py-4 bg-[#181818] border-b border-[#2a2a2a]">
      <p className="text-[#555] text-[11px] uppercase tracking-wider mb-2">Your Entry</p>
      <div className="mb-2">
        <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
          Title <span className="lowercase normal-case">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Leave blank to derive from your first line."
          className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#ccc] text-[13px] focus:outline-none focus:border-[#3a3a3a]"
          style={{ boxShadow: 'var(--sh-inset)' }}
        />
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write your response…"
        rows={4}
        className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#ccc] text-[13px] leading-relaxed resize-vertical focus:outline-none focus:border-[#3a3a3a]"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-[11px] ${overLimit ? 'text-red-400' : 'text-[#555]'}`}>
          {wordCount} words{wordLimit ? ` / ${wordLimit} limit` : ''}
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-red-400 text-[11px]">{error}</span>}
          <button
            onClick={submit}
            disabled={isPending || !content.trim() || overLimit}
            className="px-4 py-1.5 bg-[#FFC300] text-black font-bold text-[12px] rounded-md disabled:opacity-40 cursor-pointer"
          >
            {isPending ? 'Submitting…' : 'Submit Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
