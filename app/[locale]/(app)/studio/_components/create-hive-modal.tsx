'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Link2, BookPlus, Sparkles } from 'lucide-react'
import { createHiveAction } from '@/lib/actions/hive.actions'
import { getUserBooksAction } from '@/lib/actions/book.actions'
import { Dialog, DialogContent } from '@/components/ui/dialog'

type Path = 'link' | 'new' | 'standalone'
type Visibility = 'PRIVATE' | 'FRIENDS' | 'PUBLIC'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, modal opens directly at the details step with this book pre-linked. */
  prelockBookId?: string | null
  /** Back-compat with the T11 stub's prop name. */
  defaultBookId?: string | null
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

  // Re-sync internal state whenever the modal opens (or the prelocked id changes).
  useEffect(() => {
    if (!open) return
    setStep(lockedId ? 'details' : 'pick')
    setPath('link')
    setBookId(lockedId)
    setErr(null)
    setForm({ name: '', description: '', visibility: 'PRIVATE', discoverable: false })
  }, [open, lockedId])

  // If user picks the "new book" path, route them through the wizard with
  // ?withHive=1. The wizard will bounce back to /studio?createHive=<newBookId>
  // and the studio page re-opens this modal with prelockBookId set.
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
      <DialogContent className="sm:max-w-md">
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
      </DialogContent>
    </Dialog>
  )
}

function PathPicker({ onPick }: { onPick: (p: Path) => void }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Start a new hive</h3>
      <PathCard
        icon={<Link2 size={18} />}
        title="Link an existing book"
        blurb="Pick one of your books that doesn't yet have a hive."
        onClick={() => onPick('link')}
      />
      <PathCard
        icon={<BookPlus size={18} />}
        title="Create a new book + hive together"
        blurb="Goes through the book wizard, then opens hive details."
        onClick={() => onPick('new')}
      />
      <PathCard
        icon={<Sparkles size={18} />}
        title="Standalone hive (no book)"
        blurb="A collaboration space without a linked book."
        onClick={() => onPick('standalone')}
      />
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
      className="w-full text-left p-4 rounded-lg border border-border hover:border-brand transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="text-brand mt-0.5">{icon}</div>
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground mt-0.5">{blurb}</p>
        </div>
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
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <h3 className="text-lg font-semibold">Hive details</h3>

      {path === 'link' && (
        <div>
          <label className="block text-sm mb-1">Book</label>
          {lockedBook ? (
            <div className="px-3 py-2 rounded-md bg-input text-sm text-muted-foreground">
              {books?.find((b) => b.id === bookId)?.title ?? 'Loading…'}
            </div>
          ) : (
            <>
              <select
                required
                value={bookId ?? ''}
                onChange={(e) => setBookId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-md bg-input"
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
              {allBooksHaveHives && (
                <p className="text-xs text-muted-foreground mt-1">
                  All your books already have a hive.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm mb-1">Name</label>
        <input
          required
          maxLength={80}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 rounded-md bg-input"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Description</label>
        <textarea
          maxLength={280}
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 rounded-md bg-input"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Visibility</label>
        <select
          value={form.visibility}
          onChange={(e) =>
            setForm({
              ...form,
              visibility: e.target.value as Visibility,
              discoverable: false,
            })
          }
          className="w-full px-3 py-2 rounded-md bg-input"
        >
          <option value="PRIVATE">Private — invite-only</option>
          <option value="FRIENDS">Friends — friends can join</option>
          <option value="PUBLIC">Public — anyone can find via link</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={form.visibility !== 'PUBLIC'}
          checked={form.discoverable}
          onChange={(e) => setForm({ ...form, discoverable: e.target.checked })}
        />
        Discoverable on /discover/hives
      </label>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="flex justify-between items-center">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending || (path === 'link' && !bookId)}
          className="px-4 py-2 rounded-md bg-brand text-brand-ink font-medium disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create hive'}
        </button>
      </div>
    </form>
  )
}
