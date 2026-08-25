export type TimeRange = "allTime" | "today" | "last7" | "last30";

const HOURS: Record<Exclude<TimeRange, "allTime">, number> = {
  today: 24,
  last7: 24 * 7,
  last30: 24 * 30,
};

/** ISO lower bound for a range, or undefined for all time (D-24). */
export function rangeToSince(range: TimeRange): string | undefined {
  const hours = HOURS[range as Exclude<TimeRange, "allTime">];
  if (!hours) return undefined;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
