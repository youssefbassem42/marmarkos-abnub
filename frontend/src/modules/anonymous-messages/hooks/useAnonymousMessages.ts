import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { anonymousMessagesApi } from "../api";
import { anonymousMessageKeys } from "../api/queryKeys";
import type { AnonymousMessageListParams } from "../types";

/** D-11: one page of the admin review listing. */
export function useAnonymousMessages(params: AnonymousMessageListParams) {
  return useQuery({
    queryKey: anonymousMessageKeys.list(params),
    queryFn: () => anonymousMessagesApi.list(params),
    placeholderData: keepPreviousData,
  });
}
