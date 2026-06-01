'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import type {
  AnnotationLayer,
  GetAnnotationsForHiveData,
  HiveAnnotationsByChapter,
  HiveAnnotationItem,
} from '@/lib/actions/hive-annotations.actions'
import { relTime } from '@/components/hive/collab/rel-time'

type Props = {
  data: GetAnnotationsForHiveData
  hiveId: string
  locale: string
}

type LayerMeta = {
  layer: AnnotationLayer
  label: string
  dot: string
}

const LAYER_META: LayerMeta[] = [
  { layer: 'GRAMMAR', label: 'Grammar', dot: 'oklch(0.72 0.10 165)' },
  { layer: 'PLOT', label: 'Plot', dot: 'oklch(0.72 0.13 25)' },
  { layer: 'TONE', label: 'Tone', dot: 'oklch(0.72 0.13 290)' },
  { layer: 'CONTINUITY', label: 'Continuity', dot: 'oklch(0.72 0.10 200)' },
  { layer: 'GENERAL', label: 'General', dot: 'oklch(0.74 0.13 80)' },
]

const LAYER_META_BY_KEY: Record<AnnotationLayer, LayerMeta> = LAYER_META.reduce(
  (acc, m) => {
    acc[m.layer] = m
    return acc
  },
  {} as Record<AnnotationLayer, LayerMeta>,
)

const MAX_SELECTED = 100

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s
}

export function AnnotationsByChapter({ data, hiveId, locale }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [activeLayers, setActiveLayers] = useState<Set<AnnotationLayer>>(new Set())
  const [showResolved, setShowResolved] = useState(false)

  function toggle(chapterId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  function toggleLayer(layer: AnnotationLayer) {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  const allLayersActive = activeLayers.size === 0

  const filtered: HiveAnnotationsByChapter[] = useMemo(() => {
    const out: HiveAnnotationsByChapter[] = []
    for (const group of data.byChapter) {
      const annotations = group.annotations.filter((a) => {
        if (!showResolved && a.resolved) return false
        if (!allLayersActive && !activeLayers.has(a.layer)) return false
        return true
      })
      if (annotations.length > 0) {
        out.push({ ...group, annotations })
      }
    }
    return out
  }, [data.byChapter, activeLayers, showResolved, allLayersActive])

  const visibleCount = filtered.reduce((sum, g) => sum + g.annotations.length, 0)

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-comfortaa font-bold text-2xl text-foreground">
                Annotations
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Commentary from hive members across all chapters.
              </p>
            </div>
            {visibleCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: 'var(--color-brand)',
                  color: 'var(--brand-ink, oklch(0.18 0.02 60))',
                }}
              >
                {visibleCount}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <Pill active={allLayersActive} onClick={() => setActiveLayers(new Set())}>
              All
            </Pill>
            {LAYER_META.map((m) => (
              <Pill
                key={m.layer}
                active={activeLayers.has(m.layer)}
                onClick={() => toggleLayer(m.layer)}
                dot={m.dot}
              >
                {m.label}
              </Pill>
            ))}
            <span className="mx-1 h-5 w-px self-center bg-border" aria-hidden="true" />
            <Pill active={showResolved} onClick={() => setShowResolved((v) => !v)}>
              Show resolved
            </Pill>
          </div>
        </header>

        {data.byChapter.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-base font-medium text-foreground">No annotations yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Hive members can leave annotations on any chapter.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-base font-medium text-foreground">
              No annotations match the current filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((group) => (
              <ChapterGroup
                key={group.chapterId}
                group={group}
                hiveId={hiveId}
                locale={locale}
                collapsed={collapsed.has(group.chapterId)}
                onToggle={() => toggle(group.chapterId)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function ChapterGroup({
  group,
  hiveId,
  locale,
  collapsed,
  onToggle,
}: {
  group: HiveAnnotationsByChapter
  hiveId: string
  locale: string
  collapsed: boolean
  onToggle: () => void
}) {
  const chapterHref = `/${locale}/hive/${hiveId}/chapters/${group.chapterId}`

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand chapter' : 'Collapse chapter'}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <Link
          href={chapterHref}
          className="font-comfortaa font-bold text-base text-foreground hover:text-brand hover:underline"
        >
          {group.chapterTitle}
        </Link>
        <span className="text-xs text-muted-foreground">
          ({group.annotations.length})
        </span>
      </div>
      {!collapsed && (
        <ul className="divide-y divide-border">
          {group.annotations.map((a) => (
            <AnnotationRow
              key={a.id}
              annotation={a}
              chapterId={group.chapterId}
              hiveId={hiveId}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function AnnotationRow({
  annotation,
  chapterId,
  hiveId,
  locale,
}: {
  annotation: HiveAnnotationItem
  chapterId: string
  hiveId: string
  locale: string
}) {
  const meta = LAYER_META_BY_KEY[annotation.layer]
  const authorLabel = annotation.author.username
    ? `@${annotation.author.username}`
    : annotation.author.displayName ?? 'Unknown'
  const openHref = `/${locale}/hive/${hiveId}/chapters/${chapterId}#ann-${annotation.id}`

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      {annotation.author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={annotation.author.avatarUrl}
          alt=""
          className="size-7 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="size-7 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
          {(annotation.author.username ?? '?').slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span className="font-medium text-foreground">{authorLabel}</span>
          <span>·</span>
          <span>{relTime(annotation.createdAt)}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: meta.dot }}
            />
            <span>{meta.label}</span>
          </span>
          {annotation.hasReplies && (
            <>
              <span>·</span>
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold"
                title="This annotation has replies"
              >
                <MessageSquare size={10} />
                Has replies
              </span>
            </>
          )}
          {annotation.resolved && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground"
              title={
                annotation.resolvedAt
                  ? `Resolved ${relTime(annotation.resolvedAt)}`
                  : 'Resolved'
              }
            >
              <CheckCircle2 size={10} />
              Resolved
            </span>
          )}
        </div>
        <div className="text-sm leading-relaxed break-words text-foreground line-clamp-2">
          {annotation.body}
        </div>
        {annotation.selectedText && (
          <div className="mt-1 text-xs italic text-muted-foreground break-words">
            “{truncate(annotation.selectedText, MAX_SELECTED)}”
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Link
          href={openHref}
          aria-label="Open in chapter"
          title="Open in chapter"
          className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink size={16} />
        </Link>
      </div>
    </li>
  )
}

function Pill({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean
  onClick: () => void
  dot?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition ' +
        (active
          ? 'border-brand bg-brand/10 text-foreground ring-1 ring-brand'
          : 'border-border bg-transparent text-muted-foreground hover:border-brand/50 hover:text-foreground')
      }
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: dot }}
        />
      ) : null}
      {children}
    </button>
  )
}
