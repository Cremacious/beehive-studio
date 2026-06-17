'use client'

import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { CreateHiveModal } from '@/app/[locale]/(app)/studio/_components/create-hive-modal'

type Props = {
  /** Optional custom trigger renderer. Default = brand pill with "+ New Hive". */
  children?: (onTrigger: () => void) => ReactNode
}

/**
 * Mounts the shared CreateHiveModal directly on /hives so clicking the
 * primary CTA opens it inline instead of routing to /studio.
 */
export function NewHiveButton({ children }: Props) {
  const [open, setOpen] = useState(false)

  const trigger = children ? (
    children(() => setOpen(true))
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap h-9 px-6 rounded-[var(--r-pill)] text-[13px] font-semibold cursor-pointer"
      style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
    >
      <Plus size={15} />
      <span>New Hive</span>
    </button>
  )

  return (
    <>
      {trigger}
      <CreateHiveModal open={open} onOpenChange={setOpen} />
    </>
  )
}
