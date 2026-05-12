import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-4xl font-bold text-white mainFont">404</h1>
      <p className="text-white/50">This page doesn't exist.</p>
      <Link href="/" className="text-[#FFC300] hover:underline text-sm">
        Go home
      </Link>
    </div>
  )
}
