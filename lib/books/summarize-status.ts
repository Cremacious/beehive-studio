export type BookSummaryStatus = 'Drafting' | 'Revised' | 'Published'

type Input = {
  bookStatus: string | null   // from books.status (e.g., 'PUBLISHED' / 'DRAFT')
  chapterStatuses: ('IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL')[]
}

/**
 * Rolls chapter-level statuses up to a single book-level status for the
 * library card overlay + filter chip counts. Same helper drives both so
 * counts and labels stay in sync.
 *
 * - If the book itself is PUBLISHED → 'Published'.
 * - Else if all chapters are REVISED or FINAL (and at least one exists) → 'Revised'.
 * - Else → 'Drafting' (default, includes empty books).
 */
export function summarizeBookStatus({ bookStatus, chapterStatuses }: Input): BookSummaryStatus {
  if (bookStatus === 'PUBLISHED') return 'Published'

  if (chapterStatuses.length > 0) {
    const allRevisedOrFinal = chapterStatuses.every(s => s === 'REVISED' || s === 'FINAL')
    if (allRevisedOrFinal) return 'Revised'
  }

  return 'Drafting'
}
