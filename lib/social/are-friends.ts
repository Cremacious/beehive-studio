import { cache } from 'react';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/db';
import { friendships } from '@/db/schema/social';

export const areFriends = cache(
  async (userIdA: string, userIdB: string): Promise<boolean> => {
    if (userIdA === userIdB) return false;
    const row = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.status, 'ACCEPTED'),
        or(
          and(
            eq(friendships.requesterId, userIdA),
            eq(friendships.recipientId, userIdB),
          ),
          and(
            eq(friendships.requesterId, userIdB),
            eq(friendships.recipientId, userIdA),
          ),
        ),
      ),
      columns: { id: true },
    });
    return !!row;
  },
);
