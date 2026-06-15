import { SparkCard } from './spark-card'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof SparkCard>, 'size'> & {
  /** Legacy prop — superseded by the status pill + countdown in the new card. Accepted and ignored. */
  showUrgencyCaption?: boolean
}

export function RailSparkCard({ showUrgencyCaption: _unused, ...rest }: Props) {
  return <SparkCard {...rest} size="sm" />
}
