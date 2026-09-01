/**
 * Date/time utilities — native `Intl` only, no external date library.
 */

/** Format total seconds → "MM:SS" (quiz timer). */
export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Relative date string like "2 days ago", "just now", etc.
 * Uses native `Intl.RelativeTimeFormat`.
 */
export function formatRelativeDate(
  dateStr: string,
  locale: string = "en",
): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.round((then - now) / 1000);

  const abs = Math.abs(diffSec);
  let unit: Intl.RelativeTimeFormatUnit;
  let value: number;

  if (abs < 60) {
    return locale === "ar" ? "الآن" : "just now";
  } else if (abs < 3600) {
    unit = "minute";
    value = Math.round(diffSec / 60);
  } else if (abs < 86400) {
    unit = "hour";
    value = Math.round(diffSec / 3600);
  } else if (abs < 60 * 86400) {
    unit = "day";
    value = Math.round(diffSec / 86400);
  } else if (abs < 365 * 86400) {
    unit = "month";
    value = Math.round(diffSec / (30 * 86400));
  } else {
    unit = "year";
    value = Math.round(diffSec / (365 * 86400));
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    value,
    unit,
  );
}

/**
 * "This Week (Mon–Sun)" / "هذا الأسبوع (الاثنين–الأحد)"
 * `weekStart` is an ISO date string for the Monday of the target week.
 */
export function formatWeekRange(
  weekStart: string,
  locale: string = "en",
): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { weekday: "short" };
  const fmt = new Intl.DateTimeFormat(locale, opts);
  const startDay = fmt.format(start);
  const endDay = fmt.format(end);

  const label =
    locale === "ar" ? "هذا الأسبوع" : "This Week";

  return `${label} (${startDay}–${endDay})`;
}

/**
 * "August 2026" / "أغسطس 2026"
 * `monthStart` is an ISO date string (any day in that month).
 */
export function formatMonthYear(
  monthStart: string,
  locale: string = "en",
): string {
  const date = new Date(monthStart);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Alias for `formatRelativeDate` — same behaviour, intent is timestamps.
 */
export function formatTimeAgo(
  dateStr: string,
  locale: string = "en",
): string {
  return formatRelativeDate(dateStr, locale);
}
