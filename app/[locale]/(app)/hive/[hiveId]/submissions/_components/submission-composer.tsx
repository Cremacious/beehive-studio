'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TipTapLink from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  saveSubmissionDraftAction,
  submitSubmissionAction,
} from '@/lib/actions/hive-submissions.actions'
import { extractWordCount } from '@/lib/tiptap-utils'
import { SaveStatusBadge, type FormSaveStatus } from '@/app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/save-status-badge'
import { HivePageShell } from '../../_components/hive-page-shell'
import { ComposerToolbar } from './composer-toolbar'

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

  const canSubmit =
    editable &&
    submissionId !== null &&
    wordCount > 0 &&
    title.trim().length > 0 &&
    !submitting

  const shellTitle =
    mode === 'new'
      ? title.trim() || 'New submission'
      : title.trim() || 'Untitled submission'

  return (
    <HivePageShell
      width="standard"
      title={shellTitle}
      subtitle="Draft · Auto-saves as you type"
      back={{ href: `/${locale}/hive/${hiveId}/submissions`, label: 'submissions' }}
    >
      <div data-slot="submission-composer-pane">
        <style>{`
          [data-slot="submission-composer-pane"] .ProseMirror {
            color: var(--canvas-dark-ink);
            caret-color: var(--brand);
            outline: none;
            font-family: var(--font-prose, var(--font-newsreader, serif));
            font-size: 18px;
            line-height: 1.78;
            min-height: 240px;
          }
          [data-slot="submission-composer-pane"] .ProseMirror p { margin: 0 0 1.1em; text-wrap: pretty; }
          [data-slot="submission-composer-pane"] .ProseMirror p:last-child { margin-bottom: 0; }
          [data-slot="submission-composer-pane"] .ProseMirror h1,
          [data-slot="submission-composer-pane"] .ProseMirror h2,
          [data-slot="submission-composer-pane"] .ProseMirror h3 {
            color: var(--canvas-dark-ink-strong);
            font-family: var(--font-display);
            font-weight: 700;
          }
          [data-slot="submission-composer-pane"] .ProseMirror strong { color: var(--canvas-dark-ink-strong); font-weight: 600; }
          [data-slot="submission-composer-pane"] .ProseMirror blockquote {
            color: var(--canvas-dark-ink-muted);
            border-left: 3px solid oklch(from var(--brand) l c h / 0.55);
            padding-left: 0.9em; margin: 0.6em 0;
          }
          [data-slot="submission-composer-pane"] .ProseMirror ul,
          [data-slot="submission-composer-pane"] .ProseMirror ol { padding-left: 1.4em; margin: 0 0 1em; }
          [data-slot="submission-composer-pane"] .ProseMirror ul { list-style: disc; }
          [data-slot="submission-composer-pane"] .ProseMirror ol { list-style: decimal; }
          [data-slot="submission-composer-pane"] [data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: var(--canvas-dark-ink-muted);
            pointer-events: none;
          }
        `}</style>

        <div className="px-6 py-5">
          <div className="flex flex-col gap-4">
            {/* Save status row */}
            <div className="flex items-center justify-between gap-3">
              {editable ? (
                <SaveStatusBadge status={saveStatus} />
              ) : (
                <span
                  className="text-xs italic"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  This submission is locked. Already submitted.
                </span>
              )}
              <span
                className="font-mono text-[11px]"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {wordCount.toLocaleString()} words
              </span>
            </div>

            {/* Chapter title — required */}
            <div>
              <label
                htmlFor="submission-title"
                className="block mb-[7px] font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                Chapter title{' '}
                <span style={{ color: 'var(--status-error)' }}>*</span>
              </label>
              <input
                id="submission-title"
                type="text"
                value={title}
                disabled={!editable}
                placeholder="Give your chapter a title before submitting"
                aria-required="true"
                aria-invalid={editable && title.trim() === ''}
                onChange={(e) => {
                  setTitle(e.target.value)
                  titleRef.current = e.target.value
                  scheduleSave()
                }}
                className="w-full outline-none disabled:opacity-60"
                style={{
                  background: 'var(--canvas-dark-100)',
                  boxShadow:
                    editable && title.trim() === ''
                      ? 'inset 0 0 0 1px oklch(from var(--status-error) l c h / 0.5), var(--sh-inset)'
                      : 'var(--sh-inset)',
                  border: 0,
                  borderRadius: 'var(--r-row)',
                  padding: '11px 14px',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  color: 'var(--canvas-dark-ink-strong)',
                }}
              />
              {editable && title.trim() === '' && (
                <p
                  className="mt-1.5 text-[12px]"
                  style={{ color: 'var(--status-error)' }}
                >
                  A title is required. This becomes the chapter&apos;s name in
                  the book if approved.
                </p>
              )}
            </div>

            {/* Insert at */}
            <div>
              <label
                className="block mb-[7px] font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                Insert at
              </label>
              <select
                value={encodeTarget(targetOrder)}
                disabled={!editable}
                onChange={(e) => {
                  const v = decodeTarget(e.target.value)
                  setTargetOrder(v)
                  targetOrderRef.current = v
                  scheduleSave()
                }}
                className="w-full outline-none disabled:opacity-60"
                style={{
                  padding: '11px 14px',
                  border: 0,
                  borderRadius: 'var(--r-row)',
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'var(--sh-inset)',
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  appearance: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">End (default)</option>
                <option value="0">Beginning</option>
                {chapters.map((c) => (
                  <option key={c.id} value={String(c.order + 1)}>
                    After &quot;{c.title || 'Untitled chapter'}&quot;
                  </option>
                ))}
              </select>
            </div>

            {/* Body */}
            <div>
              <label
                className="block mb-[7px] font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                Body
              </label>
              {editable && <ComposerToolbar editor={editor} />}
              <div
                style={{
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'var(--sh-inset)',
                  borderRadius: editable
                    ? '0 0 var(--r-row) var(--r-row)'
                    : 'var(--r-row)',
                  padding: '18px 22px',
                  minHeight: '240px',
                }}
              >
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  borderRadius: 'var(--r-pill)',
                  boxShadow: 'var(--sh-tile)',
                  transition: 'background .14s, transform .1s',
                }}
                onMouseEnter={(e) => {
                  if (!canSubmit) return
                  e.currentTarget.style.background = 'var(--brand-hover)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--brand)'
                  e.currentTarget.style.transform = 'none'
                }}
                onMouseDown={(e) => {
                  if (!canSubmit) return
                  e.currentTarget.style.background = 'var(--brand-active)'
                  e.currentTarget.style.transform = 'none'
                }}
                onMouseUp={(e) => {
                  if (!canSubmit) return
                  e.currentTarget.style.background = 'var(--brand-hover)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </HivePageShell>
  )
}
