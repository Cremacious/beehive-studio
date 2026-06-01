'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TipTapLink from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import { ChevronLeft, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  saveSubmissionDraftAction,
  submitSubmissionAction,
} from '@/lib/actions/hive-submissions.actions'
import { extractWordCount } from '@/lib/tiptap-utils'
import { SaveStatusBadge, type FormSaveStatus } from '@/app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/save-status-badge'

type ChapterRef = { id: string; title: string; order: number }

type ComposerProps = {
  mode: 'new' | 'existing'
  hiveId: string
  locale: string
  chapters: ChapterRef[]
  initial?: {
    id: string
    title: string
    content: unknown
    targetChapterOrder: number | null
    wordCount: number
    draftStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  }
}

/**
 * Encodes targetChapterOrder as a string for the <select>:
 *   ''      → null (end)
 *   '0'     → 0 (beginning)
 *   'N'     → N (insert at order N)
 */
function encodeTarget(v: number | null): string {
  if (v === null) return ''
  return String(v)
}
function decodeTarget(v: string): number | null {
  if (v === '') return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export function SubmissionComposer({
  mode,
  hiveId,
  locale,
  chapters,
  initial,
}: ComposerProps) {
  const router = useRouter()
  const [submissionId, setSubmissionId] = useState<string | null>(initial?.id ?? null)
  const [title, setTitle] = useState<string>(initial?.title ?? '')
  const [targetOrder, setTargetOrder] = useState<number | null>(
    initial?.targetChapterOrder ?? null,
  )
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const [wordCount, setWordCount] = useState<number>(initial?.wordCount ?? 0)
  const [submitting, setSubmitting] = useState(false)

  // refs hold the latest values for the debounced save closure
  const titleRef = useRef(title)
  const targetOrderRef = useRef(targetOrder)
  const submissionIdRef = useRef(submissionId)
  const contentRef = useRef<unknown>(initial?.content ?? { type: 'doc', content: [] })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflightRef = useRef<Promise<void> | null>(null)

  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { targetOrderRef.current = targetOrder }, [targetOrder])
  useEffect(() => { submissionIdRef.current = submissionId }, [submissionId])

  const editable = mode === 'new' || initial?.draftStatus === 'DRAFT'

  const performSave = useCallback(async (): Promise<void> => {
    setSaveStatus('saving')
    const result = await saveSubmissionDraftAction({
      submissionId: submissionIdRef.current ?? undefined,
      hiveId,
      title: titleRef.current,
      content: contentRef.current,
      targetChapterOrder: targetOrderRef.current,
    })
    if (result.success) {
      setSaveStatus('saved')
      if (!submissionIdRef.current) {
        const newId = result.data.id
        submissionIdRef.current = newId
        setSubmissionId(newId)
        // Replace URL so subsequent reloads land on the canonical dynamic page.
        router.replace(`/${locale}/hive/${hiveId}/submissions/${newId}`)
      }
    } else {
      setSaveStatus('unsaved')
      toast.error(`Save failed: ${result.error}`)
    }
  }, [hiveId, locale, router])

  const scheduleSave = useCallback(() => {
    if (!editable) return
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      // Chain off any in-flight save to avoid races.
      const run = async () => {
        if (inflightRef.current) await inflightRef.current
        const p = performSave()
        inflightRef.current = p
        try { await p } finally { inflightRef.current = null }
      }
      void run()
    }, 800)
  }, [editable, performSave])

  const editor = useEditor({
    immediatelyRender: false,
    editable,
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
    content: (initial?.content ?? null) as Parameters<typeof useEditor>[0]['content'],
    onUpdate({ editor: e }) {
      if (e.isDestroyed) return
      const json = e.getJSON()
      contentRef.current = json
      setWordCount(extractWordCount(json))
      scheduleSave()
    },
  })

  async function flushPending(): Promise<void> {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    if (inflightRef.current) await inflightRef.current
    await performSave()
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      await flushPending()
      const id = submissionIdRef.current
      if (!id) {
        toast.error('Could not save draft. Please try again.')
        return
      }
      const result = await submitSubmissionAction({ id })
      if (result.success) {
        toast.success('Submitted for review')
        router.push(`/${locale}/hive/${hiveId}/submissions/${id}`)
        router.refresh()
      } else {
        toast.error(`Could not submit: ${result.error}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = editable && submissionId !== null && wordCount > 0 && !submitting

  return (
    <main
      data-slot="submission-composer-pane"
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--composer-canvas)' }}
    >
      <style>{`
        [data-slot="submission-composer-pane"] {
          --composer-canvas:    oklch(0.22 0.005 256);
          --composer-card-bg:   var(--paper-100);
          --composer-card-bord: var(--paper-300);
          --composer-ink:       var(--paper-ink);
          --composer-ink-strong:var(--paper-ink-strong);
          --composer-ink-muted: var(--paper-ink-muted);
        }
        [data-editor-theme="light"] [data-slot="submission-composer-pane"] {
          --composer-canvas:    var(--paper-300);
          --composer-card-bg:   var(--paper-50);
          --composer-card-bord: var(--paper-200);
        }
        [data-slot="submission-composer-pane"] .composer-card {
          background: var(--composer-card-bg);
          border: 1px solid var(--composer-card-bord);
        }
        [data-slot="submission-composer-pane"] .composer-title { color: var(--composer-ink-strong); }
        [data-slot="submission-composer-pane"] .composer-muted { color: var(--composer-ink-muted); }
        [data-slot="submission-composer-pane"] .ProseMirror {
          color: var(--composer-ink);
          caret-color: var(--color-brand);
          outline: none;
          font-family: var(--font-prose, var(--font-newsreader, serif));
          font-size: 17px;
          line-height: 1.7;
          min-height: 360px;
        }
        [data-slot="submission-composer-pane"] .ProseMirror p { margin: 0 0 1em; }
        [data-slot="submission-composer-pane"] .ProseMirror h1,
        [data-slot="submission-composer-pane"] .ProseMirror h2,
        [data-slot="submission-composer-pane"] .ProseMirror h3 {
          color: var(--composer-ink-strong);
          font-family: var(--font-display);
          font-weight: 700;
        }
        [data-slot="submission-composer-pane"] .ProseMirror strong { color: var(--composer-ink-strong); font-weight: 600; }
        [data-slot="submission-composer-pane"] .ProseMirror blockquote {
          color: var(--composer-ink-muted);
          border-left: 3px solid oklch(0.78 0.04 60 / 0.45);
          padding-left: 0.9em; margin: 0.6em 0;
        }
        [data-slot="submission-composer-pane"] .ProseMirror ul,
        [data-slot="submission-composer-pane"] .ProseMirror ol { padding-left: 1.4em; margin: 0 0 1em; }
        [data-slot="submission-composer-pane"] .ProseMirror ul { list-style: disc; }
        [data-slot="submission-composer-pane"] .ProseMirror ol { list-style: decimal; }
      `}</style>

      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-5">
        <header className="flex items-center justify-between">
          <Link
            href={`/${locale}/hive/${hiveId}/submissions`}
            className="composer-muted text-[11px] uppercase tracking-wide inline-flex items-center gap-1 hover:text-brand"
          >
            <ChevronLeft size={12} /> Submissions {mode === 'new' ? '› New' : `› ${title || 'Untitled'}`}
          </Link>
          <SaveStatusBadge status={saveStatus} />
        </header>

        <section className="composer-card rounded-lg p-6 space-y-4">
          <div
            role="textbox"
            contentEditable={editable}
            suppressContentEditableWarning
            spellCheck
            data-placeholder="Untitled submission"
            className="composer-title font-comfortaa font-bold text-2xl outline-none"
            onBlur={e => {
              const next = (e.currentTarget.textContent ?? '').trim()
              if (next !== title) {
                setTitle(next)
                titleRef.current = next
                scheduleSave()
              }
            }}
          >
            {initial?.title ?? ''}
          </div>

          <div className="flex items-center gap-3 flex-wrap text-[11px] composer-muted">
            <label className="inline-flex items-center gap-2">
              <span className="uppercase tracking-wide">Insert at</span>
              <select
                value={encodeTarget(targetOrder)}
                disabled={!editable}
                onChange={e => {
                  const v = decodeTarget(e.target.value)
                  setTargetOrder(v)
                  targetOrderRef.current = v
                  scheduleSave()
                }}
                className="bg-transparent border border-border rounded px-2 py-1 text-xs"
                style={{ color: 'var(--composer-ink)' }}
              >
                <option value="">End (default)</option>
                <option value="0">Beginning</option>
                {chapters.map(c => (
                  <option key={c.id} value={String(c.order + 1)}>
                    After &quot;{c.title || 'Untitled chapter'}&quot;
                  </option>
                ))}
              </select>
            </label>
            <span>·</span>
            <span>{wordCount.toLocaleString()} words</span>
          </div>
        </section>

        <section className="composer-card rounded-lg p-6">
          <EditorContent editor={editor} />
        </section>

        <div className="flex items-center justify-end gap-2 pt-2">
          {!editable && (
            <span className="composer-muted text-xs italic">
              This submission is locked — already submitted.
            </span>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-brand)',
              color: 'var(--brand-ink, oklch(0.18 0.02 60))',
            }}
          >
            <Send size={14} />
            Submit for review
          </button>
        </div>
      </div>
    </main>
  )
}
