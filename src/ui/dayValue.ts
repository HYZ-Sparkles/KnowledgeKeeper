/** UTC-normalized value of a local calendar day (YYYY-MM-DD), for day gaps. */
export function calendarValue(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}
