'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Link2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClubInviteTokenAction } from '@/lib/actions/book-clubs.actions'

type Props = {
  clubId: string
  locale: string
}

function formatExpiry(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function InviteLinkDialog({ clubId, locale }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !url) {
      setError(null)
      startTransition(async () => {
        const r = await createClubInviteTokenAction({ clubId })
        if (!r.success) {
          setError(r.error)
          return
        }
        const origin =
          typeof window !== 'undefined' ? window.location.origin : ''
        setUrl(`${origin}/${locale}/community/clubs/${clubId}/invite/${r.data.token}`)
        setExpiresAt(r.data.expiresAt)
      })
    }
    if (!next) {
      setCopied(false)
    }
  }

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--r-pill)] text-[13px] font-semibold cursor-pointer"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          <Link2 size={14} /> Generate invite link
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite by link</DialogTitle>
        </DialogHeader>
        <p
          className="text-[12px] -mt-1"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Anyone who opens this link will join the club when they sign in.
        </p>
        {error ? (
          <p
            className="rounded-[var(--r-row)] p-3 text-[12px]"
            style={{
              background: 'var(--canvas-dark-100)',
              color: 'var(--canvas-dark-ink-muted)',
              boxShadow: 'var(--sh-inset)',
            }}
          >
            Could not generate an invite link. Please try again.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={loading || !url ? 'Generating…' : url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Invite URL"
              className="min-w-0 flex-1 rounded-[var(--r-row)] bg-[var(--canvas-dark-100)] px-3 py-2 text-sm text-[var(--canvas-dark-ink)] outline-none"
              style={{ boxShadow: 'var(--sh-inset)' }}
            />
            <button
              onClick={handleCopy}
              disabled={!url || loading}
              className="shrink-0 rounded-[var(--r-btn)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110 disabled:opacity-50"
              aria-live="polite"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        )}
        {expiresAt && !error && (
          <p
            className="mt-2 text-[11px]"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            This link expires on {formatExpiry(expiresAt)} (14 days).
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
