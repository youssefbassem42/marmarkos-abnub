/**
 * Types of the monthly analytics endpoints (`/quiz-analytics/*`).
 *
 * They mirror the backend DTOs one to one
 * (`backend/app/modules/points/application/dto/monthly_dto.py`); when one
 * side changes, the other must change with it.
 *
 * The types are the **inference of the schemas** of the answers
 * (`@/lib/schemas/member`): the compiler says so when a field drifts.
 */

import type { z } from "zod";

import type {
  completionBucketSchema,
  monthlyAnalyticsSchema,
  monthlyUserDetailSchema,
  monthlyUserItemSchema,
  monthHistoryPointSchema,
  quizBreakdownItemSchema,
  topUserSchema,
  trendPointSchema,
} from "@/lib/schemas/member";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  has_next: boolean;
}

export type TrendPoint = z.infer<typeof trendPointSchema>;

export type CompletionBucket = z.infer<typeof completionBucketSchema>;

export type TopUser = z.infer<typeof topUserSchema>;

export type MonthlyAnalytics = z.infer<typeof monthlyAnalyticsSchema>;

export type MonthlyUserItem = z.infer<typeof monthlyUserItemSchema>;

export type QuizBreakdownItem = z.infer<typeof quizBreakdownItemSchema>;

export type MonthHistoryPoint = z.infer<typeof monthHistoryPointSchema>;

export type MonthlyUserDetail = z.infer<typeof monthlyUserDetailSchema>;

export interface MonthlyUsersParams {
  /** Search in the member name. */
  q?: string;
  min_points?: number;
  /** A completion-rate bucket: "100" | "75" | "50" | "lt50". */
  score_range?: string;
  completion_rate?: string;
  min_quizzes?: number;
  page?: number;
  size?: number;
}
