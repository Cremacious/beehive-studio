'use client'

import { UpgradePrompt } from '@/components/upgrade/upgrade-prompt'

type Props = {
  locale: string
  /** All consumers are in-studio (always authed). Default true. */
  isAuthed?: boolean
}

/**
 * Free-tier upsell card for the import feature. Renders the shared
 * <UpgradePrompt> inside the brand-tinted card chrome consumers depend on.
 */
export function ImportUpsell({ locale, isAuthed = true }: Props) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        padding: 20,
        borderRadius: 'var(--r-row)',
        background:
          'radial-gradient(120% 80% at 20% 10%, oklch(from var(--brand) l c h / 0.18), transparent 70%), linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        border: '1px solid oklch(from var(--brand) l c h / 0.30)',
      }}
    >
      <UpgradePrompt feature="import" locale={locale} isAuthed={isAuthed} />
    </div>
  )
}
