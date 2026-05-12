'use client'

import type { BinderItemRow } from '@/lib/actions/binder.actions'

type BookEditorContextValue = Record<string, never>

type Props = {
  bookId: string
  bookTitle: string
  initialBinderItems: BinderItemRow[]
  children: React.ReactNode
}

export function BookEditorProvider({ children }: Props) {
  return <>{children}</>
}

export function useBookEditor(): BookEditorContextValue {
  return {}
}
