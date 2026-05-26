export type FeedAuthor = {
  id: string
  username: string
  image: string | null
}

export type NewChapterFeedItem = {
  type: 'new_chapter'
  chapterId: string
  bookId: string
  bookTitle: string
  chapterTitle: string
  chapterNumber: number
  author: FeedAuthor
  publishedAt: Date
}

export type NewBookFeedItem = {
  type: 'new_book'
  bookId: string
  bookTitle: string
  bookCover: string | null
  synopsis: string | null
  author: FeedAuthor
  publishedAt: Date
}

export type NewSparkFeedItem = {
  type: 'new_spark'
  sparkId: string
  sparkPrompt: string
  deadline: Date | null
  author: FeedAuthor
  createdAt: Date
}

export type FeedItem = NewChapterFeedItem | NewBookFeedItem | NewSparkFeedItem

export function feedItemTimestamp(item: FeedItem): Date {
  return item.type === 'new_spark' ? item.createdAt : item.publishedAt
}

export type SuggestedWriter = {
  id: string
  username: string
  image: string | null
  bio: string | null
  bookCount: number
  isFollowing: boolean
}

export type ActiveSparkEntry = {
  sparkId: string
  sparkPrompt: string
  entryId: string
  status: 'submitted' | 'voting' | 'awaiting_winner' | 'won'
  deadline: Date | null
}
