import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getNotificationPreferencesAction } from '@/lib/notifications/get-preferences'
import { PageHead } from '@/components/community/page-head'
import { NotificationPreferencesForm } from './_components/notification-preferences-form'
import { getOptionalUserId } from '@/lib/require-auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

function pickAvatarAccent(seed: string): string {
  const accents = ['a-mint', 'a-blue', 'a-coral', 'a-lilac', 'a-slate'] as const
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return accents[Math.abs(hash) % accents.length]
}

function initialsOf(displayName: string | null, username: string | null): string {
  const src = (displayName ?? username ?? '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || src.charAt(0).toUpperCase()
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [result, userId] = await Promise.all([
    getNotificationPreferencesAction(),
    getOptionalUserId(),
  ])
  if (!result.success) redirect(`/${locale}/sign-in`)

  const profile = userId
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
        columns: { avatarUrl: true, displayName: true, username: true },
      })
    : null

  const avatarAccent = profile ? pickAvatarAccent(userId!) : 'a-slate'
  const avatarInitials = initialsOf(profile?.displayName ?? null, profile?.username ?? null)

  return (
    <main className="cm-wrap w-3xl">
      {/* Profile summary card */}
      {profile && (
        <div
          className="flex items-center gap-4 rounded-[16px] px-5 py-4 mb-6"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <span
            className={`avatar s44 ${avatarAccent} flex-shrink-0`}
            style={{ border: '2px solid var(--canvas-dark-300)', overflow: 'hidden' }}
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              avatarInitials
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="font-semibold text-[14px] truncate"
              style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
            >
              {profile.displayName ?? profile.username ?? 'Your account'}
            </div>
            {profile.username && (
              <div className="text-[12px] truncate" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                @{profile.username}
              </div>
            )}
          </div>
          {profile.username ? (
            <Link
              href={`/${locale}/u/${profile.username}`}
              className="flex items-center gap-1.5 text-[12px] font-medium no-underline hover:underline underline-offset-4 flex-shrink-0"
              style={{ color: 'var(--brand)' }}
            >
              View public profile
              <ExternalLink size={12} />
            </Link>
          ) : (
            <span
              className="text-[11px] flex-shrink-0"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Complete onboarding to view profile
            </span>
          )}
        </div>
      )}

      <PageHead
        title="Notification preferences"
        subtitle="Choose what reaches you. Toggles save the moment you flip them. On means you're receiving."
      />
      <NotificationPreferencesForm
        initialOptedOutTypes={result.data.optedOutTypes}
      />

      <div className="mt-8 pt-6" style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)' }}>
        <Link
          href={`/${locale}/settings/account`}
          className="text-[13.5px] hover:underline underline-offset-4 transition-colors"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Account settings (danger zone)
        </Link>
      </div>
    </main>
  )
}
