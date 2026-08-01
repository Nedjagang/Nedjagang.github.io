// Deliberately not a dependency: reading time is a word-count divide, not a
// problem that needs a library.
const WORDS_PER_MINUTE = 200;

export function readingMinutes(raw: string): number {
  const words = raw.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function readingTime(raw: string): string {
  return `${readingMinutes(raw)} min read`;
}
