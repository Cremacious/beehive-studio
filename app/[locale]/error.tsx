'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Log the actual error so we can debug instead of staring at "Something went wrong."
  useEffect(() => {
    console.error('[error boundary]', error)
    if (error?.stack) console.error(error.stack)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
      <p className="text-white/70">Something went wrong.</p>
      <pre className="max-w-2xl whitespace-pre-wrap text-xs text-white/40 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-3 max-h-64 overflow-auto">
        {error?.message ?? String(error)}
      </pre>
      {error?.digest && (
        <p className="text-[10px] text-white/30">digest: {error.digest}</p>
      )}
      <button onClick={reset} className="text-[#FFC300] hover:underline text-sm">
        Try again
      </button>
    </div>
  )
}
