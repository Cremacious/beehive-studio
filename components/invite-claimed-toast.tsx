'use client'
import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'

type Props = { copy: string }

export function InviteClaimedToast({ copy }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (searchParams.get('invite_claimed') !== '1') return
    firedRef.current = true
    toast.success(copy)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('invite_claimed')
    const nextUrl = next.toString() ? `${pathname}?${next.toString()}` : pathname
    router.replace(nextUrl)
  }, [searchParams, pathname, copy, router])

  return null
}
