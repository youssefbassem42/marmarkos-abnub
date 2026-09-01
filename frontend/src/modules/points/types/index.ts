/**
 * Points module types
 *
 * Tracks member engagement points earned from attendance, quizzes, etc.
 */

export interface PointsResponse {
  total_points: number;
  this_month_points: number;
  this_week_points: number;
}

export interface MonthlyPointsResponse {
  month: string;
  points: number;
  month_label: string;
}

export interface PointsHistoryItem {
  id: string;
  source: string;
  points: number;
  quiz_title: string | null;
  awarded_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface PointsHistoryParams {
  page?: number;
  size?: number;
}
