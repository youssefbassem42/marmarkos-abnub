import { useMutation } from "@tanstack/react-query";
import { anonymousMessagesApi } from "../api";
import type { AnonymousMessageCreateRequest } from "../types";

/** BR-13/BR-15: a 429 maps to the rateLimited validation message. */
export function useSubmitAnonymousMessage() {
  return useMutation({
    mutationFn: (payload: AnonymousMessageCreateRequest) =>
      anonymousMessagesApi.submit(payload),
  });
}
