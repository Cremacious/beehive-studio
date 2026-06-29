'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TipTapLink from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import type { GetSubmissionData } from '@/lib/actions/hive-submissions.actions'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HiveSectionDivider } from '../../_components/hive-section-divider'
import {
  SubmissionMetaHeader,
  ReadOnlyBodyStyles,
  ApprovedChapterLink,
  StatusPill,
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
    <HivePageShell
      width="standard"
      title={submission.title || 'Untitled submission'}
      subtitle={`Submitted by @${submitter.username ?? 'unknown'}`}
      back={{ href: `/${locale}/hive/${hiveId}/submissions`, label: 'submissions' }}
      headerSlot={<StatusPill status={submission.draftStatus} />}
      mobileBleed
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

        {submission.draftStatus === 'REJECTED' && (
          <HiveSectionDivider label="Review note" tone="danger">
            <div
              style={{
                background: 'var(--canvas-dark-100)',
                boxShadow: 'var(--sh-inset)',
                borderRadius: 'var(--r-row)',
                padding: '16px 18px',
              }}
            >
              <p
                className="text-sm whitespace-pre-wrap m-0"
                style={{ color: 'var(--canvas-dark-ink)' }}
              >
                {submission.reviewNote || '(No note left by the reviewer.)'}
              </p>
            </div>
          </HiveSectionDivider>
        )}

        {submission.draftStatus === 'APPROVED' && (
          <HiveSectionDivider label="Approved chapter">
            <div className="flex items-center justify-between gap-3">
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
            </div>
          </HiveSectionDivider>
        )}

        {submission.draftStatus === 'PENDING' && (
          <HiveSectionDivider label="Status">
            <p
              className="text-sm italic"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Awaiting review by the hive owner.
            </p>
          </HiveSectionDivider>
        )}
      </div>
    </HivePageShell>
  )
}
