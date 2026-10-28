/**
 * The answers of the verses.
 *
 * The schemas mirror the DTOs of the backend
 * (`app/modules/bible/application/dto/`).
 */

import { z } from "zod";

import { loose } from "./common";

/** The status of a verse. */
export const verseStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
]);

/** The status of a schedule. */
export const scheduleStatusSchema = z.enum([
  "SCHEDULED",
  "PUBLISHED",
  "CANCELLED",
  "FAILED",
]);

/** The summary of the quiz of a verse (the manager side). */
export const quizSummarySchema = loose({
  quiz_id: z.string(),
  status: z.string(),
  question_count: z.number(),
  total_points: z.number(),
  duration_seconds: z.number(),
});

/** The creator of a verse (the manager side). */
export const creatorBriefSchema = loose({
  id: z.string(),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
});

/** The schedule of a verse (the manager side). */
export const verseScheduleBriefSchema = loose({
  id: z.string(),
  status: scheduleStatusSchema,
  scheduled_at: z.string(),
  notification_status: z.string(),
});

/** One verse of the list of the manager. */
export const verseAdminItemSchema = loose({
  id: z.string(),
  title: z.string(),
  verse_reference: z.string(),
  status: verseStatusSchema,
  schedule: verseScheduleBriefSchema.nullable(),
  has_quiz: z.boolean(),
  opens: z.number(),
  reads: z.number(),
  created_by_user: creatorBriefSchema.nullable(),
  created_at: z.string(),
  published_at: z.string().nullable(),
});

/** The numbers of the verses (the tiles). */
export const verseStatsSchema = loose({
  total: z.number(),
  drafts: z.number(),
  scheduled: z.number(),
  published: z.number(),
  archived: z.number(),
});

/** One card of the feed of the member. */
export const verseCardSchema = loose({
  id: z.string(),
  title: z.string(),
  verse_reference: z.string(),
  excerpt: z.string(),
  image: z.string().nullable(),
  published_at: z.string().nullable(),
  week_start_date: z.string().nullable(),
  is_read: z.boolean(),
  has_quiz: z.boolean(),
  quiz_state: z.string().nullable(),
});

/** The detail of a verse. */
export const verseDetailSchema = loose({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  verse_reference: z.string(),
  book: z.string(),
  chapter: z.number(),
  verse_start: z.number(),
  verse_end: z.number().nullable(),
  text: z.string(),
  reflection: z.string().nullable(),
  image: z.string().nullable(),
  translation: z.string().nullable(),
  status: verseStatusSchema,
  published_at: z.string().nullable(),
  week_start_date: z.string().nullable(),
  is_read: z.boolean(),
  opens: z.number().nullable(),
  reads: z.number().nullable(),
  created_by_user: creatorBriefSchema.nullable(),
  schedule: verseScheduleBriefSchema.nullable(),
  quiz_summary: quizSummarySchema.nullable(),
});

/** The overview of the analytics of the verses. */
export const verseAnalyticsOverviewSchema = loose({
  total_posts: z.number(),
  published: z.number(),
  total_opens: z.number(),
  total_reads: z.number(),
  read_rate: z.number(),
});

/** The quick numbers of the verses. */
export const verseQuickStatsSchema = loose({
  this_week: z.number(),
  this_month: z.number(),
  avg_reads: z.number(),
  top_verse_reference: z.string().nullable(),
  top_verse_opens: z.number(),
});

/** One point of the series of the engagement. */
export const engagementSeriesPointSchema = loose({
  bucket: z.string(),
  opens: z.number(),
  reads: z.number(),
});

/** The quiz related to a verse (the analytics). */
export const relatedQuizSummarySchema = loose({
  quiz_id: z.string(),
  participants: z.number(),
});

/** The analytics of one verse. */
export const verseAnalyticsSchema = loose({
  verse_id: z.string(),
  title: z.string(),
  verse_reference: z.string(),
  total_opens: z.number(),
  unique_opens: z.number(),
  total_reads: z.number(),
  unique_readers: z.number(),
  read_rate: z.number(),
  series: z.array(engagementSeriesPointSchema),
  quiz: relatedQuizSummarySchema.nullable(),
});

/** The engagement of one member with one verse. */
export const verseUserEngagementSchema = loose({
  user_id: z.string(),
  full_name: z.string(),
  avatar: z.string().nullable(),
  opened_count: z.number(),
  has_read: z.boolean(),
  last_opened_at: z.string().nullable(),
});

/** One schedule of a verse. */
export const verseScheduleSchema = loose({
  id: z.string(),
  verse_id: z.string(),
  status: z.string(),
  scheduled_at: z.string(),
  created_by_user_id: z.string().nullable(),
  verse_reference: z.string(),
  verse_title: z.string(),
  attempts: z.number(),
  notification_status: z.string(),
});
