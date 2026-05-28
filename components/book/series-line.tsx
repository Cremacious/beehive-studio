type Props = {
  seriesName: string | null
  seriesNumber: number | null
  className?: string
}

export function SeriesLine({ seriesName, seriesNumber, className }: Props) {
  if (!seriesName) return null
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.05em',
      }}
    >
      {seriesNumber !== null
        ? <>Book {seriesNumber} · <span className="italic">{seriesName}</span></>
        : <>Part of <span className="italic">{seriesName}</span></>}
    </span>
  )
}
