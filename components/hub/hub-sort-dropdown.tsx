'use client'
import { Select } from 'radix-ui'
import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { useFilterNav } from '@/app/[locale]/(public)/discover/_components/use-filter-nav'

type Option = { value: string; label: string }

type Props = {
  name: string
  options: Option[]
  selected: string
  fallback?: string
  ariaLabel?: string
}

/**
 * Styled sort dropdown for hub pages (Sparks/Hives/Clubs/etc.).
 * Uses Radix Select with tile chrome instead of a native <select>.
 * URL state managed via useFilterNav (router.replace, no history entry).
 * Drops the param when the selected value equals the fallback.
 */
export function HubSortDropdown({ name, options, selected, fallback, ariaLabel }: Props) {
  const { setParam } = useFilterNav()
  const fb = fallback ?? options[0]?.value

  function onValueChange(value: string) {
    if (value === fb) setParam(name, null)
    else setParam(name, value)
  }

  return (
    <Select.Root value={selected ?? fb ?? ''} onValueChange={onValueChange}>
      <Select.Trigger
        aria-label={ariaLabel ?? name}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-[var(--r-row)] outline-none transition-colors focus:ring-1 focus:ring-[var(--brand)] select-none"
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
          className="z-50 min-w-[130px] overflow-hidden rounded-[var(--r-row)] p-1 duration-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <Select.Viewport>
            {options.map((opt) => (
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
