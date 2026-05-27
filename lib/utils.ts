import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates a `next` query-param value for post-auth redirects.
 *
 * Returns the raw value only if it is a same-origin path (must start with `/`,
 * must not start with `//`, must not contain `://`). Otherwise returns the
 * provided fallback. This prevents open-redirect attacks where an attacker
 * crafts a `?next=https://evil.com` URL.
 */
export function safeNextPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//')) return fallback
  if (raw.includes('://')) return fallback
  return raw
}
