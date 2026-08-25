/**
 * Anonymous messages API client (public submit + admin review).
 */

import { apiClient, getApiErrorMessage } from "@/lib/api";
import type { Paginated } from "@/modules/notifications/types";
import type {
  AnonymousMessageAdminItem,
  AnonymousMessageCreateRequest,
  AnonymousMessageCreateResponse,
  AnonymousMessageListParams,
} from "../types";

export { getApiErrorMessage };

export const anonymousMessagesApi = {
  /** BR-13: public; stores first, then forwards to Telegram inline. */
  submit: async (
    payload: AnonymousMessageCreateRequest,
  ): Promise<AnonymousMessageCreateResponse> => {
    const response = await apiClient.post("/anonymous-messages", payload);
    return response.data;
  },

  /** D-11: ADMIN listing with optional status filter. */
  list: async (
    params: AnonymousMessageListParams = {},
  ): Promise<Paginated<AnonymousMessageAdminItem>> => {
    const response = await apiClient.get("/anonymous-messages", { params });
    return response.data;
  },

  /** BR-14: ADMIN re-delivery of a FAILED forward. */
  retry: async (id: string): Promise<AnonymousMessageAdminItem> => {
    const response = await apiClient.post(`/anonymous-messages/${id}/retry`);
    return response.data;
  },
};
