'use client'

import { Link2 } from 'lucide-react'

export function LinkCard({ url }: { url: string }) {
  let hostname = url
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    // fall back to raw url
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        background: 'rgba(0,0,0,0.32)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
        borderRadius: 'var(--r-row)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      className="flex items-center gap-3 p-3 mt-3 no-underline"
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center shrink-0"
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          background: 'linear-gradient(150deg, oklch(0.4 0.06 256), oklch(0.3 0.04 256))',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        <Link2 size={20} strokeWidth={1.8} />
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span
          className="text-[14px] font-medium truncate"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {hostname}
        </span>
        <span
          className="font-mono text-[11px] tracking-wider truncate mt-0.5"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {url}
        </span>
      </span>
    </a>
  )
}
