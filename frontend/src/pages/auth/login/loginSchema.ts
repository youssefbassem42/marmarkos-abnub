import { z } from "zod";

export interface LoginValidationMessages {
  emailRequired: string;
  emailInvalid: string;
  passwordRequired: string;
}

export function loginSchema(messages: LoginValidationMessages) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, messages.emailRequired)
      .email(messages.emailInvalid),
    password: z.string().min(1, messages.passwordRequired),
  });
}

export type LoginFormValues = z.infer<ReturnType<typeof loginSchema>>;
