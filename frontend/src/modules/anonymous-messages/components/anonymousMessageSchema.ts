import { z } from "zod";

/** BR-16: identical bounds to the backend DTO; message trimmed first. */
export function anonymousMessageSchema(messages: {
  messageRequired: string;
  messageMin: string;
  messageMax: string;
  nameMax: string;
  phoneInvalid: string;
}) {
  return z.object({
    message: z
      .string()
      .trim()
      .min(1, messages.messageRequired)
      .min(10, messages.messageMin)
      .max(1000, messages.messageMax),
    sender_name: z.string().trim().max(120, messages.nameMax).optional(),
    sender_phone: z
      .string()
      .trim()
      .regex(/^[0-9+()\s-]{7,32}$/, messages.phoneInvalid)
      .optional()
      .or(z.literal("")),
  });
}

export type AnonymousMessageFormValues = {
  message: string;
  sender_name?: string;
  sender_phone?: string;
};

/** Live `0 / 1000` counter bounds (BR-16, design counter). */
export const MESSAGE_MAX_LENGTH = 1000;
