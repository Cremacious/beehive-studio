export type ChapterStatus =
  | 'IDEA'
  | 'OUTLINE'
  | 'FIRST_DRAFT'
  | 'REVISED'
  | 'FINAL'

/**
 * Returns true if a non-author viewer of the public reader can read the
 * chapter's prose. Chapters at this threshold (REVISED or FINAL) render
 * fully; everything below renders as a "Draft — coming soon" locked teaser.
 *
 * The author of the book is always able to read every chapter regardless;
 * callers gate by viewer identity BEFORE calling this helper.
 */
export function isChapterReaderVisible(status: ChapterStatus): boolean {
  return status === 'REVISED' || status === 'FINAL'
}
