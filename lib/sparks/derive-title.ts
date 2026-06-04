/**
 * Derive a display title for a Spark entry.
 *
 * Precedence:
 *  1. Explicit title (trimmed) if non-empty.
 *  2. First line of content (trimmed), truncated to 80 chars with ellipsis.
 *  3. "Untitled entry" fallback when both are empty.
 */
export function deriveTitle(
  explicitTitle: string | null | undefined,
  content: string,
): string {
  const trimmed = explicitTitle?.trim();
  if (trimmed) return trimmed;
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  if (!firstLine) return 'Untitled entry';
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
}
