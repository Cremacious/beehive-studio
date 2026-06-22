import { MessageSquare } from 'lucide-react'
import type { BookClubMemberRole } from '@/db/schema/social'
import { ClubDiscussionsPanel } from '../../_components/club-discussions-panel'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  locale: string
}

export function ClubDiscussionsSection({ clubId, viewerRole, locale }: Props) {
  return (
    <section
      style={{
        borderRadius: 'var(--r-card)',
        background: 'linear-gradient(180deg, var(--canvas-dark-250) 0%, var(--canvas-dark-200) 100%)',
        boxShadow: 'var(--sh-card)',
        padding: '14px 20px 20px',
        marginBottom: 24,
      }}
    >
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <MessageSquare aria-hidden="true" style={{ width: 15, height: 15, color: 'var(--brand)' }} />
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--brand)',
            margin: 0,
          }}
        >
          Discussions
        </h2>
      </div>
      <ClubDiscussionsPanel clubId={clubId} viewerRole={viewerRole} locale={locale} />
    </section>
  )
}
