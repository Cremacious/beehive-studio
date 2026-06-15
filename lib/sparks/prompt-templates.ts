export type PromptTemplate = { prompt: string; wordLimit: number }

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  { prompt: 'A door that only opens on Tuesdays', wordLimit: 500 },
  { prompt: 'Write a 100-word story where nothing happens, and it matters', wordLimit: 100 },
  { prompt: "What if [object] could remember? Pick an everyday object. Give it 100 years of memory", wordLimit: 800 },
  { prompt: 'The last letter from a sentient lighthouse', wordLimit: 600 },
  { prompt: 'A 3-line poem about hunger', wordLimit: 50 },
  { prompt: "Describe a color that doesn't exist", wordLimit: 300 },
  { prompt: 'Two strangers, one bench, no dialogue', wordLimit: 500 },
  { prompt: 'Write a recipe for an emotion', wordLimit: 200 },
  { prompt: "Your character's morning routine, but reveal a secret on line 7", wordLimit: 400 },
  { prompt: 'A weather report from inside a dream', wordLimit: 250 },
]

/** Returns 1-366 (day-of-year, UTC). */
export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  return Math.floor((d.getTime() - start) / 86_400_000)
}

/** Simple string hash → non-negative int. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Deterministic per-viewer-per-day pick. Same viewer on same day = same template. */
export function pickPromptTemplate(viewerId: string, now: Date = new Date()): PromptTemplate {
  const idx = (hashString(viewerId) + dayOfYear(now)) % PROMPT_TEMPLATES.length
  return PROMPT_TEMPLATES[idx]
}
