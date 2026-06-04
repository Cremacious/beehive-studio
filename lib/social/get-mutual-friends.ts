import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/db';
import { friendships } from '@/db/schema/social';
import { userProfiles } from '@/db/schema/auth';

export type MutualFriend = {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db.query.friendships.findMany({
    where: and(
      eq(friendships.status, 'ACCEPTED'),
      or(
        eq(friendships.requesterId, userId),
        eq(friendships.recipientId, userId),
      ),
    ),
    columns: { requesterId: true, recipientId: true },
  });
  return rows.map((r) =>
    r.requesterId === userId ? r.recipientId : r.requesterId,
  );
}

export async function getMutualFriends(
  viewerId: string,
  otherUserId: string,
  limit = 9,
): Promise<{ mutuals: MutualFriend[]; total: number }> {
  if (viewerId === otherUserId) return { mutuals: [], total: 0 };
  const [viewerFriends, otherFriends] = await Promise.all([
    getAcceptedFriendIds(viewerId),
    getAcceptedFriendIds(otherUserId),
  ]);
  const otherSet = new Set(otherFriends);
  const intersect = viewerFriends.filter((id) => otherSet.has(id));
  if (intersect.length === 0) return { mutuals: [], total: 0 };

  const rows = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, intersect))
    .limit(limit);

  return { mutuals: rows, total: intersect.length };
}
