import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createScheduleSchema,
  type ScheduleFormValues,
} from "./scheduleSchema";
import { ScheduleSummaryCard } from "./ScheduleSummaryCard";

interface ScheduleFormProps {
  onSubmit: (data: ScheduleFormValues) => void;
  isLoading?: boolean;
}

export function ScheduleForm({ onSubmit, isLoading }: ScheduleFormProps) {
  const { t } = useTranslation("bible");

  const schema = createScheduleSchema(t);

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: "",
      time: "",
    },
  });

  const watchedDate = form.watch("date");
  const watchedTime = form.watch("time");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-6">
        {/* Date */}
        <div className="space-y-2">
          <Label>{t("admin.schedule.scheduleDate")}</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("admin.schedule.summary.date")}
              </Label>
              <Input
                type="date"
                {...form.register("date")}
                min={new Date().toISOString().split("T")[0]}
              />
              {form.formState.errors.date && (
                <p className="text-[0.8rem] font-medium text-destructive">
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("admin.schedule.summary.time")}
              </Label>
              <Input
                type="time"
                {...form.register("time")}
              />
              {form.formState.errors.time && (
                <p className="text-[0.8rem] font-medium text-destructive">
                  {form.formState.errors.time.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Timezone */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span>{t("admin.schedule.timezoneNote")}</span>
        </div>

        <Button
          type="button"
          onClick={form.handleSubmit(onSubmit)}
          disabled={isLoading || !watchedDate || !watchedTime}
          className="w-full md:w-auto"
        >
          {isLoading ? "..." : t("admin.schedule.submit")}
        </Button>
      </div>

      {/* Summary Card */}
      <div className="hidden lg:block">
        <div className="sticky top-6">
          <ScheduleSummaryCard date={watchedDate} time={watchedTime} />
        </div>
      </div>
    </div>
  );
}
