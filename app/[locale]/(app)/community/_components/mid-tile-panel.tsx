import Link from 'next/link';
import { Hexagon, Sparkles, Zap, BookOpen, PenLine } from 'lucide-react';
import type { PanelRow, RowLeading } from '@/lib/actions/community-dashboard.shared';
import { optimizeCloudinaryUrl, BOOK_COVER_TRANSFORMS } from '@/lib/upload/cloudinary-url';

// Maps a leading-icon glyph KEY to a lucide icon. Producers emit these keys
// instead of emoji; a literal typographic glyph (e.g. "★") that isn't a key
// falls through and renders as text.
const GLYPH_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  hive: Hexagon,
  spark: Sparkles,
  bolt: Zap,
  books: BookOpen,
  write: PenLine,
};

type NudgeRow = {
  id: string;
  leading: RowLeading;
  t1: string;
  t2: string;
  cta: { label: string; href: string };
};

type Props = {
  label: string;
  seeAllHref: string;
  seeAllLabel: string;
  rows: PanelRow[];
  emptyNudges?: NudgeRow[];
  locale: string;
  gridColumn?: string;
};

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} style={{ color: 'var(--canvas-dark-ink-strong)' }}>{p}</strong> : <span key={i}>{p}</span>));
}

function Leading({ leading }: { leading: RowLeading }) {
  if (leading.kind === 'avatar') {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: 999,
        background: 'linear-gradient(135deg, #c4b5fd, #7dd3fc)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1a1b1c', fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>{leading.fallbackInitial}</div>
    );
  }
  if (leading.kind === 'icon') {
    const toneBg: Record<string, string> = {
      brand: 'rgba(255,195,0,0.12)', green: 'rgba(74,222,128,0.12)',
      blue: 'rgba(125,211,252,0.12)', purple: 'rgba(196,181,253,0.12)', mono: 'rgba(255,255,255,0.06)',
    };
    const toneColor: Record<string, string> = {
      brand: 'var(--brand)', green: '#4ade80', blue: '#7dd3fc', purple: '#c4b5fd', mono: 'var(--canvas-dark-ink-muted)',
    };
    return (
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: toneBg[leading.tone], color: toneColor[leading.tone],
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
      }}>{(() => { const Icon = GLYPH_ICONS[leading.glyph]; return Icon ? <Icon size={15} /> : leading.glyph; })()}</div>
    );
  }
  if (leading.kind === 'cover-stack') {
    return (
      <div style={{ display: 'flex', flexShrink: 0, width: 54 }}>
        {(leading.covers.slice(0, 3)).map((c, i) => (
          <div key={i} style={{
            width: 28, height: 40, padding: 3,
            background: c.coverUrl
              ? `url(${optimizeCloudinaryUrl(c.coverUrl, BOOK_COVER_TRANSFORMS)}) center / cover`
              : 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
            borderRadius: 4, color: '#f0e5d0',
            transform: i === 0 ? 'rotate(-3deg)' : i === 2 ? 'rotate(3deg)' : 'none',
            marginLeft: i === 0 ? 0 : -14,
            fontFamily: 'Georgia, serif', fontSize: 7, lineHeight: 1.1,
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          }}>{c.coverUrl ? '' : (c.title ?? '?').charAt(0)}</div>
        ))}
      </div>
    );
  }
  // single cover
  return (
    <div style={{
      width: 36, height: 52, padding: 4,
      background: leading.coverUrl
        ? `url(${optimizeCloudinaryUrl(leading.coverUrl, BOOK_COVER_TRANSFORMS)}) center / cover`
        : 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
      borderRadius: 6, color: '#f0e5d0',
      fontFamily: 'Georgia, serif', fontSize: 11, lineHeight: 1.15,
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{leading.coverUrl ? '' : leading.fallbackInitial}</div>
  );
}

function Pill({ label, tone }: { label: string; tone: 'brand' | 'mono' | 'green' | 'blue' | 'purple' }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    brand:  { bg: 'var(--brand)', fg: 'var(--brand-ink, #1a1b1c)' },
    mono:   { bg: 'rgba(255,255,255,0.06)', fg: 'var(--canvas-dark-ink-muted)' },
    green:  { bg: 'rgba(74,222,128,0.15)', fg: '#4ade80' },
    blue:   { bg: 'rgba(125,211,252,0.15)', fg: '#7dd3fc' },
    purple: { bg: 'rgba(196,181,253,0.15)', fg: '#c4b5fd' },
  };
  const c = colors[tone];
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 999, fontSize: 10,
      fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
      letterSpacing: '0.06em', fontWeight: 700,
      background: c.bg, color: c.fg, flexShrink: 0,
    }}>{label}</span>
  );
}

function Row({ row, locale }: { row: PanelRow; locale: string }) {
  return (
    <Link href={`/${locale}${row.href}`} style={{
      display: 'flex', gap: 10, alignItems: 'center', minHeight: 52,
      padding: '10px 12px',
      background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
      borderRadius: 12,
      boxShadow: 'var(--sh-tile, 0 4px 12px rgba(0,0,0,0.3))',
      textDecoration: 'none',
    }}>
      <Leading leading={row.leading} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--canvas-dark-ink-strong)', fontWeight: 600, lineHeight: 1.3 }}>{renderBold(row.t1)}</div>
        <div style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', marginTop: 2, lineHeight: 1.3, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.t2}</div>
      </div>
      {row.trailingPill ? <Pill {...row.trailingPill} /> : null}
    </Link>
  );
}

function NudgeRowEl({ nudge, locale }: { nudge: NudgeRow; locale: string }) {
  return (
    <Link href={`/${locale}${nudge.cta.href}`} style={{
      display: 'flex', gap: 10, alignItems: 'center', minHeight: 52,
      padding: '10px 12px',
      background: 'linear-gradient(180deg, rgba(255,195,0,0.06), rgba(255,195,0,0.02))',
      border: '1px solid rgba(255,195,0,0.15)',
      borderRadius: 12, textDecoration: 'none',
    }}>
      <Leading leading={nudge.leading} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--canvas-dark-ink-strong)', fontWeight: 600, lineHeight: 1.3 }}>{nudge.t1}</div>
        <div style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', marginTop: 2, lineHeight: 1.3, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{nudge.t2}</div>
      </div>
      <span style={{
        background: 'var(--brand)', color: 'var(--brand-ink, #1a1b1c)',
        padding: '5px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
      }}>{nudge.cta.label}</span>
    </Link>
  );
}

export function MidTilePanel({ label, seeAllHref, seeAllLabel, rows, emptyNudges, locale, gridColumn }: Props) {
  const isEmpty = rows.length === 0;
  const displayRows = isEmpty ? (emptyNudges ?? []).slice(0, 3) : rows.slice(0, 3);
  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      borderRadius: 18,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      minHeight: 264,
      display: 'flex', flexDirection: 'column',
      gridColumn: gridColumn ?? 'span 4',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 10px' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', fontWeight: 700 }}>{label}</span>
        <Link href={`/${locale}${seeAllHref}`} style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{seeAllLabel} →</Link>
      </div>
      <div style={{ padding: '0 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isEmpty
          ? displayRows.map((n) => <NudgeRowEl key={(n as NudgeRow).id} nudge={n as NudgeRow} locale={locale} />)
          : displayRows.map((r) => <Row key={(r as PanelRow).id} row={r as PanelRow} locale={locale} />)
        }
      </div>
      <div style={{ padding: '8px 18px 14px' }} />
    </div>
  );
}

export type { NudgeRow };
