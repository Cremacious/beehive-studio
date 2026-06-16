import Link from 'next/link';

type Props = { locale: string };

type Entry = { href: string; glyph: string; label: string };

const ENTRIES: Entry[] = [
  { href: '/friends',       glyph: '👥', label: 'Friends' },
  { href: '/hives',         glyph: '🐝', label: 'Hives' },
  { href: '/sparks',        glyph: '✨', label: 'Sparks' },
  { href: '/reading-lists', glyph: '📚', label: 'Reading Lists' },
  { href: '/clubs',         glyph: '📖', label: 'Clubs' },
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
      {ENTRIES.map((e) => (
        <Link
          key={e.href}
          href={`/${locale}${e.href}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            borderRadius: 999,
            boxShadow: 'var(--sh-tile, 0 4px 12px rgba(0,0,0,0.3))',
            textDecoration: 'none',
            color: 'var(--canvas-dark-ink-strong)',
            fontSize: 12,
            fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 700,
            transition: 'color 120ms',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }} aria-hidden>{e.glyph}</span>
          <span>{e.label}</span>
        </Link>
      ))}
    </nav>
  );
}
