import { z } from 'zod'

export const beaconSaveSchema = z.object({
  chapterId: z.string().min(1),
  content: z
    .object({ type: z.literal('doc') })
    .passthrough(),
})

export type BeaconSavePayload = z.infer<typeof beaconSaveSchema>
