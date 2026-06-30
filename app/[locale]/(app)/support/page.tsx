'use client'

import { useState, useTransition } from 'react'
import {
  BookOpen,
  Users,
  Zap,
  CreditCard,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Send,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { submitSupportMessageAction } from '@/lib/actions/support.actions'

// ─── Topic data ───────────────────────────────────────────────────────────────

const TOPICS = [
  {
    id: 'studio',
    label: 'Studio and editor',
    icon: BookOpen,
    accent: 'var(--brand)',
    accentBg: 'rgba(255,195,0,0.10)',
    items: [
      {
        q: 'How do I create a new book?',
        a: 'Go to your Studio and click "New Book." You can start from scratch, choose a template, or import a manuscript from DOCX, PDF, or EPUB.',
      },
      {
        q: 'What is the binder?',
        a: 'The binder is the left panel in the Studio editor. It organises your book into chapters, parts, front and back matter, notes, and other documents. Drag items to reorder them.',
      },
      {
        q: 'How do I save my work?',
        a: 'The editor autosaves as you type. A small dot indicator in the status bar turns yellow while saving and disappears when everything is saved to the cloud.',
      },
      {
        q: 'What does chapter status mean?',
        a: 'Statuses (First Draft, Revised, Final) let you track readiness. Only chapters marked Revised or Final are visible to readers on the public reader page.',
      },
      {
        q: 'How do I export my book?',
        a: 'Click the export icon in the editor toolbar. You can export individual chapters or the whole book as DOCX, EPUB, or PDF. Premium subscribers can choose Manuscript or Basic formatting presets.',
      },
      {
        q: 'What is version history?',
        a: 'Premium subscribers can access version history from the editor toolbar. It shows timestamped snapshots of each chapter so you can review or restore an earlier draft.',
      },
    ],
  },
  {
    id: 'hives',
    label: 'Hives and collaboration',
    icon: Users,
    accent: 'oklch(0.62 0.15 240)',
    accentBg: 'oklch(0.62 0.15 240 / 0.10)',
    items: [
      {
        q: 'What is a Hive?',
        a: 'A Hive is a collaborative writing group attached to a book or a standalone community. Members can annotate chapters, suggest edits, submit their own chapters, share buzz posts, and track word goals together.',
      },
      {
        q: 'How do I invite someone to my Hive?',
        a: 'Open your Hive, go to Members, and copy the invite link. You can also set a membership role (Contributor, Moderator, Beta Reader) after someone joins.',
      },
      {
        q: 'What can a Beta Reader do?',
        a: 'Beta Readers have read-only access to the wiki, outline, and notes. They can read submitted chapters but cannot edit content or submit their own chapters.',
      },
      {
        q: 'How do annotations work?',
        a: 'Select any text in the chapter editor or hive chapter view and choose "Annotate." Pick a layer (Grammar, Plot, Tone, Continuity, or General) and add your note. Annotations appear in the collaboration gutter alongside the text.',
      },
    ],
  },
  {
    id: 'sparks',
    label: 'Sparks and community',
    icon: Zap,
    accent: 'oklch(0.70 0.18 55)',
    accentBg: 'oklch(0.70 0.18 55 / 0.10)',
    items: [
      {
        q: 'What is a Spark?',
        a: 'A Spark is a writing prompt contest. The creator sets a word limit and deadline. Other writers submit entries; the community votes, and the creator picks a winner.',
      },
      {
        q: 'How do I discover other writers and books?',
        a: 'Visit the Discover page to browse books, Hives, Sparks, lists, and clubs. Use the sidebar filters to narrow by genre, length, or status. Toggle "For You" for personalised recommendations based on your activity.',
      },
      {
        q: 'How do reading lists work?',
        a: 'You can create public or private reading lists to curate books you love. Others can follow your lists and discover books through them.',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Plans and billing',
    icon: CreditCard,
    accent: 'oklch(0.65 0.15 160)',
    accentBg: 'oklch(0.65 0.15 160 / 0.10)',
    items: [
      {
        q: 'What is included in the free plan?',
        a: 'The free plan lets you create up to 3 books, join Hives, enter Sparks, and use most community features. Premium unlocks unlimited books, version history, writing analysis, and more.',
      },
      {
        q: 'How do I upgrade to Premium?',
        a: 'Visit the Pricing page and choose a monthly or annual plan. Annual saves 37% compared to paying monthly. You will be taken to a secure Stripe checkout.',
      },
      {
        q: 'How do I manage or cancel my subscription?',
        a: 'Go to Settings and open the Billing tab. Click "Manage subscription" to open the Stripe billing portal where you can update your payment method, switch plans, or cancel.',
      },
      {
        q: 'What happens if I cancel?',
        a: 'You keep Premium access until the end of your billing period. After that your account reverts to the free plan. Your books and content are never deleted.',
      },
    ],
  },
]

// ─── Topic pill (FAQ column header) ───────────────────────────────────────────

function TopicPill({
  topic,
  active,
  onClick,
}: {
  topic: (typeof TOPICS)[0]
  active: boolean
  onClick: () => void
}) {
  const Icon = topic.icon
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: active
          ? `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`
          : 'var(--canvas-dark-300)',
        border: active ? `1.5px solid ${topic.accent}` : '1.5px solid transparent',
        borderRadius: 'var(--r-pill)',
        cursor: 'pointer',
        transition: 'background 120ms, border-color 120ms',
        boxShadow: active ? 'var(--sh-tile)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon
        size={15}
        style={{
          color: active ? topic.accent : 'var(--canvas-dark-ink-muted)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: active ? 700 : 500,
          fontSize: 13,
          color: active ? 'var(--canvas-dark-ink-strong)' : 'var(--canvas-dark-ink-muted)',
          transition: 'color 120ms, font-weight 120ms',
          lineHeight: 1.2,
        }}
      >
        {topic.label}
      </span>
    </button>
  )
}

// ─── FAQ accordion item ───────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '13px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--canvas-dark-ink)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 14,
        }}
        aria-expanded={open}
      >
        <span>{q}</span>
        {open ? (
          <ChevronUp size={15} style={{ flexShrink: 0, color: 'var(--canvas-dark-ink-muted)' }} />
        ) : (
          <ChevronDown size={15} style={{ flexShrink: 0, color: 'var(--canvas-dark-ink-muted)' }} />
        )}
      </button>
      {open && (
        <div
          style={{
            padding: '0 16px 14px',
            color: 'var(--canvas-dark-ink-muted)',
            fontSize: 14,
            lineHeight: 1.65,
          }}
        >
          {a}
        </div>
      )}
    </div>
  )
}

// ─── Contact form ─────────────────────────────────────────────────────────────

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

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--canvas-dark-ink-muted)',
  marginBottom: 6,
}

function ContactForm() {
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState<'general' | 'technical' | 'feedback'>('general')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await submitSupportMessageAction({ email, category, subject, message })
      if (result.success) {
        setSubmitted(true)
      } else {
        toast.error(result.error ?? 'Something went wrong. Please try again.')
      }
    })
  }

  if (submitted) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          padding: '32px 0',
          textAlign: 'center',
        }}
      >
        <CheckCircle2 size={44} style={{ color: 'var(--brand)' }} />
        <div>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 18,
              color: 'var(--canvas-dark-ink-strong)',
              marginBottom: 6,
            }}
          >
            Message sent
          </p>
          <p style={{ color: 'var(--canvas-dark-ink-muted)', fontSize: 14 }}>
            We received your message and will reply to {email} as soon as possible.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label htmlFor="support-email" style={LABEL_STYLE}>
            Your email
          </label>
          <input
            id="support-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={INPUT_STYLE}
            disabled={isPending}
          />
        </div>
        <div>
          <label htmlFor="support-category" style={LABEL_STYLE}>
            Category
          </label>
          <select
            id="support-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as 'general' | 'technical' | 'feedback')}
            style={{ ...INPUT_STYLE, cursor: 'pointer' }}
            disabled={isPending}
          >
            <option value="general">General question</option>
            <option value="technical">Technical support</option>
            <option value="feedback">Feedback or suggestion</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="support-subject" style={LABEL_STYLE}>
          Subject
        </label>
        <input
          id="support-subject"
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Briefly describe your question"
          style={INPUT_STYLE}
          disabled={isPending}
        />
      </div>
      <div>
        <label htmlFor="support-message" style={LABEL_STYLE}>
          Message
        </label>
        <textarea
          id="support-message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what happened, what you expected, and any steps to reproduce if relevant."
          style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.6 }}
          disabled={isPending}
        />
        <p
          style={{
            fontSize: 11,
            color: 'var(--canvas-dark-ink-muted)',
            marginTop: 4,
            textAlign: 'right',
          }}
        >
          {message.length} / 5000
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          disabled={isPending || !email || !subject || !message}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            borderRadius: 'var(--r-pill)',
            padding: '10px 22px',
            cursor: isPending ? 'wait' : 'pointer',
            opacity: isPending || !email || !subject || !message ? 0.55 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <Send size={14} />
          {isPending ? 'Sending...' : 'Send message'}
        </button>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [activeId, setActiveId] = useState('studio')
  const activeTopic = TOPICS.find((t) => t.id === activeId) ?? TOPICS[0]

  return (
    <div className="page-x tier-standard" style={{ paddingTop: 32, paddingBottom: 64 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 24,
            color: 'var(--brand)',
            margin: '0 0 4px',
          }}
        >
          Help and Support
        </h1>
        <p style={{ color: 'var(--canvas-dark-ink-muted)', fontSize: 14, margin: 0 }}>
          Browse answers by topic or send us a message.
        </p>
      </div>

      {/* Two-column layout: FAQ (wider) + sticky contact form.
          Columns use minmax(0, Nfr) so expanding an FAQ grows the panel
          downward only — the column width never changes. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* FAQ column */}
        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            padding: '20px 20px 24px',
            boxShadow: 'var(--sh-card)',
          }}
        >
          {/* Topic pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {TOPICS.map((topic) => (
              <TopicPill
                key={topic.id}
                topic={topic}
                active={topic.id === activeId}
                onClick={() => setActiveId(topic.id)}
              />
            ))}
          </div>

          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              paddingBottom: 14,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: activeTopic.accentBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <activeTopic.icon size={16} style={{ color: activeTopic.accent }} />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--canvas-dark-ink-strong)',
                  margin: 0,
                }}
              >
                {activeTopic.label}
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--canvas-dark-ink-muted)',
                  margin: 0,
                  letterSpacing: '0.05em',
                }}
              >
                {activeTopic.items.length} questions
              </p>
            </div>
          </div>

          {/* FAQ items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeTopic.items.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* Contact form column (sticky) */}
        <div
          style={{
            position: 'sticky',
            top: 80,
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            padding: '20px 20px 24px',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              paddingBottom: 14,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: 'rgba(255,195,0,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MessageSquare size={16} style={{ color: 'var(--brand)' }} />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--canvas-dark-ink-strong)',
                  margin: 0,
                }}
              >
                Still need help?
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--canvas-dark-ink-muted)',
                  margin: 0,
                }}
              >
                Send us a message and we will reply by email.
              </p>
            </div>
          </div>
          <ContactForm />
        </div>
      </div>
    </div>
  )
}
