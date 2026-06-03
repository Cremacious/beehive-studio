'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, Users, Globe, Check } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { updateHiveAction, deleteHiveAction } from '@/lib/actions/hive.actions'
import { HiveSectionDivider } from './hive-section-divider'

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

const inputStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  borderRadius: 'var(--r-row)',
  boxShadow: 'var(--sh-inset)',
  border: 'var(--br-card)',
  color: 'var(--canvas-dark-ink-strong)',
}

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

  const discoverableDisabled = visibility !== 'PUBLIC'

  return (
    <>
      <form onSubmit={handleSave}>
        <HiveSectionDivider label="Basics" hideTopBorder>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={inputStyle}
                className="w-full px-3 py-2 text-sm font-geist focus:outline-none"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={inputStyle}
                className="w-full px-3 py-2 text-sm font-geist focus:outline-none resize-none"
              />
            </div>
          </div>
        </HiveSectionDivider>

        <HiveSectionDivider label="Visibility">
          <div className="grid grid-cols-3 gap-3">
            {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label, desc }) => {
              const active = visibility === value
              return (
                <label
                  key={value}
                  style={{
                    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    borderRadius: 'var(--r-row)',
                    boxShadow: 'var(--sh-tile)',
                    border: active ? '2px solid var(--brand)' : 'var(--br-card)',
                  }}
                  className="flex flex-col items-start gap-2 p-4 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={active}
                    onChange={() => setVisibility(value)}
                    className="sr-only"
                  />
                  <Icon
                    className="w-5 h-5"
                    style={{ color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
                  />
                  <span
                    style={{ color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)' }}
                    className="font-comfortaa font-semibold text-sm"
                  >
                    {label}
                  </span>
                  <span
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    className="text-xs leading-tight"
                  >
                    {desc}
                  </span>
                </label>
              )
            })}
          </div>
        </HiveSectionDivider>

        <HiveSectionDivider label="Discoverability">
          <label
            className="flex items-center gap-3 cursor-pointer"
            style={{ opacity: discoverableDisabled ? 0.5 : 1 }}
          >
            <input
              type="checkbox"
              checked={discoverable}
              disabled={discoverableDisabled}
              onChange={e => setDiscoverable(e.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: discoverable ? 'var(--brand)' : 'var(--canvas-dark-100)',
                boxShadow: discoverable ? 'var(--sh-tile)' : 'var(--sh-inset)',
                border: discoverable ? 'none' : 'var(--br-card)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {discoverable && <Check className="w-3.5 h-3.5" style={{ color: 'var(--brand-ink)' }} strokeWidth={3} />}
            </span>
            <span style={{ color: 'var(--canvas-dark-ink-strong)' }} className="text-sm">
              Show in Discover
            </span>
          </label>
          <p
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            className="text-xs mt-2"
          >
            Discoverable hives appear on the public Discover feed. Only available for Public visibility.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                borderRadius: 'var(--r-btn)',
                boxShadow: 'var(--sh-tile)',
                opacity: saving ? 0.5 : 1,
              }}
              className="font-geist font-semibold text-sm px-4 py-2"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </HiveSectionDivider>
      </form>

      <HiveSectionDivider label="Danger zone" tone="danger">
        <p
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
          className="text-xs mb-4"
        >
          Deleting this hive cannot be undone. All discussions, annotations, submissions, and word goals are permanently removed.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          style={{
            color: 'var(--destructive)',
            borderRadius: 'var(--r-btn)',
            border: '1px solid color-mix(in oklch, var(--destructive) 40%, transparent)',
          }}
          className="font-geist font-semibold text-sm px-3 py-2 hover:bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] transition-colors"
        >
          Delete hive
        </button>
      </HiveSectionDivider>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title={`Delete "${initial.name}"?`}
        description="This permanently removes the hive and all of its submissions, suggestions, annotations, discussions, and wiki pages. This cannot be undone."
        confirmLabel="Delete hive"
        onConfirm={handleDelete}
      />
    </>
  )
}
