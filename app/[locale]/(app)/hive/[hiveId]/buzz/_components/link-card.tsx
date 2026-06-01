'use client'

import { ExternalLink } from 'lucide-react'

export function LinkCard({ url }: { url: string }) {
  let hostname = url
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    // fall back to raw url
  }
  const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-inset)',
        border: 'var(--br-card)',
      }}
      className="flex items-center gap-3 p-3 mt-1 hover:translate-y-[-1px] transition-transform"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={favicon}
        alt=""
        className="w-6 h-6 rounded shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-xs font-comfortaa font-semibold truncate"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {hostname}
        </div>
        <div
          className="text-[11px] font-mono truncate"
          style={{ color: 'var(--brand)' }}
        >
          {url}
        </div>
      </div>
      <ExternalLink
        size={14}
        className="shrink-0"
        style={{ color: 'var(--brand)' }}
      />
    </a>
  )
}
