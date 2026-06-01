'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
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
  type HiveRole,
} from '@/lib/hive/permissions'
import type { HiveChapterViewData } from '@/lib/actions/hive-content.actions'

type Props = {
  data: HiveChapterViewData
  hiveId: string
  chapterId: string
  locale: string
  viewerUserId: string
}

const ROLE_LABEL: Record<HiveRole, string> = {
  OWNER: 'Owner',
  MODERATOR: 'Moderator',
  CONTRIBUTOR: 'Contributor',
  BETA_READER: 'Beta Reader',
}

export function HiveChapterSurface({
  data,
  hiveId,
  chapterId,
  locale,
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

  const refresh = () => router.refresh()

  const viewerRole = data.viewerRole
  const canAnnotate = roleCanAnnotate(viewerRole)
  const canSuggestEdits = roleCanSuggestEdits(viewerRole)

  const isContribution =
    !!data.author && data.author.userId !== data.book.userId

  return (
    <main
      data-slot="hive-chapter-pane"
      className="flex-1 flex flex-col overflow-hidden"
    >
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

      {/* Header */}
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
          <Link
            href={`/${locale}/hive/${hiveId}`}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ChevronLeft className="w-3 h-3" />
            {data.hive.name}
          </Link>
          <span aria-hidden>›</span>
          <span>Chapters</span>
          <span aria-hidden>›</span>
          <span className="text-foreground/80 truncate">{data.chapter.title}</span>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-comfortaa font-bold text-2xl text-foreground truncate">
              {data.chapter.title}
            </h1>
            <p className="mt-1 text-sm italic text-muted-foreground">
              {isContribution ? (
                <>
                  Written by{' '}
                  <span className="font-medium not-italic text-foreground/90">
                    @{data.author?.username ?? 'unknown'}
                  </span>
                  {' '}— chapter contribution to{' '}
                  <span className="not-italic">{data.book.title}</span>
                  {data.book.ownerUsername ? (
                    <>
                      {' '}by{' '}
                      <span className="font-medium not-italic text-foreground/90">
                        @{data.book.ownerUsername}
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  Chapter from <span className="not-italic">{data.book.title}</span>
                  {data.book.ownerUsername ? (
                    <>
                      {' '}by{' '}
                      <span className="font-medium not-italic text-foreground/90">
                        @{data.book.ownerUsername}
                      </span>
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
            style={{
              background: 'oklch(from var(--color-brand) l c h / 0.15)',
              color: 'var(--color-brand)',
              border: '1px solid oklch(from var(--color-brand) l c h / 0.35)',
            }}
          >
            {ROLE_LABEL[viewerRole]}
          </span>
        </div>
      </header>

      {/* Body: prose + gutter */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="hive-chapter-prose mx-auto max-w-[720px] px-8 py-10">
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
        />
      </div>

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
    </main>
  )
}
