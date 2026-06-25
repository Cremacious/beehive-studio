'use client'

import { useState, useTransition } from 'react'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
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
    title: 'From writers you follow',
    description: 'New work from the writers in your circle',
    rows: [
      {
        type: 'NEW_CHAPTER',
        label: 'New chapters',
        sublabel:
          'When a writer you follow publishes a new chapter on a public book',
      },
    ],
  },
  {
    title: 'Hive collaboration',
    description: 'Submissions, suggestions, and annotations on your hives',
    rows: [
      {
        type: 'HIVE_SUBMISSION',
        label: 'Chapter submissions',
        sublabel:
          'When a member submits a chapter for review in a hive you own or moderate',
      },
      {
        type: 'HIVE_SUGGESTION',
        label: 'Suggested edits',
        sublabel: 'When a member proposes an inline suggested edit on your chapter',
      },
      {
        type: 'HIVE_ANNOTATION',
        label: 'Annotations',
        sublabel: 'When a member annotates your chapter',
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
      try {
        const result = await updateNotificationPreferenceAction({
          type,
          optedOut: optedOutNext,
        })
        if (!result.success) {
          setOptedOut(prevSet)
          toastActionError(result.error)
        }
      } catch {
        setOptedOut(prevSet)
        toastNetworkError()
      }
    })
  }

  return (
    <>
      <style>{`
        .np-panel { margin-bottom: 16px; }
        .np-panel:last-child { margin-bottom: 0; }
        .np-panel h2 {
          font-family: var(--font-comfortaa);
          font-weight: 700;
          font-size: 17px;
          color: var(--brand);
          margin: 0 0 4px;
        }
        .np-panel .pd {
          font-size: 13px;
          color: var(--canvas-dark-ink-muted);
          margin: 0 0 14px;
        }
        .np-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 0;
          border-top: 1px solid oklch(from var(--canvas-dark-300) l c h / 0.45);
        }
        .np-row .nl {
          font-family: var(--font-geist-sans, var(--font-ui));
          font-weight: 600;
          font-size: 14px;
          color: var(--canvas-dark-ink-strong);
        }
        .np-row .ns {
          font-size: 12px;
          color: var(--canvas-dark-ink-muted);
          margin-top: 3px;
          max-width: 52ch;
        }
      `}</style>
      {GROUPS.map((group) => (
        <section key={group.title} className="panel panel-pad np-panel">
          <h2>{group.title}</h2>
          <p className="pd">{group.description}</p>
          {group.rows.map((row) => {
            const isOptedOut = optedOut.has(row.type)
            return (
              <div key={row.type} className="np-row">
                <div className="min-w-0 flex-1">
                  <div className="nl">{row.label}</div>
                  <div className="ns">{row.sublabel}</div>
                </div>
                <Switch
                  checked={!isOptedOut}
                  onCheckedChange={(checked) =>
                    handleToggle(row.type, checked)
                  }
                  disabled={pending}
                  aria-label={`Toggle ${row.label}`}
                />
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}
