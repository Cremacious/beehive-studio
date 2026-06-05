import type { SocialActivityType } from '@/db/schema/social';

export type { SocialActivityType };

export type SubjectType = 'book' | 'chapter' | 'spark_entry' | 'hive' | 'comment' | 'reading_list' | 'book_club';

/** Event types subject to per-(actor,subject) dedupe within `DEDUPE_WINDOW_MS` */
export const DEDUPE_ELIGIBLE: ReadonlySet<SocialActivityType> = new Set<SocialActivityType>([
  'book_liked',
]);

export const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

export type RecordActivityOpts = {
  actorId: string;
  type: SocialActivityType;
  subjectType: SubjectType;
  subjectId: string;
  payload?: Record<string, unknown>;
};
