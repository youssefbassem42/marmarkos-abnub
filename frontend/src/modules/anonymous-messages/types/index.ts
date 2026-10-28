/**
 * Anonymous messages module types — field names mirror the backend DTOs
 * exactly (plan §3.7).
 *
 * The types are the **inference of the schemas** of the answers
 * (`@/lib/schemas/member`): the backend is the source of truth.
 */

import type { z } from "zod";

import type {
  anonymousMessageAdminSchema,
  anonymousMessageCreateSchema,
  messageStatusSchema,
} from "@/lib/schemas/member";

export type MessageStatusValue = z.infer<typeof messageStatusSchema>;

export interface AnonymousMessageCreateRequest {
  message: string;
  sender_name?: string | null;
  sender_phone?: string | null;
}

/** BR-13: FAILED still means "safely stored"; delivered is separate. */
export type AnonymousMessageCreateResponse = z.infer<
  typeof anonymousMessageCreateSchema
>;

export type AnonymousMessageAdminItem = z.infer<
  typeof anonymousMessageAdminSchema
>;

export interface AnonymousMessageListParams {
  status?: MessageStatusValue;
  page?: number;
  size?: number;
}
