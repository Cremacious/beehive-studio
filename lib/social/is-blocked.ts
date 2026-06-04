import { cache } from 'react';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/db';
import { userBlocks } from '@/db/schema/social';

export const isBlocked = cache(
  async (viewerId: string, targetId: string): Promise<boolean> => {
    if (viewerId === targetId) return false;
    const row = await db.query.userBlocks.findFirst({
      where: or(
        and(
          eq(userBlocks.blockerId, viewerId),
          eq(userBlocks.blockedId, targetId),
        ),
        and(
          eq(userBlocks.blockerId, targetId),
          eq(userBlocks.blockedId, viewerId),
        ),
      ),
      columns: { blockerId: true },
    });
    return !!row;
  },
);
