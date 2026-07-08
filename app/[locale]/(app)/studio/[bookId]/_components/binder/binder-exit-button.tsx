'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, DoorOpen } from 'lucide-react'
import { useBookEditor } from '../book-editor-provider'

// "Save & exit" affordance for writers who don't trust auto-save and want an
// explicit "I'm done, get me out" action (issue #56). Lives in the binder
// footer alongside the other book-scoped leave/manage controls (Book details,
// Go to Hive). Neutral chrome so it doesn't add a third brand-yellow surface
// next to the "+ Add" / "Go to Hive" accents.
export function BinderExitButton() {
  const { flushPendingSave, locale } = useBookEditor()
  const router = useRouter()
  const [exiting, setExiting] = useState(false)

  async function handleExit() {
    if (exiting) return
    setExiting(true)
    try {
      // Flush any debounced chapter save and WAIT for it to persist before
      // leaving, so a last-second edit is never lost to the navigation.
      await flushPendingSave()
      toast.success('Saved. Your work is safe.')
      router.push(`/${locale}/studio`)
    } catch {
      // performSave surfaces its own error toast; re-enable so the user can
      // retry rather than being stuck on a spinner.
      setExiting(false)
    }
  }

  return (
    <button
      onClick={() => void handleExit()}
      disabled={exiting}
      aria-label="Save and exit to library"
      title="Save and return to your library"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
        color: 'var(--canvas-dark-ink-strong)',
      }}
      className="w-full flex items-center justify-center gap-2 px-2.5 py-2 font-semibold transition-[filter] text-[13px] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {exiting ? (
        <>
          <Check size={14} className="flex-shrink-0" />
          <span>Saving…</span>
        </>
      ) : (
        <>
          <DoorOpen size={14} className="flex-shrink-0" />
          <span>Save &amp; exit</span>
        </>
      )}
    </button>
  )
}
