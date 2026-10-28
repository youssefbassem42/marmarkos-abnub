/**
 * Notifications module types.
 *
 * Field names mirror the backend DTOs exactly (plan §3.7) — do not
 * rename on the client. `title_ar`/`message_ar` hold the Arabic copy;
 * `title_en`/`message_en` are kept for API/DB contract compliance (NOT NULL)
 * but the platform renders Arabic only.
 */

/**
 * The types of a notification (`NotificationType` of the backend).
 *
 * `BIBLE_VERSE` was added in Phase 5 (the notification of a published
 * verse): the type was missing here, so the accent of such a
 * notification was `undefined` and the list of the notifications
 * **crashed** for the manager who created the verse.
 */
export type NotificationType =
  "BLOG_POST" | "ANNOUNCEMENT" | "ATTENDANCE" | "SYSTEM" | "BIBLE_VERSE";

/** Presentation grouping over NotificationType (plan §3.4). */
export type NotificationTab =
  "all" | "unread" | "announcements" | "reminders" | "system";

export interface NotificationData {
  /** Glyph override within the type's accent (allowlisted server-side). */
  icon?: string;
  cta_url?: string;
  post_id?: string;
  slug?: string;
  meeting_date?: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  data: NotificationData | null;
  is_read: boolean;
  is_broadcast: boolean;
  created_at: string;
}

/** Standard backend pagination envelope (`app/core/pagination`). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  has_next: boolean;
}

export interface NotificationListParams {
  tab?: NotificationTab;
  page?: number;
  size?: number;
  /** ISO datetime lower bound (D-24 time-range filter). */
  since?: string;
}

export interface NotificationTabCounts {
  all: number;
  unread: number;
  announcements: number;
  reminders: number;
  system: number;
}

export interface NotificationSummary {
  unread_count: number;
  tab_counts: NotificationTabCounts;
}

export interface MarkReadResponse {
  marked: number;
}

export interface PushNotificationRequest {
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  cta_url?: string | null;
  send_email: boolean;
}

export interface PushNotificationResponse {
  notification_id: string;
  recipients: number;
  emails_sent: number;
  emails_failed: number;
}
