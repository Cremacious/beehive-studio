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
    >
      <ReadOnlyBodyStyles />
      <div className="mx-auto max-w-[760px] p-6">
        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            border: 'var(--br-card)',
          }}
          className="p-6 space-y-5"
        >
          <header className="flex items-center justify-between">
            <Link
              href={`/${locale}/hive/${hiveId}/submissions`}
              className="text-[11px] uppercase tracking-wide inline-flex items-center gap-1 hover:text-[var(--canvas-dark-ink-strong)] transition-colors"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              <ChevronLeft size={12} /> Back to submissions
            </Link>
          </header>

          <h1
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-bold text-2xl"
          >
            Submission
          </h1>

          <SubmissionMetaHeader submission={submission} submitter={submitter} />

          {submission.draftStatus === 'APPROVED' && (
            <section
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-tile)',
                border: 'var(--br-card)',
              }}
              className="p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--canvas-dark-ink-strong)' }}
                >
                  Chapter created
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
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
            <section
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-tile)',
                border: 'var(--br-card)',
              }}
              className="p-4"
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                Review note
              </p>
              <p
                className="text-sm whitespace-pre-wrap"
                style={{ color: 'var(--canvas-dark-ink)' }}
              >
                {submission.reviewNote || '(No note left by the reviewer.)'}
              </p>
            </section>
          )}

          {submission.draftStatus === 'PENDING' && (
            <section
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-tile)',
                border: 'var(--br-card)',
              }}
              className="p-4"
            >
              <p
                className="text-sm italic"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Awaiting review by the hive owner.
              </p>
            </section>
          )}

          <section
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-tile)',
              border: 'var(--br-card)',
            }}
            className="p-6"
          >
            <EditorContent editor={editor} />
          </section>
        </div>
      </div>
    </main>
  )
}
