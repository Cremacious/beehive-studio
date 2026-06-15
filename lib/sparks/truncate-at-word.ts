/**
 * Truncates `text` at or before `maxLen`, preferring the last whitespace
 * boundary so we don't cut mid-word. Returns the original text if it
 * already fits. Returns at most `maxLen + 1` chars (the trailing '…').
 *
 * Edge case: if no whitespace exists before maxLen (single huge word),
 * falls back to a hard maxLen-char slice + ellipsis.
 */
export function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace === -1) return slice + '…'
  return slice.slice(0, lastSpace).trimEnd() + '…'
}
