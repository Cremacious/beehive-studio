'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-white/70">Something went wrong.</p>
      <button onClick={reset} className="text-[#FFC300] hover:underline text-sm">
        Try again
      </button>
    </div>
  )
}
