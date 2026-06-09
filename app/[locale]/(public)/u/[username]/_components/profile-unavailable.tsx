import Link from 'next/link'
import { Lock, ChevronLeft } from 'lucide-react'

type Props = {
  locale: string
}

export function ProfileUnavailable({ locale }: Props) {
  return (
    <div className="claim-stage">
      <div className="claim-card">
        <div className="icon-wrap tone-muted">
          <Lock />
        </div>
        <h1>This profile is unavailable</h1>
        <p>We can&apos;t show this page right now. It may be private, or no longer exist.</p>
        <div className="actions">
          <Link
            className="btn-brand"
            href={`/${locale}/community`}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ChevronLeft />
            Back to community
          </Link>
        </div>
      </div>
    </div>
  )
}
