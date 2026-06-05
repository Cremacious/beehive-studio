'use client'

type Props = {
  listId: string
  initialFollowing: boolean
}

/**
 * T10 stub. T13 will enrich with optimistic flip + rollback + sonner
 * toast on followListAction / unfollowListAction.
 */
export function FollowListButton({ listId, initialFollowing }: Props) {
  void listId
  return (
    <button
      type="button"
      disabled
      className="text-xs px-3 py-1 rounded-[var(--r-pill)] font-semibold opacity-60 cursor-not-allowed"
      style={{
        background: initialFollowing ? 'var(--brand)' : 'transparent',
        color: initialFollowing ? 'var(--brand-ink)' : 'var(--brand)',
        border: initialFollowing ? 'none' : '1px solid var(--brand)',
      }}
      title="Coming soon (T13)"
    >
      {initialFollowing ? '✓ Following' : '+ Follow'}
    </button>
  )
}
