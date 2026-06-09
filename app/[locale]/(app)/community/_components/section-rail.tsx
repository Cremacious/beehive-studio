import Link from 'next/link'
import { Users, Hexagon, Zap, BookMarked, BookOpen } from 'lucide-react'
import type { ReactNode } from 'react'

type Tile = {
  label: string
  sublabel?: string
  href: string
  icon: ReactNode
  count?: number
}

export function SectionRail({
  locale,
  friendsCount,
  hivesCount,
  sparksCount,
  listsCount,
  clubsCount,
}: {
  locale: string
  friendsCount: number
  hivesCount: number
  sparksCount: number
  listsCount?: number
  clubsCount?: number
}) {
  // Order locked per Q3: Friends / Hives / Sparks / Lists / Clubs.
  // Q4 lock: Hives tile routes to /studio with "Your hives" sublabel
  // (no /hives index yet).
  const tiles: Tile[] = [
    {
      label: 'Friends',
      href: `/${locale}/friends`,
      icon: <Users />,
      count: friendsCount,
    },
    {
      label: 'Hives',
      sublabel: 'Your hives',
      href: `/${locale}/studio`,
      icon: <Hexagon />,
      count: hivesCount,
    },
    {
      label: 'Sparks',
      href: `/${locale}/sparks`,
      icon: <Zap />,
      count: sparksCount,
    },
    {
      label: 'Lists',
      href: `/${locale}/reading-lists`,
      icon: <BookMarked />,
      count: listsCount,
    },
    {
      label: 'Clubs',
      href: `/${locale}/clubs`,
      icon: <BookOpen />,
      count: clubsCount,
    },
  ]

  return (
    <nav className="tabstrip mb-6" aria-label="Community sections">
      {tiles.map((tile) => (
        <Link key={tile.label} className="tab" href={tile.href}>
          {tile.icon}
          <span>{tile.label}</span>
          {tile.sublabel ? (
            <span className="meta-mono">{tile.sublabel}</span>
          ) : null}
          {tile.count != null ? <span className="ct">{tile.count}</span> : null}
        </Link>
      ))}
    </nav>
  )
}
