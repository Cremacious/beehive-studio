'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { GENRES, GENRE_LABEL } from '@/lib/discover/genres'

type Props = { activeGenre: string | undefined; locale: string }

export function GenreChipStrip({ activeGenre, locale }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, startTransition] = useTransition()

  function setGenre(slug: string | null) {
    const params = new URLSearchParams(sp.toString())
    if (slug) params.set('genre', slug)
    else params.delete('genre')
    const qs = params.toString()
    startTransition(() => {
      router.push(`/${locale}/discover${qs ? `?${qs}` : ''}`, { scroll: false })
    })
  }

  return (
    <nav aria-label="Genre filter" className="flex gap-2 overflow-x-auto">
      <ChipButton active={!activeGenre} onClick={() => setGenre(null)} label="All" />
      {GENRES.map((slug) => (
        <ChipButton
          key={slug}
          active={activeGenre === slug}
          onClick={() => setGenre(slug)}
          label={GENRE_LABEL[slug]}
        />
      ))}
    </nav>
  )
}

function ChipButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 whitespace-nowrap px-3 h-8 rounded-[var(--r-pill)] text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] transition-colors"
      style={
        active
          ? { background: 'var(--brand)', color: 'var(--brand-ink)' }
          : {
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              color: 'var(--canvas-dark-ink-muted)',
              boxShadow: 'var(--sh-tile)',
            }
      }
    >
      {label}
    </button>
  )
}
