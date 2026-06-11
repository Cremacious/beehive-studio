'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'

export function DiscoverSearchInput({ locale }: { locale: string }) {
  const router = useRouter()
  const [q, setQ] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/${locale}/discover/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={submit} className="relative">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--canvas-dark-ink-muted)]"
        aria-hidden="true"
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search books, authors, tags..."
        aria-label="Search Discover"
        className="h-9 w-[280px] pl-9 pr-3 text-[13px] rounded-[var(--r-row)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
        style={{
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          color: 'var(--canvas-dark-ink)',
        }}
      />
    </form>
  )
}
