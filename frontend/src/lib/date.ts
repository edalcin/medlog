/**
 * Date utilities that treat consultation dates as calendar dates (no UTC shift).
 *
 * The backend stores dates as UTC midnight (e.g. "2026-05-29T00:00:00Z").
 * Using `new Date(iso)` interprets them as UTC and then toLocaleDateString
 * converts to local time — in UTC-3 (Brazil) this shifts the displayed date
 * one day back. All date-only values must be parsed via `localDate()`.
 */

/** Parse an ISO date string as a local calendar date (no timezone shift). */
export function localDate(iso: string): Date {
  const s = iso.substring(0, 10) // "YYYY-MM-DD"
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Current local date as "YYYY-MM-DD" (safe replacement for toISOString().split('T')[0]). */
export function todayISO(): string {
  const n = new Date()
  return (
    n.getFullYear() +
    '-' +
    String(n.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(n.getDate()).padStart(2, '0')
  )
}
