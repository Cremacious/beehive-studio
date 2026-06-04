'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TiptapLink from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import { HiveAnnotationMark } from '@/lib/tiptap-extensions/hive-annotation-mark'
import { HiveSuggestionMark } from '@/lib/tiptap-extensions/hive-suggestion-mark'
import { SelectionPopover } from '@/components/hive/collab/selection-popover'
import { CollaborationGutter } from '@/components/hive/collab/collaboration-gutter'
import {
  canAnnotate as roleCanAnnotate,
  canSuggestEdits as roleCanSuggestEdits,
} from '@/lib/hive/permissions'
import type { HiveChapterViewData } from '@/lib/actions/hive-content.actions'
import { HiveSectionDivider } from '../../../_components/hive-section-divider'
import { ChapterMetadataHeader } from './chapter-metadata-header'

type Props = {
  data: HiveChapterViewData
  hiveId: string
  chapterId: string
  locale: string
  viewerUserId: string
}

export function HiveChapterSurface({
  data,
  hiveId,
  chapterId,
  viewerUserId,
}: Props) {
  const router = useRouter()

  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-brand underline cursor-pointer' },
      }),
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      HiveAnnotationMark,
      HiveSuggestionMark,
    ],
    content: (data.chapter.content as object | null) ?? null,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-full',
      },
    },
  })

  // router.refresh() doesn't re-mount the client gutter in Next 16, so the
  // useCollabData hook never re-fetches. Use a nonce instead — bumping it
  // forces the gutter's effect to re-run getChapterAnnotationsAction.
  const [collabRefreshNonce, setCollabRefreshNonce] = useState(0)
  const refresh = () => {
    router.refresh()
    setCollabRefreshNonce((n) => n + 1)
  }

  const viewerRole = data.viewerRole
  const canAnnotate = roleCanAnnotate(viewerRole)
  const canSuggestEdits = roleCanSuggestEdits(viewerRole)

  // status is always present (ChapterStatus enum), so metadata section
  // always renders. Synopsis + scene planner are optional inputs to the
  // header but the status pill alone is enough to anchor the section.
  const hasMetadata = true

  return (
    <div data-slot="hive-chapter-pane">
      <style>{`
        [data-slot="hive-chapter-pane"] {
          --sheet-canvas:     var(--background);
          --sheet-bg:         var(--canvas-dark-100);
          --sheet-ink:        var(--canvas-dark-ink);
          --sheet-ink-strong: var(--canvas-dark-ink-strong);
          --sheet-ink-muted:  var(--canvas-dark-ink-muted);
          --sheet-rule:       var(--canvas-dark-300);
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror {
          color: var(--sheet-ink-strong);
          font-family: var(--font-prose, var(--font-newsreader, Newsreader, serif));
          font-size: 18px;
          line-height: 1.78;
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror p {
          margin: 0 0 1.1em 0;
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror h1,
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror h2,
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror h3 {
          font-family: var(--font-comfortaa, Comfortaa, sans-serif);
          color: var(--sheet-ink-strong);
          margin: 1.6em 0 0.6em 0;
          font-weight: 700;
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror h1 { font-size: 1.9em; }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror h2 { font-size: 1.5em; }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror h3 { font-size: 1.2em; }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror em { font-style: italic; }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror strong { font-weight: 700; color: var(--sheet-ink-strong); }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror blockquote {
          border-left: 3px solid var(--color-brand);
          padding-left: 1em;
          margin: 1.2em 0;
          color: var(--sheet-ink);
          font-style: italic;
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror ul,
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0 0 1.1em 0;
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror li { margin: 0.2em 0; }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror hr {
          border: none;
          text-align: center;
          margin: 1.5em 0;
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .ProseMirror hr::before {
          content: '· · ·';
          color: var(--sheet-ink-muted);
          letter-spacing: 0.5em;
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .hive-annotation {
          background: oklch(from var(--color-brand) l c h / 0.18);
          border-bottom: 1px solid oklch(from var(--color-brand) l c h / 0.55);
        }
        [data-slot="hive-chapter-pane"] .hive-chapter-prose .hive-suggestion {
          background: oklch(from var(--color-brand) l c h / 0.10);
          border-bottom: 1px dashed oklch(from var(--color-brand) l c h / 0.55);
        }
      `}</style>

      {hasMetadata && (
        <HiveSectionDivider label="Metadata" hideTopBorder>
          <ChapterMetadataHeader
            status={data.status}
            synopsis={data.synopsis}
            scenePlanner={data.scenePlanner}
          />
        </HiveSectionDivider>
      )}

      <HiveSectionDivider label="Body">
        <div className="flex items-start gap-6">
          <div className="flex-1 min-w-0">
            <div
              className="hive-chapter-prose"
              style={{
                background: 'var(--canvas-dark-100)',
                boxShadow: 'var(--sh-inset)',
                borderRadius: 'var(--r-row)',
                padding: '26px 28px',
              }}
            >
              {editor ? (
                <EditorContent editor={editor} />
              ) : (
                <div className="text-sm text-muted-foreground">Loading…</div>
              )}
            </div>
          </div>
          <CollaborationGutter
            editor={editor}
            chapterId={chapterId}
            hiveId={hiveId}
            viewer={{
              id: viewerUserId,
              role: viewerRole,
              bookOwnerId: data.book.userId,
            }}
            refreshTrigger={collabRefreshNonce}
            inline
          />
        </div>
      </HiveSectionDivider>

      {editor ? (
        <SelectionPopover
          editor={editor}
          hiveId={hiveId}
          chapterId={chapterId}
          canAnnotate={canAnnotate}
          canSuggestEdits={canSuggestEdits}
          onAnnotationCreated={refresh}
          onSuggestionCreated={refresh}
        />
      ) : null}
    </div>
  )
}
