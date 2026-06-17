'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { FriendsDeskData, PanelRow, RowLeading, PillTone } from '@/lib/actions/community-dashboard.shared';
import { getFriendsDeskNextPageAction } from '@/lib/actions/community-dashboard.actions';

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
  return null;
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: 'var(--canvas-dark-ink-strong)' }}>{p}</strong>
      : <span key={i}>{p}</span>
  );
}

function Pill({ label, tone }: { label: string; tone: PillTone }) {
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

function FriendRow({ row, locale }: { row: PanelRow; locale: string }) {
  return (
    <Link href={`/${locale}${row.href}`} style={{
      padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none',
      background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
      borderRadius: 12, boxShadow: 'var(--sh-tile, 0 4px 12px rgba(0,0,0,0.3))',
    }}>
      <Leading leading={row.leading} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--canvas-dark-ink)', lineHeight: 1.3 }}>{renderBold(row.t1)}</div>
        <div style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', marginTop: 2, lineHeight: 1.3, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{row.t2}</div>
      </div>
      {row.trailingPill ? <Pill {...row.trailingPill} /> : null}
    </Link>
  );
}

export function FriendsDeskPanel({ initial, locale }: { initial: FriendsDeskData; locale: string }) {
  const [rows, setRows] = useState<PanelRow[]>(initial.rows);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [isPending, startTransition] = useTransition();

  const loadOlder = () => {
    if (!cursor || isPending) return;
    startTransition(async () => {
      const next = await getFriendsDeskNextPageAction(cursor);
      setRows((prev) => [...prev, ...next.rows]);
      setCursor(next.nextCursor);
    });
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      borderRadius: 18,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      minHeight: 320, display: 'flex', flexDirection: 'column', gridColumn: 'span 7',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 10px' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', fontWeight: 700 }}>{initial.label}</span>
        <Link href={`/${locale}${initial.seeAllHref}`} style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Full feed →</Link>
      </div>
      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,195,0,0.12)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🐝</div>
          <div style={{ fontSize: 15, color: 'var(--canvas-dark-ink-strong)', fontWeight: 700 }}>Your friends&apos; writing lives here.</div>
          <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13, color: 'var(--canvas-dark-ink-muted)', maxWidth: 340 }}>Follow other writers and you&apos;ll see their chapters, sparks, and progress fill in below, chronologically.</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Link href={`/${locale}/discover?tab=writers`} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--brand)', color: 'var(--brand-ink, #1a1b1c)', borderRadius: 999, textDecoration: 'none' }}>Find writers</Link>
            <Link href={`/${locale}/community/friends`} style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(255,255,255,0.06)', color: 'var(--canvas-dark-ink)', borderRadius: 999, textDecoration: 'none' }}>Invite a friend</Link>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px', flex: 1 }}>
            {rows.map((r) => <FriendRow key={r.id} row={r} locale={locale} />)}
          </div>
          <div style={{ padding: '8px 18px 14px' }}>
            {cursor ? (
              <button onClick={loadOlder} disabled={isPending} style={{
                width: '100%', background: 'rgba(255,255,255,0.04)', color: 'var(--canvas-dark-ink-muted)',
                border: 0, padding: 10, borderRadius: 8, fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{isPending ? 'Loading...' : 'Load older activity'}</button>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All caught up</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
