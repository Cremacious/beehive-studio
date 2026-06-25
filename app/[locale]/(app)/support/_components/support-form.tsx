'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { submitSupportMessageAction } from '@/lib/actions/support.actions'

interface SupportFormProps {
  userEmail?: string | null
}

const CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'technical', label: 'Technical support' },
  { value: 'feedback', label: 'Feedback or suggestion' },
] as const

export function SupportForm({ userEmail }: SupportFormProps) {
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    email: userEmail ?? '',
    category: 'general' as 'general' | 'technical' | 'feedback',
    subject: '',
    message: '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await submitSupportMessageAction(form)
      if (result.success) {
        setSubmitted(true)
      } else {
        toast.error(result.error ?? 'Something went wrong. Please try again.')
      }
    })
  }

  if (submitted) {
    return (
      <div
        className="rounded-[var(--r-card)] p-8 text-center"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
      >
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
          style={{ background: 'oklch(from var(--brand) l c h / 0.12)', color: 'var(--brand)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3
          className="text-lg font-bold mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--brand)' }}
        >
          Message sent
        </h3>
        <p style={{ color: 'var(--canvas-dark-ink-muted)' }} className="text-sm">
          We received your message and will get back to you at{' '}
          <span style={{ color: 'var(--canvas-dark-ink)' }}>{form.email}</span>.
        </p>
      </div>
    )
  }

  const inputStyle = {
    background: 'var(--canvas-dark-100)',
    color: 'var(--canvas-dark-ink)',
    border: '1px solid oklch(from var(--canvas-dark-ink) l c h / 0.08)',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-inset)',
    outline: 'none',
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
  }

  return (
    <div
      className="rounded-[var(--r-card)] p-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
    >
      <h2
        className="text-base font-bold mb-5"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--brand)' }}
      >
        Contact us
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!userEmail && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              Your email
            </label>
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              style={inputStyle}
              disabled={isPending}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Category
          </label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            style={{ ...inputStyle, cursor: 'pointer' }}
            disabled={isPending}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Subject
          </label>
          <input
            type="text"
            name="subject"
            required
            minLength={3}
            maxLength={200}
            value={form.subject}
            onChange={handleChange}
            placeholder="Brief summary of your question"
            style={inputStyle}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Message
          </label>
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={form.message}
            onChange={handleChange}
            placeholder="Describe your issue or question in detail..."
            style={{ ...inputStyle, resize: 'vertical' }}
            disabled={isPending}
          />
          <span className="text-[11px] text-right" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            {form.message.length} / 5000
          </span>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="self-end px-6 py-2.5 rounded-[var(--r-pill)] text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {isPending ? 'Sending...' : 'Send message'}
        </button>
      </form>
    </div>
  )
}
