type Props = {
  sp: Record<string, string | string[] | undefined>
  locale: string
}

export function HivesFilters(_props: Props) {
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
      TODO: HivesFilters (wires in W5.2)
    </aside>
  )
}
