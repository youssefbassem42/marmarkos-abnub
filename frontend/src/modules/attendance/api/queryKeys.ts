/**
 * React Query conventions for this codebase (first module to use it —
 * later modules should copy this pattern rather than invent one):
 *
 * - Keys are hierarchical tuples rooted at the module name; every hook
 *   reads/writes through these factories so invalidation stays precise.
 * - Mutations invalidate the whole module root when their result affects
 *   several queries (`useCheckIn` → `attendanceKeys.all`).
 * - Queries rely on the global defaults in AppProviders
 *   (`staleTime: 60_000`, `retry: 1`); a screen that must reflect a
 *   mutation instantly overrides `staleTime: 0` locally.
 */
import type { AttendanceHistoryFilters } from "../types";

export const attendanceKeys = {
  all: ["attendance"] as const,
  meeting: (d?: string) =>
    [...attendanceKeys.all, "meeting", d ?? "open"] as const,
  schedule: (y: number, m: number) =>
    [...attendanceKeys.all, "schedule", y, m] as const,
  absent: (d?: string) =>
    [...attendanceKeys.all, "absent", d ?? "open"] as const,
  meetingStats: (d?: string) =>
    [...attendanceKeys.all, "stats", "meeting", d ?? "open"] as const,
  monthlyStats: (y: number, m: number) =>
    [...attendanceKeys.all, "stats", "monthly", y, m] as const,
  history: (f: AttendanceHistoryFilters) =>
    [...attendanceKeys.all, "history", f] as const,
  mine: (y: number, m: number) =>
    [...attendanceKeys.all, "mine", y, m] as const,
};
