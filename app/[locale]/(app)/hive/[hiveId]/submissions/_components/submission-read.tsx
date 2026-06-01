'use client'

import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TipTapLink from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import { ChevronLeft } from 'lucide-react'
import type { GetSubmissionData } from '@/lib/actions/hive-submissions.actions'
import {
  SubmissionMetaHeader,
  ReadOnlyBodyStyles,
  ApprovedChapterLink,
} from './submission-shared'

type Props = {
  submission: GetSubmissionData['submission']
  submitter: GetSubmissionData['submitter']
  book: GetSubmissionData['book']
  hiveId: string
  locale: string
}

export function SubmissionRead({ submission, submitter, book, hiveId, locale }: Props) {
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

        {submission.draftStatus === 'APPROVED' && (
          <section className="composer-card rounded-lg p-4 flex items-center justify-between gap-3">
            <div>
              <p className="composer-title text-sm font-semibold">Chapter created</p>
              <p className="composer-muted text-xs">
                This submission was approved and added to the book.
              </p>
            </div>
            <ApprovedChapterLink
              locale={locale}
              bookId={book.id}
              createdChapterId={submission.createdChapterId}
            />
          </section>
        )}

        {submission.draftStatus === 'REJECTED' && (
          <section className="composer-card rounded-lg p-4">
            <p className="composer-title text-sm font-semibold mb-1">Review note</p>
            <p className="composer-ink text-sm whitespace-pre-wrap" style={{ color: 'var(--composer-ink)' }}>
              {submission.reviewNote || '(No note left by the reviewer.)'}
            </p>
          </section>
        )}

        {submission.draftStatus === 'PENDING' && (
          <section className="composer-card rounded-lg p-4">
            <p className="composer-muted text-sm italic">
              Awaiting review by the hive owner.
            </p>
          </section>
        )}

        <section className="composer-card rounded-lg p-6">
          <EditorContent editor={editor} />
        </section>
      </div>
    </main>
  )
}
