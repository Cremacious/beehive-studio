import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookClubMembers, bookClubJoinRequests } from '@/db/schema/social';
import type { BookClubMemberRole } from '@/db/schema/social';

export const getClubMembership = cache(
  async (
    viewerId: string | null,
    clubId: string,
  ): Promise<{ role: BookClubMemberRole | null; pendingJoinRequest: boolean }> => {
    if (!viewerId) return { role: null, pendingJoinRequest: false };
    const row = await db.query.bookClubMembers.findFirst({
      where: and(eq(bookClubMembers.userId, viewerId), eq(bookClubMembers.clubId, clubId)),
      columns: { role: true },
    });
    if (row) {
      // Members never have a pending join request.
      return { role: row.role, pendingJoinRequest: false };
    }
    const pending = await db.query.bookClubJoinRequests.findFirst({
      where: and(
        eq(bookClubJoinRequests.userId, viewerId),
        eq(bookClubJoinRequests.clubId, clubId),
        eq(bookClubJoinRequests.status, 'PENDING'),
      ),
      columns: { id: true },
    });
    return { role: null, pendingJoinRequest: !!pending };
  },
);
