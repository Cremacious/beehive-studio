'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createHiveAction } from '@/lib/actions/hive.actions'

type Props = { bookId: string; locale: string; onClose: () => void }

export function CreateHiveModal({ bookId, locale, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    const result = await createHiveAction({ bookId, name: name.trim(), description: description.trim() || undefined, visibility })
    setSubmitting(false)
    if (result.success) {
      router.push(`/${locale}/hive/${result.data.hiveId}`)
    } else {
      setError(result.error === 'FREE_LIMIT_REACHED' ? 'You have reached the free limit of 3 Hives. Upgrade to Premium for unlimited Hives.' : result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Create a Hive for this book</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Hive name…"
            className="bg-surface-inset border border-border rounded px-3 py-2 text-sm outline-none focus:border-brand/40 text-foreground"
            required
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)…"
            className="resize-none bg-surface-inset border border-border rounded px-3 py-2 text-sm outline-none focus:border-brand/40 text-foreground min-h-16"
          />
          <div className="flex gap-2">
            {(['PRIVATE', 'PUBLIC'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`flex-1 text-xs py-1.5 rounded-full border transition-colors ${visibility === v ? 'bg-brand/20 border-brand/40 text-brand' : 'border-border text-muted-foreground'}`}
              >
                {v === 'PRIVATE' ? '🔒 Private' : '🌍 Public'}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onClose} className="flex-1 text-sm py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={submitting || !name.trim()} className="flex-1 text-sm py-2 rounded-lg bg-brand text-black font-medium disabled:opacity-40">
              {submitting ? 'Creating…' : 'Create Hive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
