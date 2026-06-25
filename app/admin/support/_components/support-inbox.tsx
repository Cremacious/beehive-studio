'use client'

import { useState, useTransition } from 'react'
import {
  listSupportMessagesAction,
  getSupportMessageAction,
  updateSupportStatusAction,
  respondToSupportMessageAction,
  deleteSupportMessageAction,
  type SupportMessageRow,
  type SupportMessageDetail,
} from '@/lib/actions/support.actions'
import { toast } from 'sonner'
import { Mail, ArrowLeft, Trash2, RefreshCw, MessageSquare } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  technical: 'Technical',
  feedback: 'Feedback',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_progress: 'In progress',
  resolved: 'Resolved',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'var(--brand)',
  in_progress: 'oklch(0.75 0.14 230)',
  resolved: 'oklch(0.7 0.15 150)',
}

function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

// ─── Message list row ─────────────────────────────────────────────────────────

function MessageRow({
  msg,
  selected,
  onClick,
}: {
  msg: SupportMessageRow
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: selected
          ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
          : 'none',
        border: 'none',
        borderRadius: 'var(--r-row)',
        padding: '12px 14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        borderLeft: selected ? '3px solid var(--brand)' : '3px solid transparent',
        transition: 'background 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--canvas-dark-ink-strong)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {msg.subject}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: STATUS_COLORS[msg.status] ?? 'var(--canvas-dark-ink-muted)',
            flexShrink: 0,
          }}
        >
          {STATUS_LABELS[msg.status]}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>{msg.email}</span>
        <span style={{ color: 'var(--canvas-dark-100)', fontSize: 12 }}>·</span>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--canvas-dark-ink-muted)',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          {CATEGORY_LABELS[msg.category]}
        </span>
        <span style={{ color: 'var(--canvas-dark-100)', fontSize: 12 }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)' }}>{relTime(msg.createdAt)}</span>
      </div>
    </button>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  detail,
  onBack,
  onStatusChange,
  onDeleted,
}: {
  detail: SupportMessageDetail
  onBack: () => void
  onStatusChange: (id: string, newStatus: 'new' | 'in_progress' | 'resolved') => void
  onDeleted: (id: string) => void
}) {
  const [response, setResponse] = useState(detail.adminResponse ?? '')
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  function handleStatusChange(status: 'new' | 'in_progress' | 'resolved') {
    startTransition(async () => {
      const result = await updateSupportStatusAction(detail.id, status)
      if (result.ok) {
        onStatusChange(detail.id, status)
        toast.success(`Status updated to "${STATUS_LABELS[status]}"`)
      } else {
        toast.error(result.error ?? 'Failed to update status.')
      }
    })
  }

  function handleRespond() {
    if (!response.trim()) return
    startTransition(async () => {
      const result = await respondToSupportMessageAction({ id: detail.id, adminResponse: response })
      if (result.ok) {
        onStatusChange(detail.id, 'resolved')
        toast.success('Response sent and message resolved.')
      } else {
        toast.error(result.error ?? 'Failed to send response.')
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Delete message from ${detail.email}? This cannot be undone.`)) return
    startDelete(async () => {
      const result = await deleteSupportMessageAction(detail.id)
      if (result.ok) {
        onDeleted(detail.id)
        toast.success('Message deleted.')
      } else {
        toast.error(result.error ?? 'Failed to delete message.')
      }
    })
  }

  const INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    background: 'var(--canvas-dark-100)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 'var(--r-row)',
    padding: '10px 14px',
    color: 'var(--canvas-dark-ink)',
    fontSize: 14,
    fontFamily: 'inherit',
    boxShadow: 'var(--sh-inset)',
    boxSizing: 'border-box',
    outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--canvas-dark-ink-muted)',
            padding: 4,
            display: 'flex',
            flexShrink: 0,
            marginTop: 2,
          }}
          aria-label="Back to list"
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--canvas-dark-ink-strong)',
              margin: '0 0 4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {detail.subject}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>{detail.email}</span>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 4,
                padding: '1px 6px',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              {CATEGORY_LABELS[detail.category]}
            </span>
            {detail.userId && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--canvas-dark-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                uid: {detail.userId.slice(0, 12)}...
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)' }}>
              {relTime(detail.createdAt)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          style={{
            background: 'none',
            border: 'none',
            cursor: isDeleting ? 'wait' : 'pointer',
            color: 'oklch(0.65 0.2 25)',
            padding: 4,
            display: 'flex',
            flexShrink: 0,
            opacity: isDeleting ? 0.5 : 1,
          }}
          aria-label="Delete message"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            Status
          </span>
          {(['new', 'in_progress', 'resolved'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusChange(s)}
              disabled={isPending || detail.status === s}
              style={{
                background:
                  detail.status === s ? STATUS_COLORS[s] : 'rgba(255,255,255,0.06)',
                color: detail.status === s ? '#000' : 'var(--canvas-dark-ink-muted)',
                border: 'none',
                borderRadius: 'var(--r-pill)',
                padding: '3px 10px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                letterSpacing: '0.05em',
                cursor: detail.status === s ? 'default' : 'pointer',
                opacity: isPending ? 0.6 : 1,
                transition: 'background 120ms',
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Original message */}
        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            borderRadius: 'var(--r-row)',
            padding: '14px 16px',
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--canvas-dark-ink-muted)',
              marginBottom: 10,
            }}
          >
            Message
          </p>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--canvas-dark-ink)',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {detail.message}
          </p>
        </div>

        {/* Prior response, if any */}
        {detail.adminResponse && (
          <div
            style={{
              background: 'rgba(255,195,0,0.06)',
              border: '1px solid rgba(255,195,0,0.15)',
              borderRadius: 'var(--r-row)',
              padding: '14px 16px',
              marginBottom: 24,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--brand)',
                marginBottom: 10,
              }}
            >
              Previous response
              {detail.respondedAt ? ` · ${relTime(detail.respondedAt)}` : ''}
            </p>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--canvas-dark-ink)',
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {detail.adminResponse}
            </p>
          </div>
        )}

        {/* Reply form */}
        <div>
          <label
            htmlFor="admin-response"
            style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--canvas-dark-ink-muted)',
              marginBottom: 8,
            }}
          >
            <MessageSquare size={11} style={{ display: 'inline', marginRight: 4 }} />
            Reply by email
          </label>
          <textarea
            id="admin-response"
            rows={6}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Write your response here. This will be sent to the user by email and mark the message as resolved."
            disabled={isPending}
            style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.6, marginBottom: 12 }}
          />
          <button
            type="button"
            onClick={handleRespond}
            disabled={isPending || !response.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '9px 20px',
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending || !response.trim() ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <Mail size={13} />
            {isPending ? 'Sending...' : 'Send reply'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main inbox shell ─────────────────────────────────────────────────────────

export function SupportInbox({ initialMessages }: { initialMessages: SupportMessageRow[] }) {
  const [messages, setMessages] = useState<SupportMessageRow[]>(initialMessages)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportMessageDetail | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'general' | 'technical' | 'feedback'>('all')
  const [isRefreshing, startRefresh] = useTransition()
  const [isLoadingDetail, startLoadDetail] = useTransition()

  const filtered = messages.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false
    return true
  })

  function handleSelectMessage(id: string) {
    setSelectedId(id)
    startLoadDetail(async () => {
      const result = await getSupportMessageAction(id)
      if (result.ok && result.data) {
        setDetail(result.data)
      } else {
        toast.error(result.error ?? 'Failed to load message.')
      }
    })
  }

  function handleBack() {
    setSelectedId(null)
    setDetail(null)
  }

  function handleStatusChange(id: string, newStatus: 'new' | 'in_progress' | 'resolved') {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m)))
    if (detail?.id === id) {
      setDetail((d) => (d ? { ...d, status: newStatus } : d))
    }
  }

  function handleDeleted(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id))
    setSelectedId(null)
    setDetail(null)
  }

  function handleRefresh() {
    startRefresh(async () => {
      const status =
        statusFilter === 'all' ? undefined : (statusFilter as 'new' | 'in_progress' | 'resolved')
      const category =
        categoryFilter === 'all'
          ? undefined
          : (categoryFilter as 'general' | 'technical' | 'feedback')
      const result = await listSupportMessagesAction({ status, category })
      if (result.ok && result.data) {
        setMessages(result.data)
        toast.success('Refreshed')
      } else {
        toast.error(result.error ?? 'Failed to refresh.')
      }
    })
  }

  const PILL_BASE: React.CSSProperties = {
    border: 'none',
    borderRadius: 'var(--r-pill)',
    padding: '4px 12px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'background 120ms',
  }

  function filterPill(
    label: string,
    active: boolean,
    onClick: () => void,
  ) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...PILL_BASE,
          background: active ? 'var(--brand)' : 'rgba(255,255,255,0.06)',
          color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        height: 'calc(100vh - 120px)',
        minHeight: 500,
        gap: 0,
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        overflow: 'hidden',
      }}
    >
      {/* Left column: filter + list */}
      <div
        style={{
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* List header */}
        <div
          style={{
            padding: '14px 16px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--brand)',
            }}
          >
            {filtered.length} message{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              background: 'none',
              border: 'none',
              cursor: isRefreshing ? 'wait' : 'pointer',
              color: 'var(--canvas-dark-ink-muted)',
              padding: 4,
              display: 'flex',
            }}
            aria-label="Refresh"
          >
            <RefreshCw size={14} style={{ opacity: isRefreshing ? 0.4 : 1 }} />
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {filterPill('All', statusFilter === 'all', () => setStatusFilter('all'))}
            {filterPill('New', statusFilter === 'new', () => setStatusFilter('new'))}
            {filterPill('In progress', statusFilter === 'in_progress', () => setStatusFilter('in_progress'))}
            {filterPill('Resolved', statusFilter === 'resolved', () => setStatusFilter('resolved'))}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {filterPill('All categories', categoryFilter === 'all', () => setCategoryFilter('all'))}
            {filterPill('General', categoryFilter === 'general', () => setCategoryFilter('general'))}
            {filterPill('Technical', categoryFilter === 'technical', () => setCategoryFilter('technical'))}
            {filterPill('Feedback', categoryFilter === 'feedback', () => setCategoryFilter('feedback'))}
          </div>
        </div>

        {/* Message list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filtered.length === 0 ? (
            <p
              style={{
                textAlign: 'center',
                color: 'var(--canvas-dark-ink-muted)',
                fontSize: 13,
                padding: '32px 16px',
              }}
            >
              No messages match these filters.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((msg) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  selected={selectedId === msg.id}
                  onClick={() => handleSelectMessage(msg.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right column: detail or empty state */}
      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isLoadingDetail ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--canvas-dark-ink-muted)',
              fontSize: 13,
            }}
          >
            Loading...
          </div>
        ) : detail ? (
          <DetailPanel
            detail={detail}
            onBack={handleBack}
            onStatusChange={handleStatusChange}
            onDeleted={handleDeleted}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            <Mail size={36} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 14, margin: 0 }}>Select a message to view it</p>
          </div>
        )}
      </div>
    </div>
  )
}
