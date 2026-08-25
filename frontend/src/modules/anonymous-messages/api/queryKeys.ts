/**
 * React Query conventions for anonymous messages — copied from the
 * notifications module. Only the admin listing is cached; submission is
 * a one-shot mutation with no cache footprint.
 */
import type { AnonymousMessageListParams } from "../types";

export const anonymousMessageKeys = {
  all: ["anonymous-messages"] as const,
  list: (params: AnonymousMessageListParams) =>
    [...anonymousMessageKeys.all, "list", params] as const,
};
