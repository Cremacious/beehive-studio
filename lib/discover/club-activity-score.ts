export type ClubActivityInputs = {
  discussions7d: number
  bookChanges7d: number
  newMembers7d: number
}

export function computeClubActivityScore7d(i: ClubActivityInputs): number {
  return i.discussions7d + i.bookChanges7d * 3 + i.newMembers7d * 2
}
