/**
 * Notifications API client. Method-per-endpoint over `apiClient`,
 * returning `response.data` — same shape as the attendance module.
 */

import { apiClient } from "@/lib/api";
import type {
  MarkReadResponse,
  NotificationListParams,
  NotificationSummary,
  Paginated,
  PushNotificationRequest,
  PushNotificationResponse,
  NotificationItem,
} from "../types";

export const notificationsApi = {
  /** BR-1: the caller's feed — own rows plus broadcasts, newest first. */
  list: async (
    params: NotificationListParams = {},
  ): Promise<Paginated<NotificationItem>> => {
    const response = await apiClient.get("/notifications", { params });
    return response.data;
  },

  /** D-4: unread badge + per-tab counts; polled by the bell. */
  summary: async (): Promise<NotificationSummary> => {
    const response = await apiClient.get("/notifications/summary");
    return response.data;
  },

  /** BR-3: idempotent mark-read for one notification. */
  markRead: async (notificationId: string): Promise<MarkReadResponse> => {
    const response = await apiClient.post(
      `/notifications/${notificationId}/read`,
    );
    return response.data;
  },

  /** BR-4: mark every currently visible unread notification. */
  markAllRead: async (): Promise<MarkReadResponse> => {
    const response = await apiClient.post("/notifications/read-all");
    return response.data;
  },

  /** BR-6/BR-8: ADMIN-only bilingual broadcast, optional email fan-out. */
  push: async (
    payload: PushNotificationRequest,
  ): Promise<PushNotificationResponse> => {
    const response = await apiClient.post("/notifications/push", payload);
    return response.data;
  },
};
