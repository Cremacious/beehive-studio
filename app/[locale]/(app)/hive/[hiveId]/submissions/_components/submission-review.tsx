'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TipTapLink from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import { ChevronLeft, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  approveSubmissionAction,
  rejectSubmissionAction,
  type GetSubmissionData,
} from '@/lib/actions/hive-submissions.actions'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
        toast.success('Approved — chapter added to the book')
        router.push(`/${locale}/studio/${book.id}`)
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

  return (
    <main
      data-slot="submission-read-pane"
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--composer-canvas)' }}
    >
      <ReadOnlyBodyStyles />
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-5">
        <header className="flex items-center justify-between">
          <Link
            href={`/${locale}/hive/${hiveId}/submissions`}
            className="composer-muted text-[11px] uppercase tracking-wide inline-flex items-center gap-1 hover:text-brand"
          >
            <ChevronLeft size={12} /> Back to submissions
          </Link>
        </header>

        <SubmissionMetaHeader submission={submission} submitter={submitter} />

        <section className="composer-card rounded-lg p-6">
          <EditorContent editor={editor} />
        </section>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setRejectOpen(true)}
            disabled={approving || rejecting}
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
          >
            <X size={14} /> Reject
          </Button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving || rejecting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-brand)',
              color: 'var(--brand-ink, oklch(0.18 0.02 60))',
            }}
          >
            <Check size={14} />
            {approving ? 'Approving…' : 'Approve'}
          </button>
        </div>
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
    </main>
  )
}
