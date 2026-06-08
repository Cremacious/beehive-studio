'use server'

/**
 * C5b T9 — Async resolver for MENTION notification deep links.
 *
 * The bell click handler used to compute hrefs synchronously from
 * `resourceType + resourceId` alone, which forced parent-hub
 * approximations for surfaces whose `resourceId` doesn't carry the
 * routing context (e.g. a hive discussion reply only knows its own id,
 * not the hiveId or discussionId).
 *
 * This resolver fans out to per-surface lookup actions and returns a
 * precise deep-link path. On lookup failure it falls back to a sensible
 * parent hub so the bell click is never a dead end.
 */

import {
  getDiscussionClubIdAction,
  getReplyDiscussionAndClubIdAction,
} from '@/lib/actions/book-clubs.actions'
import {
  getHiveDiscussionParentsAction,
  getHiveReplyParentsAction,
} from '@/lib/actions/hive-discussions.actions'
import { getBuzzHiveIdAction } from '@/lib/actions/hive-buzz.actions'
import { getAnnotationParentsAction } from '@/lib/actions/hive-annotations.actions'
import { getSuggestionParentsAction } from '@/lib/actions/hive-suggestions.actions'
import { getCommentBookIdAction } from '@/lib/actions/social.actions'
import { getListBookCommentaryListIdAction } from '@/lib/actions/reading-lists.actions'
import { getSparkEntryCommentParentsAction } from '@/lib/actions/sparks.actions'

export async function resolveMentionDeepLink(
  resourceType: string,
  resourceId: string,
  locale: string,
): Promise<string> {
  if (!resourceId) return `/${locale}/community`

  switch (resourceType) {
    case 'book_club_discussion': {
      const r = await getDiscussionClubIdAction(resourceId)
      if (!r.success) return `/${locale}/clubs`
      return `/${locale}/clubs/${r.data.clubId}/discussions/${resourceId}`
    }
    case 'book_club_discussion_reply': {
      const r = await getReplyDiscussionAndClubIdAction(resourceId)
      if (!r.success) return `/${locale}/clubs`
      return `/${locale}/clubs/${r.data.clubId}/discussions/${r.data.discussionId}`
    }
    case 'hive_discussion': {
      const r = await getHiveDiscussionParentsAction(resourceId)
      if (!r.success) return `/${locale}/community`
      return `/${locale}/hive/${r.data.hiveId}/discussions/${resourceId}`
    }
    case 'hive_discussion_reply': {
      const r = await getHiveReplyParentsAction(resourceId)
      if (!r.success) return `/${locale}/community`
      return `/${locale}/hive/${r.data.hiveId}/discussions/${r.data.discussionId}`
    }
    case 'hive_buzz_post': {
      const r = await getBuzzHiveIdAction(resourceId)
      if (!r.success) return `/${locale}/community`
      return `/${locale}/hive/${r.data.hiveId}/buzz`
    }
    case 'hive_annotation': {
      const r = await getAnnotationParentsAction(resourceId)
      if (!r.success) return `/${locale}/community`
      return `/${locale}/hive/${r.data.hiveId}/chapters/${r.data.chapterId}`
    }
    case 'hive_suggestion': {
      const r = await getSuggestionParentsAction(resourceId)
      if (!r.success) return `/${locale}/community`
      return `/${locale}/hive/${r.data.hiveId}/chapters/${r.data.chapterId}`
    }
    case 'book_comment': {
      const r = await getCommentBookIdAction(resourceId)
      if (!r.success) return `/${locale}/community`
      return `/${locale}/books/${r.data.bookId}?tab=comments`
    }
    case 'spark_entry_comment':
    case 'spark_entry_comment_reply': {
      const r = await getSparkEntryCommentParentsAction(resourceId)
      if (!r.success) return `/${locale}/sparks`
      return `/${locale}/sparks/${r.data.sparkId}/entry/${r.data.entryId}`
    }
    case 'reading_list_description':
      // resourceId IS the listId for description mentions.
      return `/${locale}/reading-lists/${resourceId}`
    case 'reading_list_book_commentary': {
      const r = await getListBookCommentaryListIdAction(resourceId)
      if (!r.success) return `/${locale}/reading-lists`
      return `/${locale}/reading-lists/${r.data.listId}`
    }
    case 'book_club_description':
    case 'book_club_rules':
      // resourceId IS the clubId for metadata mentions.
      return `/${locale}/clubs/${resourceId}`
    default:
      return `/${locale}/community`
  }
}
