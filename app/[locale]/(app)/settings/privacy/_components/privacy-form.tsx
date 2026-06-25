'use client'

import { useState, useTransition } from 'react'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { updatePrivacySettingAction } from '@/lib/actions/settings.actions'
import { Switch } from '@/components/ui/switch'

type PrivacyKey = 'allowFollow' | 'showLikedBooks' | 'showActivityFeed' | 'appearInSuggested' | 'findableByEmail'

interface PrivacySetting {
  key: PrivacyKey
  label: string
  description: string
  defaultValue: boolean
}

const SETTINGS: PrivacySetting[] = [
  {
    key: 'allowFollow',
    label: 'Allow others to follow me',
    description: 'When on, other writers can follow your profile and see your activity in their feed.',
    defaultValue: true,
  },
  {
    key: 'showLikedBooks',
    label: 'Show liked books on my profile',
    description: 'Your public profile will display books you have liked.',
    defaultValue: true,
  },
  {
    key: 'showActivityFeed',
    label: 'Show my activity on my profile',
    description: 'Followers can see your recent writing activity and milestones on your profile page.',
    defaultValue: true,
  },
  {
    key: 'appearInSuggested',
    label: 'Appear in suggested writers',
    description: 'Your profile may appear in the "Suggested writers" section for other readers.',
    defaultValue: true,
  },
  {
    key: 'findableByEmail',
    label: 'Let others find me by email address',
    description: 'Other users can search for you using your email address.',
    defaultValue: false,
  },
]

interface PrivacyFormProps {
  initialValues: Record<PrivacyKey, boolean>
}

export function PrivacyForm({ initialValues }: PrivacyFormProps) {
  const [values, setValues] = useState(initialValues)
  const [pending, setPending] = useState<PrivacyKey | null>(null)
  const [, startTransition] = useTransition()

  function handleToggle(key: PrivacyKey, newValue: boolean) {
    const prev = values[key]
    setValues((v) => ({ ...v, [key]: newValue }))
    setPending(key)
    startTransition(async () => {
      try {
        const result = await updatePrivacySettingAction(key, newValue)
        if (!result.success) {
          setValues((v) => ({ ...v, [key]: prev }))
          toastActionError(result.error)
        }
      } catch {
        setValues((v) => ({ ...v, [key]: prev }))
        toastNetworkError()
      } finally {
        setPending(null)
      }
    })
  }

  return (
    <ul className="flex flex-col gap-4 list-none m-0 p-0">
      {SETTINGS.map(({ key, label, description }) => (
        <li
          key={key}
          className="flex items-start gap-4 py-4 px-5 rounded-[14px]"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          <div className="flex-1 min-w-0">
            <div
              className="text-[13.5px] font-semibold"
              style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
            >
              {label}
            </div>
            <div className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              {description}
            </div>
          </div>
          <Switch
            checked={values[key]}
            onCheckedChange={(checked) => handleToggle(key, checked)}
            disabled={pending === key}
            aria-label={label}
          />
        </li>
      ))}
    </ul>
  )
}
