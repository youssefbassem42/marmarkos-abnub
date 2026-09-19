import { z } from "zod";

const optionSchema = z.object({
  optionText: z.string().min(1, "Option text is required"),
  isCorrect: z.boolean(),
  id: z.string().optional(),
});

export const questionSchema = (messages: {
  questionRequired: string;
  questionMax: string;
  pointsRequired: string;
  pointsMin: string;
  pointsMax: string;
  optionsMin: string;
  optionsMax: string;
  optionTextRequired: string;
  correctRequired: string;
}) =>
  z
    .object({
      question: z
        .string()
        .min(1, messages.questionRequired)
        .max(500, messages.questionMax),
      points: z
        .number({ message: messages.pointsRequired })
        .min(1, messages.pointsMin)
        .max(100, messages.pointsMax),
      options: z
        .array(optionSchema)
        .min(2, messages.optionsMin)
        .max(6, messages.optionsMax),
    })
    .refine((data) => data.options.some((o) => o.isCorrect), {
      message: messages.correctRequired,
      path: ["options"],
    });

export type QuestionFormValues = z.infer<ReturnType<typeof questionSchema>>;
export type OptionField = z.infer<typeof optionSchema>;
