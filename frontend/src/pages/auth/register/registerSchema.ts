import { z } from "zod";

export interface RegisterValidationMessages {
  required: string;
  nameTooLong: string;
  emailRequired: string;
  emailInvalid: string;
  passwordTooShort: string;
  passwordTooLong: string;
  phoneInvalid: string;
  termsRequired: string;
  passwordMismatch: string;
}

export function registerSchema(messages: RegisterValidationMessages) {
  return z
    .object({
      firstName: z
        .string()
        .trim()
        .min(1, messages.required)
        .max(80, messages.nameTooLong),
      lastName: z
        .string()
        .trim()
        .min(1, messages.required)
        .max(80, messages.nameTooLong),
      email: z
        .string()
        .trim()
        .min(1, messages.emailRequired)
        .email(messages.emailInvalid),
      password: z
        .string()
        .min(8, messages.passwordTooShort)
        .max(128, messages.passwordTooLong),
      confirmPassword: z.string().min(1, messages.required),
      dateOfBirth: z.string().min(1, messages.required),
      address: z
        .string()
        .trim()
        .min(1, messages.required)
        .max(255, messages.nameTooLong),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+\s-]{8,20}$/, messages.phoneInvalid),
      iAm: z.string().min(1, messages.required),
      howHeard: z.string().min(1, messages.required),
      terms: z.boolean().refine((value) => value, {
        message: messages.termsRequired,
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordMismatch,
      path: ["confirmPassword"],
    });
}

export type RegisterFormValues = z.infer<ReturnType<typeof registerSchema>>;
