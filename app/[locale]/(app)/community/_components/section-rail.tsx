import Link from 'next/link'
import { Users, Hexagon, Zap, BookMarked, BookOpen, type LucideIcon } from 'lucide-react'

type Tile = {
  label: string
  href: string
  icon: LucideIcon
  count: number
}

export function SectionRail({
  locale,
  friendsCount,
  hivesCount,
  sparksCount,
}: {
  locale: string
  friendsCount: number
  hivesCount: number
  sparksCount: number
}) {
  const tiles: Tile[] = [
    { label: 'Friends', href: `/${locale}/friends`, icon: Users, count: friendsCount },
    { label: 'Hives', href: `/${locale}/studio`, icon: Hexagon, count: hivesCount },
    { label: 'Sparks', href: `/${locale}/discover?tab=sparks`, icon: Zap, count: sparksCount },
    { label: 'Reading Lists', href: `/${locale}/reading-lists`, icon: BookMarked, count: 0 },
    { label: 'Book Clubs', href: `/${locale}/clubs`, icon: BookOpen, count: 0 },
  ]

  return (
    <nav aria-label="Community sections" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <Link
            key={tile.label}
            href={tile.href}
            style={{
              background:
                'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
              borderRadius: 'var(--r-card)',
              boxShadow: 'var(--sh-card)',
              border: 'var(--br-card)',
            }}
            className="group flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
          >
            <span
              style={{
                background:
                  'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                borderRadius: 'var(--r-btn)',
                boxShadow: 'var(--sh-tile)',
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center"
            >
              <Icon size={18} style={{ color: 'var(--brand)' }} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
                className="text-sm font-semibold truncate"
              >
                {tile.label}
              </span>
              {tile.count > 0 ? (
                <span
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  className="text-[11px] font-mono uppercase tracking-wider"
                >
                  {tile.count}
                </span>
              ) : null}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
