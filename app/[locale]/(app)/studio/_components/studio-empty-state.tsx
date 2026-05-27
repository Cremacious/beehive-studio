import Link from 'next/link'

type Props = {
  locale: string
  templates: { id: string; name: string; genre: string | null }[]
}

const TEMPLATE_CHIPS = ['Novel', 'Memoir', 'Short stories', 'Non-fiction'] as const

function PlaceholderSlot() {
  return (
    <div
      style={{
        width: '160px',
        height: '240px',
        border: '1.5px dashed var(--canvas-dark-300)',
        borderRadius: 'var(--r-lg)',
        background: 'oklch(0.215 0.003 256)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--canvas-dark-ink-muted)',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--r-full)',
          background: 'var(--canvas-dark-100)',
          border: '1px solid var(--canvas-dark-300)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M5 7h14" />
        </svg>
      </div>
    </div>
  )
}

export function StudioEmptyState({ locale, templates: _templates }: Props) {
  return (
    <main
      className="relative z-[1] flex flex-col"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 32px 96px',
        minHeight: 'calc(100vh - 56px)',
      }}
    >
      <div
        className="flex-1 grid place-items-center relative z-[1]"
        style={{ padding: '88px 0 64px' }}
      >
        <div className="w-[720px] relative flex flex-col items-center max-w-full">
          {/* Shelf — 2 slots + floating hero book */}
          <div
            className="relative w-full grid items-end"
            style={{
              height: '280px',
              gridTemplateColumns: 'repeat(3, 160px)',
              justifyContent: 'center',
              gap: '40px',
              paddingBottom: '4px',
            }}
            aria-hidden="true"
          >
            <PlaceholderSlot />

            {/* Floating hero book */}
            <div
              role="img"
              aria-label="A blank book waiting to be written"
              className="relative flex flex-col"
              style={{
                width: '208px',
                height: '296px',
                background: 'var(--paper-100)',
                borderRadius: 'var(--r-lg)',
                padding: '30px 22px 26px',
                boxShadow:
                  '0 1px 0 rgba(255,255,255,0.8) inset, -1px 0 0 oklch(0.78 0.020 78 / 0.65) inset, 0 2px 4px rgba(0,0,0,0.25), 0 28px 44px -16px rgba(0,0,0,0.65)',
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(95,60,20,0.05) 1px, transparent 0)',
                backgroundSize: '22px 22px',
                transform: 'translateY(-16px)',
                animation: 'float-gentle 5.5s ease-in-out infinite',
                zIndex: 2,
                color: 'var(--paper-ink)',
              }}
            >
              {/* status stripe top accent */}
              <span
                aria-hidden="true"
                style={{
                  content: '""',
                  position: 'absolute',
                  left: '18px',
                  right: '18px',
                  top: 0,
                  height: '3px',
                  background: 'var(--status-first-draft)',
                  borderRadius: '0 0 3px 3px',
                  opacity: 0.6,
                }}
              />
              <div
                className="text-center uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.28em',
                  color: 'var(--paper-ink-muted)',
                  marginTop: '4px',
                }}
              >
                Untitled · Book One
              </div>
              <div
                className="mx-auto inline-flex items-center justify-center"
                style={{
                  margin: '24px auto 16px',
                  width: '52px',
                  height: '52px',
                  borderRadius: 'var(--r-full)',
                  background: 'var(--paper-200)',
                  border: '1.5px solid var(--paper-300)',
                  color: 'var(--paper-ink-strong)',
                  boxShadow:
                    '0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 4px rgba(60,40,20,0.12)',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div
                className="text-center"
                style={{
                  marginTop: 'auto',
                  fontFamily: 'var(--font-prose)',
                  fontSize: '15px',
                  fontStyle: 'italic',
                  color: 'var(--paper-ink)',
                  lineHeight: 1.3,
                  textWrap: 'balance' as const,
                }}
              >
                The first page<br />is always the hardest.
              </div>
              <div
                className="mx-auto"
                style={{
                  width: '28px',
                  height: '1px',
                  background: 'var(--paper-ink-strong)',
                  margin: '12px auto 8px',
                  opacity: 0.4,
                }}
              />
              <div
                className="text-center uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  letterSpacing: '0.26em',
                  color: 'var(--paper-ink-muted)',
                }}
              >
                Press start when ready
              </div>
            </div>

            <PlaceholderSlot />
          </div>

          {/* Shelf rail */}
          <div
            className="relative w-full"
            style={{ height: '28px', marginTop: '-2px' }}
            aria-hidden="true"
          >
            <span
              style={{
                position: 'absolute',
                left: '4%',
                right: '4%',
                top: 0,
                height: '1px',
                background:
                  'linear-gradient(90deg, transparent, var(--canvas-dark-300) 8%, var(--canvas-dark-300) 92%, transparent)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '35%',
                right: '35%',
                top: '1px',
                height: '26px',
                background:
                  'radial-gradient(ellipse at 50% 0%, oklch(0.85 0.18 90 / 0.12), transparent 70%)',
              }}
            />
          </div>

          {/* Copy + CTAs */}
          <div className="text-center" style={{ marginTop: '56px', maxWidth: '540px' }}>
            <h2
              className="m-0 mb-3.5"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '36px',
                letterSpacing: '-0.025em',
                color: 'var(--canvas-dark-ink-strong)',
                lineHeight: 1.05,
                textWrap: 'balance' as const,
              }}
            >
              Your stories{' '}
              <em
                style={{
                  fontStyle: 'italic',
                  fontFamily: 'var(--font-prose)',
                  fontWeight: 400,
                  color: 'var(--canvas-dark-ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                start here.
              </em>
            </h2>
            <p
              className="mx-auto mb-7"
              style={{
                fontFamily: 'var(--font-prose)',
                fontSize: '17px',
                lineHeight: 1.5,
                color: 'var(--canvas-dark-ink-muted)',
                textWrap: 'pretty' as const,
              }}
            >
              Drop a seed of an idea, or open a blank chapter and let the first
              sentence find you. Your library will fill itself.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href={`/${locale}/studio/new`}
                className="inline-flex items-center gap-2.5 no-underline"
                style={{
                  padding: '13px 24px',
                  borderRadius: 'var(--r-full)',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 0,
                  cursor: 'pointer',
                  boxShadow: 'var(--el-2)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Start writing
              </Link>
              <Link
                href={`/${locale}/discover`}
                className="inline-flex items-center gap-2.5 no-underline"
                style={{
                  padding: '13px 24px',
                  borderRadius: 'var(--r-full)',
                  background: 'var(--canvas-dark-100)',
                  border: '1px solid var(--canvas-dark-300)',
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                Explore books
              </Link>
            </div>

            {/* Template hint chips — link to the new-book page. Template
                preselection is not yet wired through the new flow.
                TODO(library-v2): wire preselect template by name. */}
            <div
              className="uppercase flex items-center gap-3.5 justify-center flex-wrap"
              style={{
                marginTop: '28px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.10em',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              <span>Start from a template</span>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--canvas-dark-300)' }} />
              <div className="inline-flex gap-2 items-center flex-wrap justify-center">
                {TEMPLATE_CHIPS.map((label) => (
                  <Link
                    key={label}
                    href={`/${locale}/studio/new`}
                    className="inline-flex items-center gap-1.5 no-underline"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--r-full)',
                      background: 'var(--canvas-dark-100)',
                      border: '1px solid var(--canvas-dark-300)',
                      color: 'var(--canvas-dark-ink)',
                      textTransform: 'none',
                      letterSpacing: '0.01em',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Local keyframes — scoped to empty state */}
      <style>{`
        @keyframes float-gentle {
          0%, 100% { transform: translateY(-16px); }
          50%      { transform: translateY(-22px); }
        }
      `}</style>
    </main>
  )
}
