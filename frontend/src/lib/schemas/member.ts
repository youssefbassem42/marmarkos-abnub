/**
 * The answers of the members, of the notifications and of the points.
 *
 * The schemas mirror the DTOs of the backend
 * (`app/modules/users/application/dto/`,
 * `app/modules/notifications/application/dto/`,
 * `app/modules/points/application/dto/`).
 */

import { z } from "zod";

import { loose } from "./common";

/* ------------------------------------------------------------------ users */

/** The role of a member. */
export const roleNameSchema = z.enum(["ADMIN", "SERVANT", "MEMBER"]);

/** The status of a member (`UserStatus` of the backend). */
export const userStatusSchema = z.enum([
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
  "INACTIVE",
]);

/** A member (`UserResponse`). */
export const userSchema = loose({
  id: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  address: z.string().nullable(),
  avatar: z.string().nullable(),
  role: roleNameSchema,
  status: userStatusSchema,
  public_id: z.string(),
  created_at: z.string(),
  last_login_at: z.string().nullable(),
  has_password: z.boolean(),
  email_verified: z.boolean(),
});

/* ---------------------------------------------------------- notifications */

/** One notification. */
export const notificationSchema = loose({
  id: z.string(),
  type: z.string(),
  title_ar: z.string(),
  title_en: z.string(),
  message_ar: z.string(),
  message_en: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  is_read: z.boolean(),
  is_broadcast: z.boolean(),
  created_at: z.string(),
});

/** The numbers of the tabs of the notifications. */
export const notificationTabCountsSchema = loose({
  all: z.number(),
  unread: z.number(),
  announcements: z.number(),
  reminders: z.number(),
  system: z.number(),
});

/** The summary of the notifications (the badge). */
export const notificationSummarySchema = loose({
  unread_count: z.number(),
  tab_counts: notificationTabCountsSchema,
});

/** The answer of "mark as read". */
export const markReadSchema = loose({
  marked: z.number(),
});

/* ----------------------------------------------------------------- points */

/** The points of a member (the tiles). */
export const pointsSchema = loose({
  lifetime: z.number(),
  this_week: z.number(),
  this_month: z.number(),
  quizzes_completed: z.number(),
});

/** One month of the series of the points. */
export const monthlyPointsItemSchema = loose({
  period_month: z.string(),
  points: z.number(),
  quizzes_completed: z.number(),
});

/** The series of the months of the points. */
export const monthlyPointsSchema = loose({
  items: z.array(monthlyPointsItemSchema),
});

/** One movement of the ledger of the points. */
export const pointActivityItemSchema = loose({
  id: z.string(),
  points: z.number(),
  awarded_at: z.string(),
  quiz_id: z.string().nullable(),
  quiz_title: z.string().nullable(),
  verse_id: z.string().nullable(),
  verse_reference: z.string().nullable(),
  source: z.string(),
});

/* ------------------------------------------------- the analytics of a month */

/** One point of the tendency of a month. */
export const trendPointSchema = loose({
  period_month: z.string(),
  total_points: z.number(),
  participants: z.number(),
});

/** One bucket of the distribution of the completions. */
export const completionBucketSchema = loose({
  bucket: z.string(),
  users: z.number(),
  percentage: z.number(),
});

/** One member of the first three of a month. */
export const topUserSchema = loose({
  rank: z.number(),
  user_id: z.string(),
  full_name: z.string(),
  avatar: z.string().nullable(),
  points: z.number(),
});

/** The analytics of a month. */
export const monthlyAnalyticsSchema = loose({
  month: z.string(),
  participants: z.number(),
  quizzes_completed: z.number(),
  total_points: z.number(),
  quizzes_published: z.number(),
  trend: z.array(trendPointSchema),
  completion_distribution: z.array(completionBucketSchema),
  top: z.array(topUserSchema),
});

/** One member of the list of a month. */
export const monthlyUserItemSchema = loose({
  rank: z.number(),
  user_id: z.string(),
  full_name: z.string(),
  avatar: z.string().nullable(),
  quizzes_completed: z.number(),
  total_points: z.number(),
  completion_rate: z.number(),
  sparkline: z.array(z.number()),
});

/** The breakdown of the score of a member in a quiz. */
export const quizBreakdownItemSchema = loose({
  quiz_id: z.string(),
  quiz_title: z.string(),
  score: z.number(),
  total_points: z.number(),
  score_out_of_10: z.number(),
});

/** One month of the history of a member. */
export const monthHistoryPointSchema = loose({
  period_month: z.string(),
  points: z.number(),
});

/** The detail of a member in a month. */
export const monthlyUserDetailSchema = loose({
  user_id: z.string(),
  full_name: z.string(),
  avatar: z.string().nullable(),
  month: z.string(),
  total_points: z.number(),
  quizzes_completed: z.number(),
  average_score_out_of_10: z.number(),
  completion_rate: z.number(),
  breakdown: z.array(quizBreakdownItemSchema),
  history: z.array(monthHistoryPointSchema),
});
