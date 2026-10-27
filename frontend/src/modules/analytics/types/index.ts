/**
 * Types of the monthly analytics endpoints (`/quiz-analytics/*`).
 *
 * They mirror the backend DTOs one to one
 * (`backend/app/modules/points/application/dto/monthly_dto.py`); when one
 * side changes, the other must change with it.
 */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  has_next: boolean;
}

export interface TrendPoint {
  /** First day of the month, e.g. "2026-09-01". */
  period_month: string;
  total_points: number;
  participants: number;
  average_score_out_of_10: number;
}

export interface CompletionBucket {
  /** "100%" / "75–99%" / "50–74%" / "<50%". */
  bucket: string;
  users: number;
  /** Share of the users, 0–100. */
  percentage: number;
}

export interface TopUser {
  rank: number;
  user_id: string;
  full_name: string;
  avatar: string | null;
  points: number;
}

export interface MonthlyAnalytics {
  /** First day of the analysed month, e.g. "2026-09-01". */
  month: string;
  participants: number;
  quizzes_completed: number;
  total_points: number;
  average_score_out_of_10: number;
  quizzes_published: number;
  /** The last three months, oldest first. */
  trend: TrendPoint[];
  completion_distribution: CompletionBucket[];
  /** The three members with the most points. */
  top: TopUser[];
}

export interface MonthlyUserItem {
  rank: number;
  user_id: string;
  full_name: string;
  avatar: string | null;
  quizzes_completed: number;
  average_score_out_of_10: number;
  total_points: number;
  /** finished / published, 0–100. */
  completion_rate: number;
  /** Six month point values, oldest first. */
  sparkline: number[];
}

export interface QuizBreakdownItem {
  quiz_id: string;
  quiz_title: string;
  score: number;
  total_points: number;
  score_out_of_10: number;
}

export interface MonthHistoryPoint {
  period_month: string;
  points: number;
}

export interface MonthlyUserDetail {
  user_id: string;
  full_name: string;
  avatar: string | null;
  month: string;
  total_points: number;
  quizzes_completed: number;
  average_score_out_of_10: number;
  completion_rate: number;
  breakdown: QuizBreakdownItem[];
  history: MonthHistoryPoint[];
}

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
