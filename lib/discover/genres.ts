import {
  Sparkles, Rocket, Heart, Search, Skull, Flame, Landmark,
  Coffee, BookText, Users, Compass, Drama, Feather, FileQuestion,
  type LucideIcon,
} from 'lucide-react'

export const GENRES = [
  'fantasy', 'sci-fi', 'romance', 'mystery', 'horror', 'thriller',
  'historical', 'contemporary', 'literary', 'ya', 'adventure',
  'drama', 'poetry', 'other',
] as const

export type GenreSlug = (typeof GENRES)[number]

export const GENRE_LABEL: Record<GenreSlug, string> = {
  'fantasy': 'Fantasy',
  'sci-fi': 'Sci-Fi',
  'romance': 'Romance',
  'mystery': 'Mystery',
  'horror': 'Horror',
  'thriller': 'Thriller',
  'historical': 'Historical',
  'contemporary': 'Contemporary',
  'literary': 'Literary',
  'ya': 'YA',
  'adventure': 'Adventure',
  'drama': 'Drama',
  'poetry': 'Poetry',
  'other': 'Other',
}

export const GENRE_ICON: Record<GenreSlug, LucideIcon> = {
  'fantasy': Sparkles,
  'sci-fi': Rocket,
  'romance': Heart,
  'mystery': Search,
  'horror': Skull,
  'thriller': Flame,
  'historical': Landmark,
  'contemporary': Coffee,
  'literary': BookText,
  'ya': Users,
  'adventure': Compass,
  'drama': Drama,
  'poetry': Feather,
  'other': FileQuestion,
}

export function isValidGenre(slug: string | null | undefined): slug is GenreSlug {
  return typeof slug === 'string' && (GENRES as readonly string[]).includes(slug)
}

/** Normalize free-text genre stored in DB to a known slug; falls back to 'other'. */
export function normalizeGenre(raw: string | null | undefined): GenreSlug {
  if (!raw) return 'other'
  const lower = raw.trim().toLowerCase()
  if (isValidGenre(lower)) return lower
  // Common aliases (extend as needed)
  if (lower === 'science fiction' || lower === 'scifi') return 'sci-fi'
  if (lower === 'young adult') return 'ya'
  return 'other'
}
