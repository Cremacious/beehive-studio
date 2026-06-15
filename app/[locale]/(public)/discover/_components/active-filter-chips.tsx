import Link from 'next/link'
import { X } from 'lucide-react'

export type ActiveFilterChip = {
  label: string
  removeHref: string
}

type Props = {
  chips: ActiveFilterChip[]
}

export function ActiveFilterChips({ chips }: Props) {
  if (chips.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map((chip, i) => (
        <li key={`${chip.label}-${i}`}>
          <Link
            href={chip.removeHref}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-pill)] border text-[10px] font-medium tracking-[0.04em]"
            style={{
              background:
                'oklch(from var(--brand) l c h / 0.12)',
              color: 'var(--brand)',
              borderColor: 'var(--brand)',
            }}
            aria-label={`Remove filter: ${chip.label}`}
          >
            <span>{chip.label}</span>
            <X size={10} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
