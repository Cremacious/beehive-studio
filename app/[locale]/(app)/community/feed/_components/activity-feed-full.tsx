'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { PanelRow, RowLeading } from '@/lib/actions/community-dashboard.shared';
import { getFriendsDeskNextPageAction } from '@/lib/actions/community-dashboard.actions';

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--canvas-dark-ink-strong)' }}>{p}</strong> : <span key={i}>{p}</span>);
}

function Avatar({ leading }: { leading: RowLeading }) {
  if (leading.kind !== 'avatar') return null;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 999,
      background: 'linear-gradient(135deg, #c4b5fd, #7dd3fc)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#1a1b1c', fontWeight: 700, fontSize: 14, flexShrink: 0,
    }}>{leading.fallbackInitial}</div>
  );
}

export function ActivityFeedFull({ initialRows, initialCursor, locale }: { initialRows: PanelRow[]; initialCursor: string | null; locale: string }) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(initialCursor);
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <Link href={`/${locale}/community`} style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>← Back to dashboard</Link>
      <h1 style={{ fontSize: 24, margin: '12px 0 18px', color: 'var(--brand)', fontWeight: 700 }}>Friends&apos; Desks</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <Link key={r.id} href={`/${locale}${r.href}`} style={{
            display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none',
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            borderRadius: 12, padding: '12px 14px', boxShadow: 'var(--sh-tile, 0 4px 12px rgba(0,0,0,0.3))',
          }}>
            <Avatar leading={r.leading} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--canvas-dark-ink)', lineHeight: 1.3 }}>{renderBold(r.t1)}</div>
              <div style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', marginTop: 2, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{r.t2}</div>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ padding: '16px 0' }}>
        {cursor ? (
          <button onClick={loadOlder} disabled={isPending} style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', color: 'var(--canvas-dark-ink-muted)',
            border: 0, padding: 12, borderRadius: 10, fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>{isPending ? 'Loading...' : 'Load older activity'}</button>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All caught up</div>
        )}
      </div>
    </div>
  );
}
