type Props = {
  sp: Record<string, string | string[] | undefined>
  locale: string
}

export function BooksFilters(_props: Props) {
  return (
    <aside
      className="self-start rounded-[var(--r-card)] border border-[var(--br-card)] p-4 text-[12px] text-[var(--canvas-dark-ink-muted)]"
      style={{
        width: 'var(--w-discover-sidebar)',
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
      }}
    >
      TODO: BooksFilters (wires in W4.1)
    </aside>
  )
}
