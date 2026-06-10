import { Check } from 'lucide-react'

const PREMIUM_FEATURES = [
  {
    title: 'Never lose a draft',
    body: 'Auto-saved versions of every chapter, restorable at a click.',
  },
  {
    title: 'Publish your book to the world',
    body: 'Polished publishing details: ISBN, subtitle, dedication, and more.',
  },
  {
    title: 'Build your library',
    body: 'Unlimited books. Write as many as you can dream up.',
  },
  {
    title: 'Grow your circle',
    body: 'Unlimited Hives, larger groups, your full writing community.',
  },
]

export function FeatureList() {
  return (
    <ul className="flex flex-col gap-4">
      {PREMIUM_FEATURES.map((f) => (
        <li key={f.title} className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0"
            style={{
              background: 'oklch(from var(--color-brand) l c h / 0.18)',
              color: 'var(--color-brand)',
            }}
          >
            <Check size={14} strokeWidth={2.5} />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{f.title}</span>
            <span className="text-xs text-muted-foreground leading-relaxed">{f.body}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
