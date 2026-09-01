import { z } from "zod";
import type { TFunction } from "i18next";

export type ScheduleFormValues = z.infer<ReturnType<typeof createScheduleSchema>>;

export function createScheduleSchema(t: TFunction<["bible"]>) {
  return z
    .object({
      date: z.string().min(1, t("admin.schedule.invalid.date")),
      time: z.string().min(1, t("admin.schedule.invalid.time")),
    })
    .refine(
      (data) => {
        if (!data.date || !data.time) return true;
        const scheduledAt = new Date(`${data.date}T${data.time}:00`);
        return scheduledAt > new Date();
      },
      {
        message: t("admin.schedule.invalid.pastDate"),
        path: ["date"],
      },
    );
}
