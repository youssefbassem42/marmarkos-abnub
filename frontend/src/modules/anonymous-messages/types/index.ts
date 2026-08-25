/**
 * Anonymous messages module types — field names mirror the backend DTOs
 * exactly (plan §3.7).
 */

export type MessageStatusValue = "PENDING" | "SENT" | "FAILED";

export interface AnonymousMessageCreateRequest {
  message: string;
  sender_name?: string | null;
  sender_phone?: string | null;
}

/** BR-13: FAILED still means "safely stored"; delivered is separate. */
export interface AnonymousMessageCreateResponse {
  id: string;
  status: MessageStatusValue;
  delivered: boolean;
}

export interface AnonymousMessageAdminItem {
  id: string;
  message: string;
  sender_name: string | null;
  sender_phone: string | null;
  status: MessageStatusValue;
  telegram_status: MessageStatusValue;
  telegram_message_id: string | null;
  attempts: number;
  failure_reason: string | null;
  created_at: string;
  sent_at: string | null;
  last_attempt_at: string | null;
}

export interface AnonymousMessageListParams {
  status?: MessageStatusValue;
  page?: number;
  size?: number;
}
