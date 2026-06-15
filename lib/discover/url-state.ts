export type TabId = 'home' | 'books' | 'sparks' | 'hives' | 'lists' | 'clubs'

export const TAB_IDS = ['home', 'books', 'sparks', 'hives', 'lists', 'clubs'] as const

const TAB_SET: ReadonlySet<TabId> = new Set(TAB_IDS)

export function parseTab(raw: string | undefined | null): TabId {
  if (raw && (TAB_SET as ReadonlySet<string>).has(raw)) {
    return raw as TabId
  }
  return 'home'
}

export function parseMultiSelect(raw: string | undefined | null): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      result.push(trimmed)
    }
  }
  return result
}

export function parseRadio<T extends string>(
  raw: string | undefined | null,
  allowed: readonly T[],
  fallback: T
): T {
  if (raw && (allowed as readonly string[]).includes(raw)) {
    return raw as T
  }
  return fallback
}

export function parseIntParam(raw: string | undefined | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return fallback
  return n
}

export function parseStringParam(raw: string | undefined | null, maxLen = 200): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, maxLen)
}

type UrlParams = Record<string, string | string[] | undefined>

export function buildUrl(tab: TabId, params: UrlParams, basePath = '/discover'): string {
  const search = new URLSearchParams()
  search.set('tab', tab)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      search.set(key, value.join(','))
    } else {
      if (value === '') continue
      search.set(key, value)
    }
  }
  return `${basePath}?${search.toString()}`
}

export function toggleMulti(current: string[], value: string): string[] {
  if (current.includes(value)) {
    return current.filter((v) => v !== value)
  }
  return [...current, value]
}

export type ModeId = 'for-you' | 'trending' | 'popular' | 'all'

export const MODE_IDS = ['for-you', 'trending', 'popular', 'all'] as const

const MODE_SET: ReadonlySet<ModeId> = new Set(MODE_IDS)

export function parseMode(raw: string | undefined | null): ModeId | undefined {
  if (raw && (MODE_SET as ReadonlySet<string>).has(raw)) {
    return raw as ModeId
  }
  return undefined
}
