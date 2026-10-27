/**
 * React Query key factories for the analytics module.
 *
 * The month is part of every key: two months are two different
 * dashboards and must never share a cache entry.
 */
import type { MonthlyUsersParams } from "../types";

export const analyticsKeys = {
  all: ["analytics"] as const,
  monthly: (month: string) => [...analyticsKeys.all, "monthly", month] as const,
  monthlyUsers: (month: string, params?: MonthlyUsersParams) =>
    [...analyticsKeys.all, "monthly-users", month, params ?? {}] as const,
  userMonth: (userId: string, month: string) =>
    [...analyticsKeys.all, "user-month", userId, month] as const,
};
