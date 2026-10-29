/**
 * Points module types
 *
 * Tracks member engagement points earned from attendance, quizzes, etc.
 *
 * The types are the **inference of the schemas** of the answers
 * (`@/lib/schemas/member`): the backend is the source of truth, and a
 * field that the server does not send cannot be read by the page.
 */

import type { z } from "zod";

import type {
  monthlyPointsItemSchema,
  monthlyPointsSchema,
  pointActivityItemSchema,
  pointsByQuizItemSchema,
  pointsByQuizSchema,
  pointsSchema,
} from "@/lib/schemas/member";

/** The totals of the points of the member. */
export type PointsResponse = z.infer<typeof pointsSchema>;

/** One month of the series of the points. */
export type MonthlyPointsItem = z.infer<typeof monthlyPointsItemSchema>;

/** The series of the months of the points (the envelope of the backend). */
export type MonthlyPointsResponse = z.infer<typeof monthlyPointsSchema>;

/** One movement of the ledger of the points. */
export type PointsHistoryItem = z.infer<typeof pointActivityItemSchema>;

/** One quiz of the summary of the points of the member per quiz. */
export type PointsByQuizItem = z.infer<typeof pointsByQuizItemSchema>;

/** The summary of the points of the member per quiz (the envelope of the backend). */
export type PointsByQuizResponse = z.infer<typeof pointsByQuizSchema>;

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

/** The page of the summary of the points of the member per quiz. */
export interface PointsByQuizParams {
  page?: number;
  size?: number;
}
