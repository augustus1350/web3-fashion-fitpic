/** Returns today's date at UTC midnight (used for first-post-of-day checks). */
export function utcDateOnly(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
