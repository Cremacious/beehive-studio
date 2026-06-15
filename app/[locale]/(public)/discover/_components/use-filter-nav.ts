'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Shared client hook for filter primitives. Returns a `setParam(name, value)`
 * that writes the URL via `router.replace` (no history entry per change). Pass
 * `null` / `undefined` / `''` / `[]` to drop the param.
 */
export function useFilterNav() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const setParam = useCallback(
    (name: string, value: string | string[] | null | undefined) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      const isEmpty =
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      if (isEmpty) {
        params.delete(name)
      } else if (Array.isArray(value)) {
        params.set(name, value.join(','))
      } else {
        params.set(name, value)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, searchParams, pathname]
  )

  return { setParam, searchParams }
}
