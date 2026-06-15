import { SparkCard } from './spark-card'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof SparkCard>, 'size'>

export function SparkGridCard(props: Props) {
  return <SparkCard {...props} size="md" />
}
