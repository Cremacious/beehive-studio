'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, Users, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { updateHiveAction, deleteHiveAction } from '@/lib/actions/hive.actions'

type Visibility = 'PRIVATE' | 'FRIENDS' | 'PUBLIC'

type Props = {
  hiveId: string
  locale: string
  initial: {
    name: string
    description: string
    visibility: Visibility
    discoverable: boolean
  }
}

const VISIBILITY_OPTIONS: { value: Visibility; icon: typeof Lock; label: string; desc: string }[] = [
  { value: 'PRIVATE', icon: Lock, label: 'Private', desc: 'Only members can see this hive.' },
  { value: 'FRIENDS', icon: Users, label: 'Friends', desc: 'Visible to your friends.' },
  { value: 'PUBLIC', icon: Globe, label: 'Public', desc: 'Anyone with the link can find this hive.' },
]

export function HiveSettingsForm({ hiveId, locale, initial }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility)
  const [discoverable, setDiscoverable] = useState(initial.discoverable)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Defense layer 2: force-clear discoverable when visibility flips off PUBLIC.
  useEffect(() => {
    if (visibility !== 'PUBLIC' && discoverable) setDiscoverable(false)
  }, [visibility, discoverable])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    const result = await updateHiveAction({
      hiveId,
      name: name.trim(),
      description: description.trim() || null,
      visibility,
      discoverable,
    })
    setSaving(false)
    if (result.success) {
      toast.success('Hive updated')
      router.refresh()
    } else {
      toast.error(result.error || 'Could not save')
    }
  }

  async function handleDelete() {
    const result = await deleteHiveAction(hiveId)
    if (result.success) {
      toast.success(`Deleted "${initial.name}"`)
      router.push(`/${locale}/studio`)
      router.refresh()
    } else {
      toast.error(result.error || 'Could not delete')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
      <h2 className="text-lg font-medium text-foreground">Settings</h2>

      <form onSubmit={handleSave} className="flex flex-col gap-5 bg-card border border-border rounded-lg p-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-surface-inset border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-brand/40"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="bg-surface-inset border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-brand/40 resize-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visibility</label>
          <div className="grid grid-cols-3 gap-2">
            {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label, desc }) => {
              const active = visibility === value
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setVisibility(value)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                    active
                      ? 'border-brand bg-brand/10'
                      : 'border-border bg-surface-inset hover:border-foreground/20',
                  )}
                >
                  <Icon className={cn('w-4 h-4', active ? 'text-brand' : 'text-muted-foreground')} />
                  <span className={cn('text-xs font-medium', active ? 'text-brand' : 'text-foreground')}>{label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={cn('flex items-center gap-2 text-sm', visibility !== 'PUBLIC' && 'opacity-50')}>
            <input
              type="checkbox"
              checked={discoverable}
              disabled={visibility !== 'PUBLIC'}
              onChange={e => setDiscoverable(e.target.checked)}
              className="accent-brand"
            />
            <span className="text-foreground">Show in Discover</span>
          </label>
          <p className="text-xs text-muted-foreground">Discoverable hives appear on the public Discover feed. Only available for Public visibility.</p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 rounded bg-brand text-black text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-destructive/30 p-5 flex flex-col gap-3">
        <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
        <p className="text-xs text-muted-foreground">
          Deleting this hive permanently removes all submissions, suggestions, annotations, discussions, and wiki pages. This cannot be undone.
        </p>
        <div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="px-3 py-1.5 rounded border border-destructive/40 text-destructive text-sm hover:bg-destructive/10 transition-colors"
          >
            Delete hive
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title={`Delete "${initial.name}"?`}
        description="This permanently removes the hive and all of its submissions, suggestions, annotations, discussions, and wiki pages. This cannot be undone."
        confirmLabel="Delete hive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
