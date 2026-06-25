'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, Users, Globe, Check } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { updateHiveAction, deleteHiveAction } from '@/lib/actions/hive.actions'
import { HiveSectionDivider } from './hive-section-divider'
import { toastNetworkError } from '@/lib/errors/notify'

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

const VISIBILITY_OPTIONS: {
  value: Visibility
  icon: typeof Lock
  label: string
  desc: string
}[] = [
  {
    value: 'PRIVATE',
    icon: Lock,
    label: 'Private',
    desc: 'Invite only. Hidden from everyone else.',
  },
  {
    value: 'FRIENDS',
    icon: Users,
    label: 'Friends',
    desc: 'Your friends can find and request to join.',
  },
  {
    value: 'PUBLIC',
    icon: Globe,
    label: 'Public',
    desc: 'Anyone can discover and request to join.',
  },
]

const fieldStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  borderRadius: 'var(--r-row)',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink-strong)',
  border: 'none',
}

const fieldLabelClass =
  'block mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]'

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
    try {
      const result = await updateHiveAction({
        hiveId,
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        discoverable,
      })
      if (result.success) {
        toast.success('Hive updated')
        router.refresh()
      } else {
        toast.error(result.error || 'Could not save')
      }
    } catch {
      toastNetworkError()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      const result = await deleteHiveAction(hiveId)
      if (result.success) {
        toast.success(`Deleted "${initial.name}"`)
        router.push(`/${locale}/studio`)
        router.refresh()
      } else {
        toast.error(result.error || 'Could not delete')
      }
    } catch {
      toastNetworkError()
    }
  }

  const discoverableDisabled = visibility !== 'PUBLIC'

  return (
    <form onSubmit={handleSave}>
      <HiveSectionDivider label="Basics" hideTopBorder>
        <div className="flex flex-col gap-4">
          <div>
            <label className={fieldLabelClass}>Hive name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={fieldStyle}
              className="w-full px-3 py-2.5 text-sm font-geist focus:outline-none focus:shadow-[var(--sh-inset),0_0_0_1px_oklch(0.85_0.18_90_/_0.4)]"
              required
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ ...fieldStyle, minHeight: 100 }}
              className="w-full px-3 py-2.5 text-sm font-geist focus:outline-none focus:shadow-[var(--sh-inset),0_0_0_1px_oklch(0.85_0.18_90_/_0.4)] resize-y"
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
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  borderRadius: 'var(--r-row)',
                  boxShadow: active
                    ? 'var(--sh-tile), 0 0 0 3px oklch(from var(--brand) l c h / 0.15)'
                    : 'var(--sh-tile)',
                  border: active
                    ? '1px solid var(--brand)'
                    : '1px solid var(--canvas-dark-300)',
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'border-color .14s, box-shadow .14s',
                }}
                className="flex flex-col items-start"
              >
                <input
                  type="radio"
                  name="visibility"
                  value={value}
                  checked={active}
                  onChange={() => setVisibility(value)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center mb-[10px]"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: active
                      ? 'var(--brand-soft)'
                      : 'var(--canvas-dark-300)',
                    color: active ? 'var(--brand)' : 'var(--canvas-dark-ink)',
                  }}
                >
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <span
                  className="font-comfortaa font-semibold text-[14px]"
                  style={{ color: 'var(--canvas-dark-ink-strong)' }}
                >
                  {label}
                </span>
                <span
                  className="text-[12.5px] mt-1"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
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
          className="flex gap-3 items-start cursor-pointer"
          style={{ opacity: discoverableDisabled ? 0.5 : 1 }}
        >
          <input
            type="checkbox"
            checked={discoverable}
            disabled={discoverableDisabled}
            onChange={(e) => setDiscoverable(e.target.checked)}
            className="sr-only"
          />
          <span
            aria-hidden="true"
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: discoverable
                ? 'var(--brand-soft)'
                : 'var(--canvas-dark-100)',
              boxShadow: 'var(--sh-inset)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand)',
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {discoverable && <Check size={12} strokeWidth={3} />}
          </span>
          <div>
            <div
              className="text-sm font-medium"
              style={{ color: 'var(--canvas-dark-ink-strong)' }}
            >
              List this hive in Discover
            </div>
            <div
              className="text-[12.5px] mt-1"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Only available when visibility is set to Public.
            </div>
          </div>
        </label>
      </HiveSectionDivider>

      <HiveSectionDivider label="Danger zone" tone="danger">
        <div className="flex items-center justify-between gap-4">
          <p
            className="text-[12.5px] m-0"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Permanently delete this hive and all of its outlines, wiki,
            discussions and goals. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            style={{
              flexShrink: 0,
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
              borderRadius: 'var(--r-btn)',
              color: 'var(--status-error)',
              border:
                '1px solid oklch(from var(--status-error) l c h / 0.3)',
            }}
            className="inline-flex items-center px-4 py-2.5 font-geist text-[13px] transition-all hover:-translate-y-px"
          >
            Delete hive
          </button>
        </div>
      </HiveSectionDivider>

      <section className="px-6 py-5 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-pill)',
            boxShadow: 'var(--sh-tile)',
            opacity: saving ? 0.5 : 1,
          }}
          className="inline-flex items-center px-4 py-2 font-geist font-semibold text-[13px] transition-transform hover:-translate-y-px hover:bg-[var(--brand-hover)] active:translate-y-0 active:bg-[var(--brand-active)]"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
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
    </form>
  )
}
