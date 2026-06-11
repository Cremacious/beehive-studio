export type TrendingInputs = {
  likes7d: number
  comments7d: number
  reads7d: number
  follows7d: number
}

export function computeTrendingScore(i: TrendingInputs): number {
  return i.likes7d + i.comments7d * 2 + i.reads7d + i.follows7d * 3
}

export type RisingStarsInputs = TrendingInputs & {
  totalLikesAllTime: number
  ageDays: number
}

export function computeRisingStarsScore(i: RisingStarsInputs): number {
  const trending = computeTrendingScore(i)
  const denom = i.totalLikesAllTime + 1
  const base = trending / denom
  // Demote books older than 180 days at PUBLIC+discoverable
  return i.ageDays > 180 ? base * 0.5 : base
}
