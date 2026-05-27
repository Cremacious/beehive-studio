import type { StudioStats } from '@/lib/actions/book.actions'

const FORMATTER = new Intl.NumberFormat('en-US')

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 px-4 rounded-lg bg-card border border-border">
      <span
        className="text-2xl font-bold text-foreground"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
      >
        {FORMATTER.format(value)}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

export function StudioStats({ stats }: { stats: StudioStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile value={stats.booksInProgress} label="Books in progress" />
      <StatTile value={stats.wordsThisWeek} label="Words this week" />
      <StatTile value={stats.chaptersPublished} label="Chapters published" />
    </div>
  )
}
