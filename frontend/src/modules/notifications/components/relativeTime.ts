import type { TFunction } from "i18next";
import type { NotificationItem } from "../types";

/**
 * Relative time per P4-501: `Intl.RelativeTimeFormat`-style buckets in
 * the active locale (ar-EG / en-GB); older than a week falls back to an
 * absolute date. Never concatenates translated fragments — every form
 * is one i18n key with interpolation.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(
  iso: string,
  language: string,
  t: TFunction<"notifications">,
): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);

  if (diff < HOUR) {
    const minutes = Math.max(1, Math.floor(diff / MINUTE));
    return t("time.minutesAgo", { count: minutes });
  }
  if (diff < DAY) {
    return t("time.hoursAgo", { count: Math.floor(diff / HOUR) });
  }

  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const thenDay = new Date(then);
  const today = new Date(now);
  const startOfThen = new Date(
    thenDay.getFullYear(),
    thenDay.getMonth(),
    thenDay.getDate(),
  ).getTime();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const dayDiff = Math.round((startOfToday - startOfThen) / DAY);

  if (dayDiff === 1) {
    return t("time.yesterdayAt", {
      time: new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(thenDay),
    });
  }
  if (diff < 7 * DAY) {
    return t("time.on", {
      date: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(thenDay),
    });
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(thenDay);
}

/** D-26: the "New" pill shows on unread rows younger than 24 hours. */
export function isNewNotification(item: NotificationItem): boolean {
  if (item.is_read) return false;
  return Date.now() - new Date(item.created_at).getTime() < DAY;
}
