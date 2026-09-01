import { z } from "zod";

export const quizSchema = (messages: {
  titleRequired: string;
  titleMax: string;
  descriptionMax: string;
  verseIdRequired: string;
  durationRequired: string;
  durationMin: string;
  durationMax: string;
}) =>
  z.object({
    title: z
      .string()
      .min(1, messages.titleRequired)
      .max(100, messages.titleMax),
    description: z.string().max(500, messages.descriptionMax).optional(),
    verseId: z.string().min(1, messages.verseIdRequired),
    durationSeconds: z
      .number({ message: messages.durationRequired })
      .min(30, messages.durationMin)
      .max(7200, messages.durationMax),
  });

export type QuizFormValues = z.infer<ReturnType<typeof quizSchema>>;
