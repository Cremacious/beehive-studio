import Link from 'next/link';
import type { HeroSignal, DashboardFallbacks } from '@/lib/actions/community-dashboard.shared';

type Props = { hero: HeroSignal | null; fallbacks: DashboardFallbacks; locale: string };

function Cover({ url, title, author }: { url: string | null; title: string | null; author: string | null }) {
  return (
    <div style={{
      width: 104, height: 148, padding: 7,
      background: url ? `url(${url}) center / cover` : 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
      borderRadius: 6,
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      color: '#f0e5d0', flexShrink: 0, alignSelf: 'center',
    }}>
      {!url && title ? <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.15 }}>{title}</div> : <div />}
      {!url && author ? <div style={{ fontSize: 8, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{author}</div> : <div />}
    </div>
  );
}

function GlyphCover() {
  return (
    <div style={{
      width: 104, height: 148, alignSelf: 'center',
      borderRadius: 8, flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(255,195,0,0.18), rgba(255,195,0,0.04))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--brand)', fontSize: 52,
    }}>✨</div>
  );
}

function todaysSparkHero(f: DashboardFallbacks['todaysSpark']): HeroSignal | null {
  if (!f) return null;
  return {
    kind: 'TODAYS_SPARK',
    label: '★ TODAY\'S SPARK',
    metaInline: `${f.entriesCount} entries · ${f.deadlineLabel === 'open' ? 'open' : `ends ${f.deadlineLabel}`}`,
    headline: `"${f.prompt}"`,
    quote: f.wordLimit ? `${f.wordLimit}-word flash. ${f.entriesCount} writers entered. Add yours before the deadline.` : 'Add your entry before the deadline.',
    coverUrl: null,
    coverAuthor: null,
    coverTitle: null,
    primaryCta: { label: 'Write now →', href: `/community/sparks/new?prompt=${f.id}` },
    secondaryCta: { label: 'See prompt', href: `/community/sparks/${f.id}` },
  };
}

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 18,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '16px 20px',
  minHeight: 172,
  display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'stretch',
  gridColumn: 'span 8',
};

export function HeroPanel({ hero, fallbacks, locale }: Props) {
  const actual = hero ?? todaysSparkHero(fallbacks.todaysSpark);
  if (!actual) {
    return (
      <div style={panelStyle}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--canvas-dark-ink-muted)' }}>
          <div style={{ fontSize: 32 }}>🐝</div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nothing fresh right now, check back soon</div>
        </div>
      </div>
    );
  }
  const useGlyph = actual.kind === 'TODAYS_SPARK';
  return (
    <div style={panelStyle}>
      {useGlyph
        ? <GlyphCover />
        : <Cover url={actual.coverUrl} title={actual.coverTitle} author={actual.coverAuthor} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', fontWeight: 700 }}>{actual.label}</span>
          <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, whiteSpace: 'nowrap' }}>{actual.metaInline}</span>
        </div>
        <div style={{ fontSize: 18, color: 'var(--canvas-dark-ink-strong)', fontWeight: 700, lineHeight: 1.28 }}>{actual.headline}</div>
        {actual.quote ? (
          <div style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            color: 'var(--canvas-dark-ink-muted)',
            fontSize: 12.5, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{actual.quote}</div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <Link href={`/${locale}${actual.primaryCta.href}`} style={{
            padding: '7px 14px', borderRadius: 999, fontWeight: 700, fontSize: 12,
            background: 'var(--brand)', color: 'var(--brand-ink, #1a1b1c)', textDecoration: 'none',
          }}>{actual.primaryCta.label}</Link>
          {actual.secondaryCta ? (
            <Link href={`/${locale}${actual.secondaryCta.href}`} style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              background: 'rgba(255,255,255,0.06)', color: 'var(--canvas-dark-ink)', textDecoration: 'none',
            }}>{actual.secondaryCta.label}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
