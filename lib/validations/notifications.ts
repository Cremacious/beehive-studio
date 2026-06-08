import { z } from 'zod'
import { notificationTypeEnum } from '@/db/schema/social'

export const NOTIFICATION_TYPE_VALUES = notificationTypeEnum.enumValues

export const updatePreferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPE_VALUES),
  optedOut: z.boolean(),
})
