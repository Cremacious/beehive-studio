'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Hexagon, Sparkles, BookMarked, BookOpen, Bookmark, Compass, ChevronDown, type LucideIcon } from 'lucide-react';

type Props = { locale: string };

type Entry = { href: string; icon: LucideIcon; label: string };

const ENTRIES: Entry[] = [
  { href: '/community/friends',       icon: Users,      label: 'Friends' },
  { href: '/community/hives',         icon: Hexagon,    label: 'Hives' },
  { href: '/community/sparks',        icon: Sparkles,   label: 'Sparks' },
  { href: '/community/reading-lists', icon: BookMarked, label: 'Reading Lists' },
  { href: '/community/clubs',         icon: BookOpen,   label: 'Clubs' },
  { href: '/community/bookmarks',     icon: Bookmark,   label: 'Bookmarks' },
];

export function CommunityNavStrip({ locale }: Props) {
  // Mobile (issue #50): the wrapping pill row collapses to a dropdown selector.
  // Desktop keeps the pill strip untouched.
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Desktop pill strip (unchanged) */}
      <div className="max-md:hidden">
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
      </div>

      {/* Mobile dropdown selector (issue #50) */}
      <div className="md:hidden relative w-full" style={{ marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Browse community sections"
          className="w-full flex items-center justify-between gap-3 px-3.5 min-h-[46px] rounded-[var(--r-row)]"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            border: 'var(--br-card)',
          }}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Compass size={16} style={{ color: 'var(--brand)' }} className="shrink-0" />
            <span
              className="truncate"
              style={{
                color: 'var(--canvas-dark-ink-strong)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Community sections
            </span>
          </span>
          <ChevronDown
            size={16}
            className="shrink-0"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
            }}
          />
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              role="listbox"
              className="absolute left-0 right-0 z-50 overflow-hidden"
              style={{
                top: 'calc(100% + 6px)',
                borderRadius: 'var(--r-card)',
                background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
                boxShadow: 'var(--sh-card)',
                border: 'var(--br-card)',
              }}
            >
              <div className="max-h-[60vh] overflow-y-auto py-1.5 px-1.5 flex flex-col gap-0.5">
                {ENTRIES.map((e) => {
                  const Icon = e.icon;
                  return (
                    <Link
                      key={e.href}
                      href={`/${locale}${e.href}`}
                      role="option"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 min-h-[44px] rounded-[var(--r-row)] no-underline"
                    >
                      <Icon
                        size={16}
                        className="shrink-0"
                        style={{ color: 'var(--brand)' }}
                      />
                      <span
                        className="truncate"
                        style={{ color: 'var(--canvas-dark-ink)', fontSize: 14 }}
                      >
                        {e.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
