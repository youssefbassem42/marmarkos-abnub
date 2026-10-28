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
