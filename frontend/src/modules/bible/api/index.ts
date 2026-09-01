/**
 * Bible API client
 */

import { apiClient } from "@/lib/api";
import type {
  BibleVersesListParams,
  CreateVersePayload,
  Paginated,
  PublishedVersesParams,
  SchedulePayload,
  UpdateVersePayload,
  VerseAdminItem,
  VerseCard,
  VerseDetailResponse,
  VerseStatsResponse,
} from "../types";

export const bibleApi = {
  /** Manager list of verses (admin/servant) with filters */
  getVerses: async (
    params?: BibleVersesListParams,
  ): Promise<Paginated<VerseAdminItem>> => {
    const response = await apiClient.get("/bible-verses", { params });
    return response.data;
  },

  /** KPI counts for the verse dashboard */
  getStats: async (): Promise<VerseStatsResponse> => {
    const response = await apiClient.get("/bible-verses/stats");
    return response.data;
  },

  /** Newest PUBLISHED verse for the current member (204 if none) */
  getCurrent: async (): Promise<VerseCard | null> => {
    try {
      const response = await apiClient.get("/bible-verses/current");
      return response.data;
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as { status: number }).status === 204
      ) {
        return null;
      }
      throw error;
    }
  },

  /** Member feed of published verses */
  getPublished: async (
    params?: PublishedVersesParams,
  ): Promise<Paginated<VerseCard>> => {
    const response = await apiClient.get("/bible-verses/published", { params });
    return response.data;
  },

  /** Verse detail (admin: full, member: 404 unless PUBLISHED) */
  getVerse: async (verseId: string): Promise<VerseDetailResponse> => {
    const response = await apiClient.get(`/bible-verses/${verseId}`);
    return response.data;
  },

  /** Create a new verse */
  createVerse: async (data: CreateVersePayload): Promise<VerseAdminItem> => {
    const response = await apiClient.post("/bible-verses", data);
    return response.data;
  },

  /** Update an existing verse */
  updateVerse: async (
    verseId: string,
    data: UpdateVersePayload,
  ): Promise<VerseAdminItem> => {
    const response = await apiClient.patch(`/bible-verses/${verseId}`, data);
    return response.data;
  },

  /** Archive a verse (soft-delete) */
  archiveVerse: async (verseId: string): Promise<VerseAdminItem> => {
    const response = await apiClient.delete(`/bible-verses/${verseId}`);
    return response.data;
  },

  /** Restore an archived verse */
  restoreVerse: async (verseId: string): Promise<VerseAdminItem> => {
    const response = await apiClient.post(`/bible-verses/${verseId}/restore`);
    return response.data;
  },

  /** Publish a verse immediately */
  publishVerse: async (verseId: string): Promise<VerseAdminItem> => {
    const response = await apiClient.post(`/bible-verses/${verseId}/publish`);
    return response.data;
  },

  /** Schedule a verse for future publication */
  scheduleVerse: async (
    verseId: string,
    data: SchedulePayload,
  ): Promise<VerseAdminItem> => {
    const response = await apiClient.post(
      `/bible-verses/${verseId}/schedule`,
      data,
    );
    return response.data;
  },

  /** Reschedule an already-scheduled verse */
  rescheduleVerse: async (
    verseId: string,
    data: SchedulePayload,
  ): Promise<VerseAdminItem> => {
    const response = await apiClient.patch(
      `/bible-verses/${verseId}/schedule`,
      data,
    );
    return response.data;
  },

  /** Cancel a scheduled publication */
  cancelSchedule: async (verseId: string): Promise<VerseAdminItem> => {
    const response = await apiClient.delete(
      `/bible-verses/${verseId}/schedule`,
    );
    return response.data;
  },

  /** Mark a verse as read for the current user */
  markAsRead: async (verseId: string): Promise<void> => {
    await apiClient.post(`/bible-verses/${verseId}/read`);
  },

  /** Record that the current user opened a verse */
  recordOpen: async (verseId: string): Promise<void> => {
    await apiClient.post(`/bible-verses/${verseId}/open`);
  },

  /** Aggregate Bible engagement stats for the admin dashboard */
  getAnalyticsOverview: async (): Promise<{
    total_posts: number;
    published: number;
    total_opens: number;
    total_reads: number;
    read_rate: number;
  }> => {
    const response = await apiClient.get("/bible-verses/analytics/overview");
    return response.data;
  },
};
