/**
 * Generates a short title for a spark from its prompt. Takes the first 4
 * words, title-cases each, strips trailing punctuation, caps at 50 chars.
 * Used by:
 *   - seed-discover.ts to invent titles for seeded prompts
 *   - migrate-sparks-title.ts as a fallback when title is empty
 *
 * Deterministic — same input → same output (no randomness).
 */
export function synthesizeTitle(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, ' ')
  if (cleaned.length === 0) return 'Untitled Spark'
  const words = cleaned.split(' ').slice(0, 4)
  const titleCased = words
    .map((w) => {
      if (w.length === 0) return w
      return w[0].toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
  const stripped = titleCased.replace(/[.,;:!?\-'"]+$/, '')
  return stripped.length <= 50 ? stripped : stripped.slice(0, 49).trimEnd() + '…'
}
