import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookClubMembers } from '@/db/schema/social';
import type { BookClubMemberRole } from '@/db/schema/social';

export const getClubMembership = cache(
  async (
    viewerId: string | null,
    clubId: string,
  ): Promise<{ role: BookClubMemberRole | null }> => {
    if (!viewerId) return { role: null };
    const row = await db.query.bookClubMembers.findFirst({
      where: and(eq(bookClubMembers.userId, viewerId), eq(bookClubMembers.clubId, clubId)),
      columns: { role: true },
    });
    return { role: row?.role ?? null };
  },
);
