'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TipTapLink from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  approveSubmissionAction,
  rejectSubmissionAction,
  type GetSubmissionData,
} from '@/lib/actions/hive-submissions.actions'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HiveSectionDivider } from '../../_components/hive-section-divider'
import { SubmissionMetaHeader, ReadOnlyBodyStyles } from './submission-shared'

type Props = {
  submission: GetSubmissionData['submission']
  submitter: GetSubmissionData['submitter']
  book: GetSubmissionData['book']
  hiveId: string
  locale: string
}

export function SubmissionReview({ submission, submitter, book, hiveId, locale }: Props) {
  const router = useRouter()
  const [approving, setApproving] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      TipTapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-brand underline cursor-pointer' },
      }),
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: submission.content as Parameters<typeof useEditor>[0]['content'],
  })

  async function handleApprove() {
    if (approving) return
    setApproving(true)
    try {
      const r = await approveSubmissionAction({ id: submission.id })
      if (r.success) {
        toast.success('Approved. Chapter added to the book.')
        router.refresh()
      } else {
        toast.error(`Could not approve: ${r.error}`)
      }
    } finally {
      setApproving(false)
    }
  }

  async function handleReject() {
    if (rejecting) return
    const note = rejectNote.trim()
    if (!note) {
      toast.error('A reason is required to reject.')
      return
    }
    setRejecting(true)
    try {
      const r = await rejectSubmissionAction({ id: submission.id, reviewNote: note })
      if (r.success) {
        toast.success('Submission rejected')
        setRejectOpen(false)
        router.refresh()
      } else {
        toast.error(`Could not reject: ${r.error}`)
      }
    } finally {
      setRejecting(false)
    }
  }

  const busy = approving || rejecting

  const approveRejectGroup = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleApprove}
        disabled={busy}
        style={{
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--sh-tile)',
          transition: 'background .14s, transform .1s',
        }}
        onMouseEnter={(e) => {
          if (busy) return
          e.currentTarget.style.background = 'var(--brand-hover)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--brand)'
          e.currentTarget.style.transform = 'none'
        }}
        onMouseDown={(e) => {
          if (busy) return
          e.currentTarget.style.background = 'var(--brand-active)'
          e.currentTarget.style.transform = 'none'
        }}
        onMouseUp={(e) => {
          if (busy) return
          e.currentTarget.style.background = 'var(--brand-hover)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Check size={14} />
        {approving ? 'Approving…' : 'Approve'}
      </button>
      <button
        type="button"
        onClick={() => setRejectOpen(true)}
        disabled={busy}
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          color: 'var(--status-error)',
          border: '1px solid oklch(from var(--status-error) l c h / 0.3)',
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--sh-tile)',
          transition: 'color .14s, transform .1s',
        }}
        onMouseEnter={(e) => {
          if (busy) return
          e.currentTarget.style.color =
            'oklch(from var(--status-error) calc(l + 0.08) c h)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--status-error)'
          e.currentTarget.style.transform = 'none'
        }}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <X size={14} />
        Reject
      </button>
    </div>
  )

  return (
    <HivePageShell
      width="standard"
      title={submission.title || 'Untitled submission'}
      subtitle={`Pending review from @${submitter.username ?? 'unknown'}`}
      back={{ href: `/${locale}/hive/${hiveId}/submissions`, label: 'submissions' }}
      headerSlot={approveRejectGroup}
    >
      <div data-slot="submission-read-pane">
        <ReadOnlyBodyStyles />
        <HiveSectionDivider label="Submission" hideTopBorder>
          <SubmissionMetaHeader submission={submission} submitter={submitter} />
        </HiveSectionDivider>
        <HiveSectionDivider label="Body">
          <div
            style={{
              background: 'var(--canvas-dark-100)',
              boxShadow: 'var(--sh-inset)',
              borderRadius: 'var(--r-row)',
              padding: '22px 26px',
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </HiveSectionDivider>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>
              Reject submission
            </DialogTitle>
            <DialogDescription>
              Leave a note so the submitter understands what to revise.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="What needs to change?"
            rows={5}
            disabled={rejecting}
          />
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReject}
              disabled={rejecting || rejectNote.trim().length === 0}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {rejecting ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HivePageShell>
  )
}
