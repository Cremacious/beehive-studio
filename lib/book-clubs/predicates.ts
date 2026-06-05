import { areFriends } from '@/lib/social/are-friends';
import { isBlocked } from '@/lib/social/is-blocked';
import { bookVisibilityEnum } from '@/db/schema/books';
import type { BookClubMemberRole } from '@/db/schema/social';

type BookVisibility = (typeof bookVisibilityEnum.enumValues)[number];
type ClubLike = { ownerId: string; visibility: BookVisibility };
type RoleableClub = ClubLike & { openJoin: boolean };

// Visibility-based (async) — viewerMembership param handles members-of-PRIVATE-clubs
export async function canViewClub(
  viewerId: string | null,
  club: ClubLike,
  viewerMembership: { role: BookClubMemberRole | null },
): Promise<boolean> {
  if (viewerId && (await isBlocked(viewerId, club.ownerId))) return false;
  if (viewerMembership.role !== null) return true; // members always see their own clubs
  if (club.visibility === 'PUBLIC') return true;
  if (club.visibility === 'PRIVATE') return false;
  // FRIENDS
  if (!viewerId) return false;
  if (viewerId === club.ownerId) return true;
  return await areFriends(viewerId, club.ownerId);
}

export async function canJoinClub(
  viewerId: string | null,
  club: RoleableClub,
  viewerMembership: { role: BookClubMemberRole | null },
): Promise<boolean> {
  if (!viewerId) return false;
  if (viewerMembership.role !== null) return false; // already a member
  return await canViewClub(viewerId, club, viewerMembership);
}

// Role-based (synchronous)
export function canEditClubMetadata(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR';
}

export function canManageBookQueue(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR';
}

export function canManageSchedule(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR';
}

export function canPinDiscussion(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR';
}

export function canApproveJoinRequest(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR';
}

export function canInviteUser(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR';
}

export function canManageMembers(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR';
}

export function canChangeRole(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER';
}

export function canDeleteClub(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER';
}

export function canPostDiscussion(role: BookClubMemberRole | null): boolean {
  return role !== null; // any member
}
