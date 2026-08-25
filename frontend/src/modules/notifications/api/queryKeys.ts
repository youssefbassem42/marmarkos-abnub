/**
 * React Query conventions for notifications — copied from attendance:
 * hierarchical tuple keys rooted at the module name; every mutation
 * invalidates `notificationKeys.all`; only the summary query opts into
 * polling (D-4), everything else rides the AppProviders defaults.
 */
import type { NotificationListParams } from "../types";

export const notificationKeys = {
  all: ["notifications"] as const,
  summary: () => [...notificationKeys.all, "summary"] as const,
  list: (params: NotificationListParams) =>
    [...notificationKeys.all, "list", params] as const,
};
