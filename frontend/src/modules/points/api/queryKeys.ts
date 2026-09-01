/**
 * React Query key factories for the points module.
 *
 * Keys are hierarchical tuples rooted at ["points"] so every hook
 * reads/writes through these factories and invalidation stays precise.
 */
import type { PointsHistoryParams } from "../types";

export const pointsKeys = {
  all: ["points"] as const,
  me: () => [...pointsKeys.all, "me"] as const,
  totals: () => [...pointsKeys.me(), "totals"] as const,
  monthly: () => [...pointsKeys.me(), "monthly"] as const,
  history: (params?: PointsHistoryParams) =>
    [...pointsKeys.me(), "history", params ?? {}] as const,
};
