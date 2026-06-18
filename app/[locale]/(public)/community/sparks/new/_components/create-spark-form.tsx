'use client'

import { SparkForm } from '../../_components/spark-form'

type Props = {
  locale: string
  defaultPrompt?: string
  defaultWordLimit?: number
}

export function CreateSparkForm({ locale, defaultPrompt, defaultWordLimit }: Props) {
  return (
    <SparkForm
      locale={locale}
      mode="create"
      defaultPrompt={defaultPrompt}
      defaultWordLimit={defaultWordLimit}
    />
  )
}
