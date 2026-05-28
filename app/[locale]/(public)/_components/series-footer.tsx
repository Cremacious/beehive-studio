import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SeriesNeighbors } from '@/lib/books/get-series-neighbors'

type Props = {
  neighbors: SeriesNeighbors
  locale: string
}

export function SeriesFooter({ neighbors, locale }: Props) {
  const { previous, next } = neighbors
  if (!previous && !next) return null

  return (
    <div className="border-t border-[#2a2a2a] mt-8 pt-6 grid grid-cols-2 gap-4 px-6 pb-10">
      <div>
        {previous && (
          <Link
            href={`/${locale}/books/${previous.id}`}
            className="flex flex-col gap-1 hover:opacity-90 transition-opacity"
          >
            <span className="text-[10px] uppercase tracking-wider text-[#666] flex items-center gap-1">
              <ChevronLeft size={12} /> Previous in series
            </span>
            <span className="text-[14px] text-[#aaa]">
              {previous.seriesNumber !== null ? `Book ${previous.seriesNumber}: ` : ''}
              {previous.title}
            </span>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next && (
          <Link
            href={`/${locale}/books/${next.id}`}
            className="flex flex-col gap-1 items-end hover:opacity-90 transition-opacity"
          >
            <span className="text-[10px] uppercase tracking-wider text-[#666] flex items-center gap-1">
              Next in series <ChevronRight size={12} />
            </span>
            <span className="text-[14px] text-[#aaa]">
              {next.seriesNumber !== null ? `Book ${next.seriesNumber}: ` : ''}
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </div>
  )
}
