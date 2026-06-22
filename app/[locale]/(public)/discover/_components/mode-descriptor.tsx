import type { ModeId, TabId } from '@/lib/discover/url-state'

type Props = {
  mode: ModeId
  tab: TabId
}

const DESCRIPTORS: Record<string, string> = {
  'books|trending': 'Updated or discovered most by readers in the past 7 days.',
  'sparks|trending':
    'Writing prompts with the most new entries in the past 7 days.',
  'hives|trending':
    'Writing groups with the most activity in the past 7 days.',
  'lists|trending':
    'Reading lists gaining the most new followers in the past 7 days.',
  'clubs|trending':
    'Book clubs with the most new discussions and members in the past 7 days.',
  'books|popular': 'All-time most liked and read across the platform.',
  'sparks|popular': 'Writing prompts with the most total entries of all time.',
  'hives|popular': 'Writing groups with the most total members.',
  'lists|popular': 'Reading lists with the most total followers.',
  'clubs|popular': 'Book clubs with the most total members and activity.',
}

export function ModeDescriptor({ mode, tab }: Props) {
  if (mode !== 'trending' && mode !== 'popular') return null
  const key = `${tab}|${mode}`
  const text = DESCRIPTORS[key]
  if (!text) return null
  return (
    <p
      style={{
        color: 'var(--canvas-dark-ink-muted)',
        fontSize: 12,
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        margin: 0,
        paddingTop: 2,
      }}
    >
      {text}
    </p>
  )
}
