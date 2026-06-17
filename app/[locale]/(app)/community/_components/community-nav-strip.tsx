import Link from 'next/link';
import { Users, Hexagon, Sparkles, BookMarked, BookOpen, type LucideIcon } from 'lucide-react';

type Props = { locale: string };

type Entry = { href: string; icon: LucideIcon; label: string };

const ENTRIES: Entry[] = [
  { href: '/friends',       icon: Users,      label: 'Friends' },
  { href: '/hives',         icon: Hexagon,    label: 'Hives' },
  { href: '/sparks',        icon: Sparkles,   label: 'Sparks' },
  { href: '/reading-lists', icon: BookMarked, label: 'Reading Lists' },
  { href: '/clubs',         icon: BookOpen,   label: 'Clubs' },
];

export function CommunityNavStrip({ locale }: Props) {
  return (
    <nav
      aria-label="Community sections"
      style={{
        display: 'flex',
        gap: 10,
        marginBottom: 18,
        flexWrap: 'wrap',
      }}
    >
      <style>{`
        .community-nav-pill { color: var(--canvas-dark-ink-strong); transition: color 120ms; }
        .community-nav-pill:hover { color: var(--brand); }
      `}</style>
      {ENTRIES.map((e) => {
        const Icon = e.icon;
        return (
          <Link
            key={e.href}
            href={`/${locale}${e.href}`}
            className="community-nav-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              borderRadius: 999,
              boxShadow: 'var(--sh-tile, 0 4px 12px rgba(0,0,0,0.3))',
              textDecoration: 'none',
              fontSize: 12,
              fontFamily: 'var(--font-mono, monospace)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
            }}
          >
            <Icon size={14} strokeWidth={2} color="var(--brand)" aria-hidden />
            <span>{e.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
