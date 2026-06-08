'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { updateNotificationPreferenceAction } from '@/lib/notifications/update-preferences'

type Group = {
  title: string
  description: string
  rows: { type: string; label: string; sublabel: string }[]
}

const GROUPS: Group[] = [
  {
    title: 'Friends',
    description: 'Friend requests and acceptances',
    rows: [
      {
        type: 'FRIEND_REQUEST',
        label: 'Friend requests',
        sublabel: 'When someone sends you a friend request',
      },
      {
        type: 'FRIEND_ACCEPTED',
        label: 'Friend acceptances',
        sublabel: 'When someone accepts your friend request',
      },
    ],
  },
  {
    title: 'Mentions',
    description: 'When someone @-mentions you',
    rows: [
      {
        type: 'MENTION',
        label: 'Mentions',
        sublabel:
          'When someone @-mentions you in a discussion, comment, or post',
      },
    ],
  },
  {
    title: 'Activity on your work',
    description: 'Likes, comments, follows, and spark wins',
    rows: [
      {
        type: 'NEW_LIKE',
        label: 'New likes',
        sublabel: 'When someone likes your book',
      },
      {
        type: 'NEW_COMMENT',
        label: 'New comments',
        sublabel: 'When someone comments on your book',
      },
      {
        type: 'NEW_FOLLOWER',
        label: 'New followers',
        sublabel: 'When someone follows you',
      },
      {
        type: 'SPARK_WIN',
        label: 'Spark wins',
        sublabel: 'When you win a writing spark',
      },
    ],
  },
  {
    title: 'Group invites and requests',
    description: 'Hive and book club invites and requests',
    rows: [
      {
        type: 'HIVE_INVITE',
        label: 'Hive invites',
        sublabel: 'When someone invites you to a hive',
      },
      {
        type: 'CLUB_INVITE',
        label: 'Club invites',
        sublabel: 'When someone invites you to a book club',
      },
      {
        type: 'CLUB_JOIN_REQUEST',
        label: 'Club join requests',
        sublabel: 'When someone requests to join a club you moderate',
      },
      {
        type: 'CLUB_JOIN_APPROVED',
        label: 'Club join approvals',
        sublabel: 'When your club join request is approved',
      },
    ],
  },
]

export function NotificationPreferencesForm({
  initialOptedOutTypes,
}: {
  initialOptedOutTypes: string[]
}) {
  const [optedOut, setOptedOut] = useState(new Set(initialOptedOutTypes))
  const [pending, startTransition] = useTransition()

  const handleToggle = (type: string, nextValue: boolean) => {
    const optedOutNext = !nextValue
    const prevSet = new Set(optedOut)
    const nextSet = new Set(optedOut)
    if (optedOutNext) nextSet.add(type)
    else nextSet.delete(type)
    setOptedOut(nextSet)

    startTransition(async () => {
      const result = await updateNotificationPreferenceAction({
        type,
        optedOut: optedOutNext,
      })
      if (!result.success) {
        setOptedOut(prevSet)
        toast.error('Could not save preference')
      }
    })
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <section
          key={group.title}
          className="rounded-[var(--r-card)] border"
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
            borderColor: 'var(--br-card)',
          }}
        >
          <header
            className="p-4 border-b"
            style={{ borderColor: 'var(--br-card)' }}
          >
            <h2
              className="text-lg font-bold"
              style={{
                color: 'var(--brand)',
                fontFamily: 'var(--font-comfortaa)',
              }}
            >
              {group.title}
            </h2>
            <p className="text-xs text-[var(--canvas-dark-ink-muted)] mt-1">
              {group.description}
            </p>
          </header>
          <ul
            className="divide-y"
            style={{ borderColor: 'var(--br-card)' }}
          >
            {group.rows.map((row) => {
              const isOptedOut = optedOut.has(row.type)
              return (
                <li
                  key={row.type}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--canvas-dark-ink)]">
                      {row.label}
                    </p>
                    <p className="text-xs text-[var(--canvas-dark-ink-muted)] mt-0.5">
                      {row.sublabel}
                    </p>
                  </div>
                  <Switch
                    checked={!isOptedOut}
                    onCheckedChange={(checked) =>
                      handleToggle(row.type, checked)
                    }
                    disabled={pending}
                    aria-label={`Toggle ${row.label}`}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
