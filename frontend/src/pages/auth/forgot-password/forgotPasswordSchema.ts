import { z } from "zod";

export interface ForgotPasswordValidationMessages {
  emailRequired: string;
  emailInvalid: string;
}

export function forgotPasswordSchema(
  messages: ForgotPasswordValidationMessages,
) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, messages.emailRequired)
      .email(messages.emailInvalid),
  });
}

export type ForgotPasswordFormValues = z.infer<
  ReturnType<typeof forgotPasswordSchema>
>;
