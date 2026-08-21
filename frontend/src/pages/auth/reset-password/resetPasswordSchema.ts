import { z } from "zod";

export interface ResetPasswordValidationMessages {
  passwordRequired: string;
  passwordTooShort: string;
  passwordTooLong: string;
  passwordWeak: string;
  confirmRequired: string;
  passwordMismatch: string;
}

export function resetPasswordSchema(messages: ResetPasswordValidationMessages) {
  return z
    .object({
      password: z
        .string()
        .min(1, messages.passwordRequired)
        .min(8, messages.passwordTooShort)
        .max(128, messages.passwordTooLong)
        .regex(/[a-z]/, messages.passwordWeak)
        .regex(/[A-Z]/, messages.passwordWeak)
        .regex(/\d/, messages.passwordWeak)
        .regex(/[^A-Za-z0-9]/, messages.passwordWeak),
      confirmPassword: z.string().min(1, messages.confirmRequired),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordMismatch,
      path: ["confirmPassword"],
    });
}

export type ResetPasswordFormValues = z.infer<
  ReturnType<typeof resetPasswordSchema>
>;
