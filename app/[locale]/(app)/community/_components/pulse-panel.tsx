import type { PulseStats } from '@/lib/actions/community-dashboard.shared';
import { Sparkline } from './sparkline';

type Props = { pulse: PulseStats };

const tileBase: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  borderRadius: 11,
  boxShadow: 'var(--sh-tile)',
  padding: '10px 12px',
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gridTemplateRows: 'auto 1fr auto',
  gridTemplateAreas: '"label spark" "num spark" "num delta"',
  columnGap: 8,
  rowGap: 2,
};

function StatTile({ label, value, delta, sparkline, hint, deltaTone, chapterNumber }: {
  label: string; value: number; delta: string; sparkline: number[]; hint: string | null;
  deltaTone: 'green' | 'dim'; chapterNumber?: number | null;
}) {
  const numDisplay = value === -1
    ? '—'
    : value >= 1000
      ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
      : `${value}`;
  const fullLabel = chapterNumber !== undefined && chapterNumber !== null
    ? `${label} · CH ${chapterNumber}`
    : label;
  return (
    <div style={tileBase}>
      <div style={{
        gridArea: 'label', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono, monospace)',
        fontWeight: 700, lineHeight: 1, alignSelf: 'start',
      }}>{fullLabel}</div>
      <div style={{ gridArea: 'spark', alignSelf: 'center', justifySelf: 'end' }}>
        <Sparkline values={sparkline} width={64} height={28} />
      </div>
      <div style={{
        gridArea: 'num', fontSize: 30, color: hint ? 'var(--canvas-dark-ink-muted)' : 'var(--brand)',
        fontWeight: 700, lineHeight: 1, alignSelf: 'center',
      }}>{numDisplay}</div>
      <div style={{
        gridArea: 'delta', fontSize: hint ? 10 : 11,
        color: hint ? 'var(--canvas-dark-ink-muted)' : (deltaTone === 'green' ? '#4ade80' : 'var(--canvas-dark-ink-muted)'),
        fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
        textAlign: 'right', alignSelf: 'end', lineHeight: 1,
      }}>{hint ?? delta}</div>
    </div>
  );
}

export function PulsePanel({ pulse }: Props) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      borderRadius: 18,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      padding: '12px 14px',
      minHeight: 172,
      display: 'flex',
      flexDirection: 'column',
      gridColumn: 'span 4',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', fontWeight: 700 }}>YOUR PULSE</span>
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontSize: 10,
          fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
          letterSpacing: '0.06em', fontWeight: 700,
          background: 'rgba(255,195,0,0.15)', color: 'var(--brand)',
        }}>7D</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
        <StatTile label="WORDS"           {...pulse.words}     />
        <StatTile label="FOLLOWERS"       {...pulse.followers} />
        <StatTile label="READS"           {...pulse.reads}     />
        <StatTile label="LIKES + COMMENTS" {...pulse.engagement}/>
      </div>
    </div>
  );
}
