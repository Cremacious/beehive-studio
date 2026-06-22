'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Inbox } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  respondToJoinRequestAction,
  type ClubJoinRequestRow,
} from '@/lib/actions/book-clubs.actions'

const AV_GRADIENTS = [
  'linear-gradient(150deg, oklch(0.6 0.13 250), oklch(0.46 0.1 280))',
  'linear-gradient(150deg, oklch(0.62 0.13 20), oklch(0.48 0.1 12))',
  'linear-gradient(150deg, oklch(0.6 0.12 155), oklch(0.46 0.1 165))',
  'linear-gradient(150deg, oklch(0.6 0.12 290), oklch(0.46 0.1 300))',
  'linear-gradient(150deg, oklch(0.7 0.13 70), oklch(0.55 0.12 55))',
]
function gradientFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AV_GRADIENTS[Math.abs(h) % AV_GRADIENTS.length]
}

function relTime(d: Date | string): string {
  const date = new Date(d)
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d2 = Math.floor(h / 24)
  if (d2 < 7) return `${d2}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function JoinRequestsBadge({
  initialRows,
}: {
  initialRows: ClubJoinRequestRow[]
}) {
  const [rows, setRows] = useState<ClubJoinRequestRow[]>(initialRows)
  const [open, setOpen] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()
  const router = useRouter()

  if (rows.length === 0) return null

  function respond(requestId: string, accept: boolean) {
    if (pendingIds.has(requestId)) return
    setPendingIds((prev) => new Set(prev).add(requestId))
    const snapshot = rows
    setRows((prev) => prev.filter((r) => r.requestId !== requestId))
    startTransition(async () => {
      const result = await respondToJoinRequestAction({ requestId, accept })
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(requestId)
        return next
      })
      if (!result.success) {
        setRows(snapshot)
        toast.error(accept ? 'Could not accept request' : 'Could not decline request')
        return
      }
      toast.success(accept ? 'Member added' : 'Request declined')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 11px 4px 8px',
          borderRadius: 999,
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
        aria-label={`${rows.length} pending join request${rows.length === 1 ? '' : 's'}`}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 16,
            height: 16,
            borderRadius: 999,
            background: 'var(--brand-ink)',
            color: 'var(--brand)',
            fontSize: 9,
            fontWeight: 800,
            padding: '0 5px',
          }}
        >
          {rows.length}
        </span>
        {rows.length === 1 ? 'Request' : 'Requests'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--brand)',
              }}
            >
              <Inbox aria-hidden="true" style={{ width: 16, height: 16 }} />
              Join requests
            </DialogTitle>
            <DialogDescription>
              {rows.length} pending &middot; tap accept to add as member, or decline to dismiss.
            </DialogDescription>
          </DialogHeader>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 360,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {rows.map((r) => {
              const handle = r.requester.username ?? r.requester.displayName ?? 'unknown'
              const initials = handle.slice(0, 2).toUpperCase()
              const isPending = pendingIds.has(r.requestId)
              return (
                <div
                  key={r.requestId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 'var(--r-row)',
                    background:
                      'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    boxShadow: 'var(--sh-tile)',
                    opacity: isPending ? 0.5 : 1,
                  }}
                >
                  {r.requester.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.requester.avatarUrl}
                      alt=""
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 12,
                        color: 'white',
                        background: gradientFor(r.requester.userId),
                      }}
                    >
                      {initials}
                    </span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: '0 0 1px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--canvas-dark-ink-strong)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.requester.displayName ?? handle}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--canvas-dark-ink-muted)',
                      }}
                    >
                      <span style={{ color: 'var(--brand)' }}>@{handle}</span>
                      <span style={{ margin: '0 6px' }}>·</span>
                      <span>{relTime(r.createdAt)}</span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => respond(r.requestId, false)}
                      disabled={isPending}
                      style={{
                        background: 'transparent',
                        border: '1px dashed rgba(255,255,255,0.20)',
                        borderRadius: 999,
                        padding: '5px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--canvas-dark-ink-muted)',
                        cursor: isPending ? 'wait' : 'pointer',
                      }}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(r.requestId, true)}
                      disabled={isPending}
                      style={{
                        background: 'var(--brand)',
                        color: 'var(--brand-ink)',
                        border: 'none',
                        borderRadius: 999,
                        padding: '5px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        cursor: isPending ? 'wait' : 'pointer',
                      }}
                    >
                      ✓ Accept
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
