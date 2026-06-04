import { describe, it, expect } from 'vitest';
import { deriveTitle } from '../derive-title';

describe('deriveTitle', () => {
  it('uses explicit title (trimmed) when non-empty', () => {
    expect(deriveTitle('  My Title  ', 'first line\nrest')).toBe('My Title');
  });

  it('falls back to the first line of content when title is null/blank', () => {
    expect(deriveTitle(null, 'first line\nsecond')).toBe('first line');
    expect(deriveTitle('   ', 'hello world\nmore')).toBe('hello world');
    expect(deriveTitle(undefined, 'only one line')).toBe('only one line');
  });

  it('returns "Untitled entry" when both title and content are blank', () => {
    expect(deriveTitle(null, '')).toBe('Untitled entry');
    expect(deriveTitle('   ', '   \nthen something')).toBe('Untitled entry');
    expect(deriveTitle(undefined, '\n\n')).toBe('Untitled entry');
  });

  it('truncates first-line fallback at 80 chars with ellipsis', () => {
    const long = 'a'.repeat(120);
    const result = deriveTitle(null, long);
    expect(result.length).toBe(81); // 80 chars + ellipsis
    expect(result.endsWith('…')).toBe(true);
    expect(result.startsWith('a'.repeat(80))).toBe(true);
  });

  it('does NOT truncate explicit titles (only fallback path truncates)', () => {
    const longTitle = 'b'.repeat(120);
    expect(deriveTitle(longTitle, 'ignored')).toBe(longTitle);
  });
});
