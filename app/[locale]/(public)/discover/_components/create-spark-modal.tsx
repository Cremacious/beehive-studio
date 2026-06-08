'use client'
import { useState, useEffect, useTransition } from 'react'
import { createSparkAction } from '@/lib/actions/sparks.actions'
import { useRouter } from 'next/navigation'
import { VisibilityPicker, PUBLIC_FRIENDS_PRIVATE_OPTIONS } from '@/components/visibility-picker'
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

  // Force-clear discoverable when visibility leaves PUBLIC (3-layer defense)
  useEffect(() => {
    if (visibility !== 'PUBLIC') setDiscoverable(false)
  }, [visibility])

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await createSparkAction({
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
        setError(result.error === 'FREE_LIMIT_REACHED'
          ? 'You already have an active Spark. Upgrade to premium for unlimited Sparks.'
          : 'Failed to create Spark. Check your inputs and try again.')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-[#FFC300] text-black font-bold text-[12px] rounded-md cursor-pointer"
      >
        + Create Spark
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white text-[18px] font-semibold mb-4">New Spark</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[#666] text-[11px] uppercase tracking-wide block mb-1">Prompt *</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Write a prompt that sparks creativity…"
                  rows={3}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#ccc] text-[13px] resize-none focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>
              <div>
                <label className="text-[#666] text-[11px] uppercase tracking-wide block mb-1">Deadline *</label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#ccc] text-[13px] focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>
              <div>
                <label className="text-[#666] text-[11px] uppercase tracking-wide block mb-1">Word limit (optional)</label>
                <input
                  type="number"
                  value={wordLimit}
                  onChange={e => setWordLimit(e.target.value)}
                  placeholder="Leave blank for no limit"
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#ccc] text-[13px] focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider mb-2 block text-[var(--canvas-dark-ink-muted)]">
                  Visibility
                </label>
                <VisibilityPicker value={visibility} onChange={setVisibility} options={PUBLIC_FRIENDS_PRIVATE_OPTIONS} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={discoverable}
                  disabled={visibility !== 'PUBLIC'}
                  onChange={(e) => setDiscoverable(e.target.checked)}
                  className="rounded"
                />
                <span>Show in Discover</span>
                {visibility !== 'PUBLIC' && (
                  <span className="text-xs text-[var(--canvas-dark-ink-muted)]">(only PUBLIC sparks can be discoverable)</span>
                )}
              </label>
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider mb-2 block text-[var(--canvas-dark-ink-muted)]">
                  Voting window
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[24, 48, 72, 168].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setVotingDurationHours(h as 24 | 48 | 72 | 168)}
                      className={`text-sm py-2 rounded-[var(--r-row)] border transition-colors ${
                        votingDurationHours === h
                          ? 'border-[var(--brand)] bg-[color-mix(in_oklch,var(--brand)_8%,transparent)]'
                          : 'border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)]'
                      }`}
                    >
                      {h === 168 ? '1 week' : `${h}h`}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-400 text-[12px]">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setOpen(false)} className="px-4 py-2 text-[#888] text-[13px] cursor-pointer hover:text-white transition-colors">Cancel</button>
                <button
                  onClick={submit}
                  disabled={isPending || !prompt.trim() || !deadline}
                  className="px-5 py-2 bg-[#FFC300] text-black font-bold text-[13px] rounded-md disabled:opacity-40 cursor-pointer"
                >
                  {isPending ? 'Creating…' : 'Create Spark'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
