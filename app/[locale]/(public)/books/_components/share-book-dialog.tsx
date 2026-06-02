'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Lock, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  url: string
  visibility: Visibility
  trigger: ReactNode
}

export function ShareBookDialog({ url, visibility, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  const privacyNote =
    visibility === 'PRIVATE'
      ? { Icon: Lock, text: 'Only people you invite can open this link.' }
      : visibility === 'FRIENDS'
        ? { Icon: Users, text: 'Only your friends can open this link.' }
        : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this book</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Share URL"
            className="min-w-0 flex-1 rounded-[var(--r-row)] bg-[var(--canvas-dark-100)] px-3 py-2 text-sm text-[var(--canvas-dark-ink)] outline-none"
            style={{ boxShadow: 'var(--sh-inset)' }}
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-[var(--r-btn)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
            aria-live="polite"
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        {privacyNote && (
          <p className="mt-2 flex items-center gap-2 text-xs text-[var(--canvas-dark-ink-muted)]">
            <privacyNote.Icon className="h-3.5 w-3.5" />
            {privacyNote.text}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
