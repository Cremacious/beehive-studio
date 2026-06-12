export type HiveActivityInputs = {
  buzzPosts7d: number
  wordLogs7d: number
  discussions7d: number
  chapterUpdates7d: number
  submissions7d: number
}

export function computeHiveActivityScore7d(i: HiveActivityInputs): number {
  return i.buzzPosts7d + i.wordLogs7d * 0.5 + i.discussions7d * 2 + i.chapterUpdates7d * 3 + i.submissions7d * 4
}
