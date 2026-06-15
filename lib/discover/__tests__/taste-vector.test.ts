import { describe, it, expect } from 'vitest'
import { topGenres } from '../taste-vector'

describe('topGenres', () => {
  it('returns empty when no signal', () => {
    expect(topGenres([], 3)).toEqual([])
  })

  it('sums weights per genre and returns top N', () => {
    expect(topGenres([
      { genre: 'fantasy', weight: 3 },
      { genre: 'fantasy', weight: 2 },
      { genre: 'sci-fi', weight: 4 },
    ], 3)).toEqual(['fantasy', 'sci-fi'])
  })

  it('alphabetical tiebreak when scores tie', () => {
    expect(topGenres([
      { genre: 'sci-fi', weight: 1 },
      { genre: 'romance', weight: 1 },
      { genre: 'fantasy', weight: 1 },
    ], 3)).toEqual(['fantasy', 'romance', 'sci-fi'])
  })

  it('drops null and invalid genres silently', () => {
    expect(topGenres([
      { genre: null, weight: 5 },
      { genre: 'not-a-real-genre', weight: 5 },
      { genre: 'fantasy', weight: 1 },
    ], 3)).toEqual(['fantasy'])
  })

  it('returns at most N entries', () => {
    expect(topGenres([
      { genre: 'fantasy', weight: 1 },
      { genre: 'sci-fi', weight: 2 },
      { genre: 'romance', weight: 3 },
      { genre: 'mystery', weight: 4 },
    ], 2)).toEqual(['mystery', 'romance'])
  })
})
