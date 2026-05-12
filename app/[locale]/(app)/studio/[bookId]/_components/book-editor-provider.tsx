'use client'
export function BookEditorProvider({ children }: { bookId: string; bookTitle: string; initialBinderItems: unknown[]; children: React.ReactNode }) {
  return <>{children}</>
}
export function useBookEditor() { return {} as never }
