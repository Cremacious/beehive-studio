'use client'
import { Select } from 'radix-ui'
import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'most-followed', label: 'Most followed' },
  { value: 'a-z', label: 'A → Z' },
  { value: 'most-books', label: 'Most books' },
] as const

export type ListsSort = 'recent' | 'most-followed' | 'a-z' | 'most-books'

type Props = {
  selected: ListsSort
}

/**
 * Styled sort dropdown for the /reading-lists hub. Preserves `?tab=` on change
 * and resets `?page=` to 1. Uses Radix Select with tile chrome instead of a
 * native <select>.
 */
export function ListsSortDropdown({ selected }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const onValueChange = (next: string) => {
    const sp = new URLSearchParams(searchParams.toString())
    if (next === 'recent') {
      sp.delete('sort')
    } else {
      sp.set('sort', next)
    }
    sp.delete('page')
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  return (
    <Select.Root value={selected} onValueChange={onValueChange}>
      <Select.Trigger
        disabled={isPending}
        aria-label="Sort reading lists"
        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-[var(--r-row)] outline-none transition-colors focus:ring-1 focus:ring-[var(--brand)] select-none disabled:opacity-60"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          color: 'var(--canvas-dark-ink)',
        }}
      >
        <ArrowUpDown
          className="size-3 shrink-0"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        />
        <Select.Value />
        <Select.Icon asChild>
          <ChevronDown
            className="size-3 shrink-0"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[140px] overflow-hidden rounded-[var(--r-row)] p-1 duration-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <Select.Viewport>
            {SORT_OPTIONS.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className="relative flex w-full cursor-pointer items-center rounded-[var(--r-btn)] px-2 py-1.5 text-[12px] outline-none transition-colors data-[highlighted]:bg-[var(--canvas-dark-350)] data-[state=checked]:text-[var(--brand)] select-none"
                style={{ color: 'var(--canvas-dark-ink)' }}
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
