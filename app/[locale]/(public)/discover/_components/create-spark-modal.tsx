'use client'
import { useState, useEffect, useTransition } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { createSparkAction } from '@/lib/actions/sparks.actions'
import { useRouter } from 'next/navigation'
import {
  VisibilityPicker,
  PUBLIC_FRIENDS_PRIVATE_OPTIONS,
} from '@/components/visibility-picker'
import type { SparkVisibility } from '@/db/schema/social'

export function CreateSparkModal({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [deadline, setDeadline] = useState('')
  const [wordLimit, setWordLimit] = useState('')
  const [visibility, setVisibility] = useState<SparkVisibility>('PUBLIC')
  const [discoverable, setDiscoverable] = useState(true)
  const [votingDurationHours, setVotingDurationHours] = useState<24 | 48 | 72 | 168>(48)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Reset form when closed.
  useEffect(() => {
    if (!open) {
      setPrompt('')
      setDeadline('')
      setWordLimit('')
      setVisibility('PUBLIC')
      setDiscoverable(true)
      setVotingDurationHours(48)
      setError(null)
    }
  }, [open])

  // Force-clear discoverable when visibility leaves PUBLIC (3-layer defense)
  useEffect(() => {
    if (visibility !== 'PUBLIC') setDiscoverable(false)
  }, [visibility])

  const submit = () => {
    setError(null)
    startTransition(async () => {
      // W4.3 shim: title temporarily mirrors prompt until W4.4 adds a dedicated
      // title field to this modal. The shared schema now requires both.
      const result = await createSparkAction({
        title: prompt.slice(0, 60),
        prompt,
        deadline: new Date(deadline),
        wordLimit: wordLimit ? parseInt(wordLimit) : undefined,
        visibility,
        discoverable,
        votingDurationHours,
      })
      if (result.success) {
        setOpen(false)
        router.push(`/${locale}/sparks/${result.data.sparkId}`)
      } else {
        setError(
          result.error === 'FREE_LIMIT_REACHED'
            ? 'You already have an active Spark. Upgrade to premium for unlimited Sparks.'
            : 'Failed to create Spark. Check your inputs and try again.',
        )
      }
    })
  }

  const inputStyle = {
    background: '#1E1E1E',
    boxShadow: 'var(--sh-inset)',
    color: 'var(--canvas-dark-ink)',
  } as const

  const labelClass = 'text-[10px] font-mono uppercase tracking-[0.14em]'
  const labelStyle = { color: 'var(--canvas-dark-ink-muted)' } as const

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap h-9 px-6 rounded-[var(--r-pill)] text-[13px] font-semibold cursor-pointer"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        <Plus size={15} />
        <span>New Spark</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] p-7 gap-6 dialog-ios">
          <DialogHeader>
            <DialogTitle
              className="font-display"
              style={{
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--canvas-dark-ink-strong)',
              }}
            >
              New Spark
            </DialogTitle>
            <p
              className="text-[13px] mt-1"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              A quick prompt with a real deadline. You can change these later.
            </p>
          </DialogHeader>

          <div className="flex flex-col gap-5 max-h-[62vh] overflow-y-auto pr-1 -mr-1">
            <div className="flex flex-col gap-2">
              <label htmlFor="sk-prompt" className={labelClass} style={labelStyle}>
                Prompt <span style={{ color: 'var(--brand)' }}>*</span>
              </label>
              <textarea
                id="sk-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Write a prompt that sparks creativity…"
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-[var(--r-row)] text-[14px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="sk-deadline" className={labelClass} style={labelStyle}>
                Deadline <span style={{ color: 'var(--brand)' }}>*</span>
              </label>
              <input
                id="sk-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full h-10 px-3.5 rounded-[var(--r-row)] text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="sk-wlimit" className={labelClass} style={labelStyle}>
                Word limit
                <span
                  className="ml-2 normal-case tracking-normal"
                  style={{ color: 'var(--canvas-dark-ink-faint)' }}
                >
                  optional
                </span>
              </label>
              <input
                id="sk-wlimit"
                type="number"
                value={wordLimit}
                onChange={(e) => setWordLimit(e.target.value)}
                placeholder="Leave blank for no limit"
                className="w-full h-10 px-3.5 rounded-[var(--r-row)] text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className={labelClass} style={labelStyle}>
                Visibility
              </label>
              <VisibilityPicker
                value={visibility}
                onChange={setVisibility}
                options={PUBLIC_FRIENDS_PRIVATE_OPTIONS}
              />
            </div>

            <label
              className="flex items-center gap-2.5 text-[13px] py-2 px-3 rounded-[var(--r-row)] cursor-pointer select-none"
              style={{
                background: 'oklch(1 0 0 / 0.025)',
                border: 'var(--br-card)',
              }}
            >
              <input
                type="checkbox"
                checked={discoverable}
                disabled={visibility !== 'PUBLIC'}
                onChange={(e) => setDiscoverable(e.target.checked)}
                className="h-4 w-4 accent-[var(--brand)] disabled:opacity-40"
              />
              <span style={{ color: 'var(--canvas-dark-ink)' }}>
                Show in Discover
              </span>
              {visibility !== 'PUBLIC' && (
                <span
                  className="text-[11px] ml-auto"
                  style={{ color: 'var(--canvas-dark-ink-faint)' }}
                >
                  public sparks only
                </span>
              )}
            </label>

            <div className="flex flex-col gap-2">
              <label className={labelClass} style={labelStyle}>
                Voting window
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[24, 48, 72, 168].map((h) => {
                  const isActive = votingDurationHours === h
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setVotingDurationHours(h as 24 | 48 | 72 | 168)}
                      className="text-[13px] font-semibold h-10 rounded-[var(--r-row)] transition-colors"
                      style={{
                        background: isActive
                          ? 'oklch(from var(--brand) l c h / 0.16)'
                          : '#1E1E1E',
                        color: isActive
                          ? 'var(--brand)'
                          : 'var(--canvas-dark-ink-muted)',
                        border: isActive
                          ? '1px solid oklch(from var(--brand) l c h / 0.35)'
                          : '1px solid transparent',
                        boxShadow: isActive ? undefined : 'var(--sh-inset)',
                      }}
                    >
                      {h === 168 ? '1 week' : `${h}h`}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <p
                className="text-[12px]"
                style={{ color: 'var(--status-error)' }}
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="dialog-ios-footer">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 px-4 rounded-[var(--r-pill)] text-[13px] font-medium transition-colors"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isPending || !prompt.trim() || !deadline}
              className="h-9 px-5 rounded-[var(--r-pill)] text-[13px] font-semibold disabled:opacity-40"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              {isPending ? 'Creating…' : 'Create Spark'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
