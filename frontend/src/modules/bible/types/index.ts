/**
 * Bible module types
 *
 * Manages weekly Bible verses: creation, scheduling, publishing,
 * and the member-facing reading experience.
 *
 * The types are the **inference of the schemas** of the answers
 * (`@/lib/schemas/bible`): a field that the server does not send cannot
 * be read by the page, and the compiler says so.
 */

import type { z } from "zod";

import type {
  creatorBriefSchema,
  engagementSeriesPointSchema,
  quizSummarySchema,
  relatedQuizSummarySchema,
  verseAdminItemSchema,
  verseAnalyticsOverviewSchema,
  verseAnalyticsSchema,
  verseCardSchema,
  verseDetailSchema,
  verseQuickStatsSchema,
  verseScheduleBriefSchema,
  verseStatsSchema,
  verseStatusSchema,
  verseUserEngagementSchema,
  scheduleStatusSchema,
} from "@/lib/schemas/bible";

export type VerseStatus = z.infer<typeof verseStatusSchema>;

export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>;

export type CreatorBrief = z.infer<typeof creatorBriefSchema>;

export type VerseScheduleBrief = z.infer<typeof verseScheduleBriefSchema>;

export type QuizSummary = z.infer<typeof quizSummarySchema>;

export type VerseAdminItem = z.infer<typeof verseAdminItemSchema>;

export type VerseCard = z.infer<typeof verseCardSchema>;

export type VerseDetailResponse = z.infer<typeof verseDetailSchema>;

export type VerseStatsResponse = z.infer<typeof verseStatsSchema>;

export type VerseQuickStats = z.infer<typeof verseQuickStatsSchema>;

export type VerseAnalyticsOverview = z.infer<
  typeof verseAnalyticsOverviewSchema
>;

export type EngagementSeriesPoint = z.infer<typeof engagementSeriesPointSchema>;

export type RelatedQuizSummary = z.infer<typeof relatedQuizSummarySchema>;

export type VerseAnalyticsDetail = z.infer<typeof verseAnalyticsSchema>;

export type VerseUserEngagementItem = z.infer<typeof verseUserEngagementSchema>;

export interface BibleVersesListParams {
  status?: VerseStatus;
  q?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
  has_quiz?: boolean;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  size?: number;
}

export interface PublishedVersesParams {
  q?: string;
  read?: string;
  has_quiz?: boolean;
  page?: number;
  size?: number;
}

export interface CreateVersePayload {
  title: string;
  subtitle?: string;
  verse_reference: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  text: string;
  reflection: string;
  image?: string;
  translation: string;
}

export interface UpdateVersePayload {
  title?: string;
  subtitle?: string;
  verse_reference?: string;
  book?: string;
  chapter?: number;
  verse_start?: number;
  verse_end?: number;
  text?: string;
  reflection?: string;
  image?: string;
  translation?: string;
}

export interface SchedulePayload {
  scheduled_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
