import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Calculator } from "lucide-react";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { UseFormReturn } from "react-hook-form";
import type { QuizFormValues } from "./quizSchema";

interface QuizSettingsFormProps {
  form: UseFormReturn<QuizFormValues>;
  totalPoints: number;
}

const DURATION_PRESETS: {
  value: string;
  labelKey:
    | "admin.builder.duration1min"
    | "admin.builder.duration2min"
    | "admin.builder.duration5min"
    | "admin.builder.duration10min"
    | "admin.builder.duration15min"
    | "admin.builder.duration30min"
    | "admin.builder.durationCustom";
}[] = [
  { value: "60", labelKey: "admin.builder.duration1min" },
  { value: "120", labelKey: "admin.builder.duration2min" },
  { value: "300", labelKey: "admin.builder.duration5min" },
  { value: "600", labelKey: "admin.builder.duration10min" },
  { value: "900", labelKey: "admin.builder.duration15min" },
  { value: "1800", labelKey: "admin.builder.duration30min" },
  { value: "custom", labelKey: "admin.builder.durationCustom" },
];

const PRESET_VALUES = DURATION_PRESETS.map((d) => d.value).filter(
  (v) => v !== "custom",
);

export function QuizSettingsForm({ form, totalPoints }: QuizSettingsFormProps) {
  const { t } = useTranslation("quiz");
  const [customMode, setCustomMode] = useState(false);

  const currentDuration = form.watch("durationSeconds");
  const isPreset = PRESET_VALUES.includes(String(currentDuration));

  const handlePresetChange = (value: string) => {
    if (value === "custom") {
      setCustomMode(true);
      form.setValue("durationSeconds", 60, { shouldValidate: true });
    } else {
      setCustomMode(false);
      form.setValue("durationSeconds", Number(value), {
        shouldValidate: true,
      });
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="durationSeconds"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("admin.builder.durationField")}
            </FormLabel>
            {!customMode ? (
              <Select
                value={isPreset ? String(field.value) : "custom"}
                onValueChange={handlePresetChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DURATION_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {t(preset.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    type="number"
                    min={30}
                    max={7200}
                    placeholder={t(
                      "admin.builder.customDurationPlaceholder",
                    )}
                    className="w-32"
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(Number(e.target.value) || 0)
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <span className="text-xs text-muted-foreground">seconds</span>
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setCustomMode(false);
                    form.setValue("durationSeconds", 60, {
                      shouldValidate: true,
                    });
                  }}
                >
                  {t("admin.builder.duration5min").split(" ")[0]}
                </button>
              </div>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">
            {t("admin.builder.totalPoints")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("admin.builder.calculatedFromQuestions")}
          </p>
        </div>
        <Badge variant="secondary" className="ms-auto">
          {totalPoints}
        </Badge>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t("admin.builder.questionType")}
        </p>
        <Badge variant="outline">
          {t("admin.builder.multipleChoice")}
        </Badge>
      </div>
    </div>
  );
}
