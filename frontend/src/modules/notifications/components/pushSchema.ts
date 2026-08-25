import { z } from "zod";

/** Same bounds as the backend DTO (BR-5, plan §3.7). */
export function pushSchema(messages: {
  titleArRequired: string;
  titleEnRequired: string;
  messageArRequired: string;
  messageEnRequired: string;
}) {
  return z.object({
    title_ar: z.string().trim().min(3, messages.titleArRequired).max(255),
    title_en: z.string().trim().min(3, messages.titleEnRequired).max(255),
    message_ar: z.string().trim().min(3, messages.messageArRequired).max(2000),
    message_en: z.string().trim().min(3, messages.messageEnRequired).max(2000),
    cta_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  });
}

export type PushFormValues = {
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  cta_url?: string;
};
