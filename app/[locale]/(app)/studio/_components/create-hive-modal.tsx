'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Link2, BookPlus, Sparkles, Lock, Users, Globe, ChevronRight, ChevronDown } from 'lucide-react'
import { createHiveAction } from '@/lib/actions/hive.actions'
import { getUserBooksAction } from '@/lib/actions/book.actions'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Path = 'link' | 'new' | 'standalone'
type Visibility = 'PRIVATE' | 'FRIENDS' | 'PUBLIC'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prelockBookId?: string | null
  defaultBookId?: string | null
}

const labelClass = 'text-[11px] font-mono uppercase tracking-[0.10em] font-semibold'
const labelStyle = { color: 'var(--brand)' } as const

const recessedInputStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  borderRadius: 'var(--r-row)',
  color: 'var(--canvas-dark-ink-strong)',
}

export function CreateHiveModal({
  open,
  onOpenChange,
  prelockBookId,
  defaultBookId,
}: Props) {
  const lockedId = prelockBookId ?? defaultBookId ?? null

  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const [step, setStep] = useState<'pick' | 'details'>(lockedId ? 'details' : 'pick')
  const [path, setPath] = useState<Path>('link')
  const [bookId, setBookId] = useState<string | null>(lockedId)
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    visibility: 'PRIVATE' as Visibility,
    discoverable: false,
  })

  useEffect(() => {
    if (!open) return
    setStep(lockedId ? 'details' : 'pick')
    setPath('link')
    setBookId(lockedId)
    setErr(null)
    setForm({ name: '', description: '', visibility: 'PRIVATE', discoverable: false })
  }, [open, lockedId])

  useEffect(() => {
    if (open && path === 'new' && step === 'pick') {
      onOpenChange(false)
      router.push(`/${locale}/studio/new?withHive=1`)
    }
  }, [open, path, step, locale, router, onOpenChange])

  const submit = () => {
    setErr(null)
    start(async () => {
      const result = await createHiveAction({
        bookId: path === 'standalone' ? null : bookId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        visibility: form.visibility,
        discoverable: form.discoverable,
      })
      if (!result.success) {
        setErr(result.error)
        return
      }
      onOpenChange(false)
      router.push(`/${locale}/hive/${result.data.hiveId}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-5">
          {step === 'pick' && (
            <PathPicker
              onPick={(p) => {
                setPath(p)
                if (p !== 'new') setStep('details')
              }}
            />
          )}
          {step === 'details' && (
            <DetailsForm
              path={path}
              bookId={bookId}
              setBookId={setBookId}
              form={form}
              setForm={setForm}
              err={err}
              pending={pending}
              lockedBook={!!lockedId}
              onBack={lockedId ? null : () => setStep('pick')}
              onSubmit={submit}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PathPicker({ onPick }: { onPick: (p: Path) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h3
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--canvas-dark-ink-strong)' }}
        >
          Start a Hive
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--canvas-dark-ink)' }}>
          Pick how you'd like to set it up. You can change every detail later.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <PathCard
          icon={<Link2 size={16} />}
          title="Link an existing book"
          blurb="Pick one of your books that doesn't yet have a hive."
          onClick={() => onPick('link')}
        />
        <PathCard
          icon={<BookPlus size={16} />}
          title="Create a new book + hive together"
          blurb="Goes through the book wizard, then opens hive details."
          onClick={() => onPick('new')}
        />
        <PathCard
          icon={<Sparkles size={16} />}
          title="Standalone hive (no book)"
          blurb="A collaboration space without a linked book."
          onClick={() => onPick('standalone')}
        />
      </div>
    </div>
  )
}

function PathCard({
  icon,
  title,
  blurb,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  blurb: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left p-3.5 transition-[filter,transform] hover:brightness-110 active:scale-[0.99]"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        borderRadius: 'var(--r-row)',
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            borderRadius: 'var(--r-btn)',
            color: 'var(--brand)',
          }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h4
            className="text-sm font-semibold leading-tight"
            style={{ color: 'var(--canvas-dark-ink-strong)' }}
          >
            {title}
          </h4>
          <p
            className="text-xs leading-snug mt-1"
            style={{ color: 'var(--canvas-dark-ink)' }}
          >
            {blurb}
          </p>
        </div>
        <ChevronRight
          size={16}
          className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'var(--canvas-dark-ink)' }}
        />
      </div>
    </button>
  )
}

type DetailsFormProps = {
  path: Path
  bookId: string | null
  setBookId: (v: string | null) => void
  form: { name: string; description: string; visibility: Visibility; discoverable: boolean }
  setForm: (v: DetailsFormProps['form']) => void
  err: string | null
  pending: boolean
  lockedBook: boolean
  onBack: (() => void) | null
  onSubmit: () => void
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string; blurb: string; icon: React.ReactNode }[] = [
  { value: 'PRIVATE', label: 'Private', blurb: 'Invite-only', icon: <Lock size={14} /> },
  { value: 'FRIENDS', label: 'Friends', blurb: 'Friends can join', icon: <Users size={14} /> },
  { value: 'PUBLIC', label: 'Public', blurb: 'Anyone with the link', icon: <Globe size={14} /> },
]

function DetailsForm({
  path,
  bookId,
  setBookId,
  form,
  setForm,
  err,
  pending,
  lockedBook,
  onBack,
  onSubmit,
}: DetailsFormProps) {
  const [books, setBooks] = useState<
    Array<{ id: string; title: string; hasHive: boolean }> | null
  >(null)

  useEffect(() => {
    if (path !== 'link' || books) return
    getUserBooksAction().then((r) => {
      if (!r.success) return
      setBooks(
        r.data.map((b) => ({ id: b.id, title: b.title, hasHive: !!b.hiveId })),
      )
    })
  }, [path, books])

  const allBooksHaveHives =
    path === 'link' && books !== null && books.length > 0 && books.every((b) => b.hasHive)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className="flex flex-col gap-1 text-center">
        <h3
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--canvas-dark-ink-strong)' }}
        >
          Hive Details
        </h3>
      </div>

      {path === 'link' && (
        <div className="flex flex-col gap-2">
          <span className={labelClass} style={labelStyle}>Book</span>
          {lockedBook ? (
            <div
              className="px-3 py-2 text-sm"
              style={{
                ...recessedInputStyle,
                color: 'var(--canvas-dark-ink)',
              }}
            >
              {books?.find((b) => b.id === bookId)?.title ?? 'Loading…'}
            </div>
          ) : (
            <>
              <div className="relative">
                <select
                  required
                  value={bookId ?? ''}
                  onChange={(e) => setBookId(e.target.value || null)}
                  className="w-full appearance-none px-3 py-2 pr-9 text-sm outline-none"
                  style={recessedInputStyle}
                >
                  <option value="">Pick a book…</option>
                  {books
                    ?.filter((b) => !b.hasHive)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--canvas-dark-ink)' }}
                />
              </div>
              {allBooksHaveHives && (
                <p className="text-[11px]" style={{ color: 'var(--canvas-dark-ink)' }}>
                  All your books already have a hive.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className={labelClass} style={labelStyle}>Name</span>
        <input
          required
          maxLength={80}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Give your hive a name"
          className="w-full px-3 py-2 text-sm outline-none placeholder:italic"
          style={recessedInputStyle}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass} style={labelStyle}>Description</span>
        <textarea
          maxLength={280}
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional — what's the hive about?"
          className="w-full px-3 py-2 text-sm outline-none resize-none placeholder:italic"
          style={{
            ...recessedInputStyle,
            background: 'oklch(0.245 0.003 256)',
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass} style={labelStyle}>Visibility</span>
        <div className="flex flex-col gap-2">
          {VISIBILITY_OPTIONS.map((opt) => {
            const active = form.visibility === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    visibility: opt.value,
                    discoverable: opt.value === 'PUBLIC' ? form.discoverable : false,
                  })
                }
                className="text-left px-3 py-2.5 transition-[filter,transform] hover:brightness-110 active:scale-[0.99]"
                style={{
                  background: active
                    ? 'oklch(from var(--brand) l c h / 0.12)'
                    : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  boxShadow: 'var(--sh-tile)',
                  borderRadius: 'var(--r-row)',
                  outline: active ? `1px solid var(--brand)` : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 flex-shrink-0"
                    style={{
                      background: 'var(--canvas-dark-100)',
                      boxShadow: 'var(--sh-inset)',
                      borderRadius: 'var(--r-btn)',
                      color: active ? 'var(--brand)' : 'var(--canvas-dark-ink)',
                    }}
                  >
                    {opt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold leading-tight"
                      style={{
                        color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)',
                      }}
                    >
                      {opt.label}
                    </p>
                    <p
                      className="text-[11px] leading-snug"
                      style={{ color: 'var(--canvas-dark-ink)' }}
                    >
                      {opt.blurb}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <label
        className={cn(
          'flex items-start gap-2.5 px-3 py-2.5 text-xs cursor-pointer transition-opacity',
          form.visibility !== 'PUBLIC' && 'opacity-50 cursor-not-allowed',
        )}
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          borderRadius: 'var(--r-row)',
        }}
      >
        <input
          type="checkbox"
          disabled={form.visibility !== 'PUBLIC'}
          checked={form.discoverable}
          onChange={(e) => setForm({ ...form, discoverable: e.target.checked })}
          className="mt-0.5 accent-[var(--brand)]"
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--canvas-dark-ink-strong)' }}
          >
            Discoverable
          </span>
          <span style={{ color: 'var(--canvas-dark-ink)' }}>
            List this hive on /discover/hives so anyone can find it.
          </span>
        </div>
      </label>

      {err && (
        <div
          className="px-3 py-2 text-xs"
          style={{
            background: 'oklch(from var(--destructive) l c h / 0.12)',
            color: 'var(--destructive)',
            borderRadius: 'var(--r-row)',
          }}
        >
          {err}
        </div>
      )}

      <div className="flex justify-between items-center pt-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 text-xs transition-colors hover:brightness-110"
            style={{
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
              borderRadius: 'var(--r-btn)',
              color: 'var(--canvas-dark-ink)',
            }}
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending || (path === 'link' && !bookId)}
          className="px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-btn)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {pending ? 'Creating…' : 'Create hive'}
        </button>
      </div>
    </form>
  )
}
