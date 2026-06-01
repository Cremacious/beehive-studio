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
      className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:border-brand/60 hover:bg-muted/30 transition-colors"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={favicon}
        alt=""
        className="w-6 h-6 rounded shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">
          {hostname}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{url}</div>
      </div>
      <ExternalLink size={14} className="text-muted-foreground shrink-0" />
    </a>
  )
}
