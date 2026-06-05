import { and, eq } from 'drizzle-orm';
import { bookClubs, bookClubBooks } from '@/db/schema/social';
import { recordSocialActivityTx } from '@/lib/social/record-activity';
import { db } from '@/db';

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type DeriveOpts = {
  clubId: string;
  newCurrentBookId: string;
  actorId: string;
  clubName: string;
  clubVisibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  clubDiscoverable: boolean;
};

/** Atomic current-book transition: PAST flip + new CURRENT + pointer update + activity fire. */
export async function deriveCurrentBookTx(tx: DrizzleTx, opts: DeriveOpts): Promise<void> {
  // 1. Find existing CURRENT row (if any) for this club; capture title.
  const existing = await tx.query.bookClubBooks.findFirst({
    where: and(eq(bookClubBooks.clubId, opts.clubId), eq(bookClubBooks.status, 'CURRENT')),
    columns: { id: true, title: true },
  });

  // 2. Flip existing CURRENT → PAST + set finished_at (only if different from new target).
  if (existing && existing.id !== opts.newCurrentBookId) {
    await tx
      .update(bookClubBooks)
      .set({ status: 'PAST', finishedAt: new Date() })
      .where(eq(bookClubBooks.id, existing.id));
  }

  // 3. Set target row to CURRENT + set started_at.
  await tx
    .update(bookClubBooks)
    .set({ status: 'CURRENT', startedAt: new Date() })
    .where(eq(bookClubBooks.id, opts.newCurrentBookId));

  // 4. Update denorm pointer on club row.
  await tx
    .update(bookClubs)
    .set({ currentBookId: opts.newCurrentBookId, updatedAt: new Date() })
    .where(eq(bookClubs.id, opts.clubId));

  // 5. Fire activity event if PUBLIC+discoverable.
  if (opts.clubVisibility === 'PUBLIC' && opts.clubDiscoverable) {
    const newRow = await tx.query.bookClubBooks.findFirst({
      where: eq(bookClubBooks.id, opts.newCurrentBookId),
      columns: { title: true },
    });
    await recordSocialActivityTx(tx, {
      actorId: opts.actorId,
      type: 'book_club_current_book_changed',
      subjectType: 'book_club',
      subjectId: opts.clubId,
      payload: {
        clubName: opts.clubName,
        fromBookTitle: existing?.title ?? null,
        toBookTitle: newRow?.title ?? 'Untitled',
      },
    });
  }
}
