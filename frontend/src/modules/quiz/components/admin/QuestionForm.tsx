import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Minus } from "lucide-react";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { OptionRow } from "./OptionRow";
import type { UseFormReturn } from "react-hook-form";
import type { QuestionFormValues } from "./questionSchema";

interface QuestionFormProps {
  form: UseFormReturn<QuestionFormValues>;
}

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;
const MAX_QUESTION = 500;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionForm({ form }: QuestionFormProps) {
  const { t } = useTranslation("quiz");
  const options = form.watch("options");
  const questionValue = form.watch("question") ?? "";
  const pointsValue = form.watch("points") ?? 1;

  const correctIndex = options.findIndex((o) => o.isCorrect);

  const addOption = useCallback(() => {
    if (options.length >= MAX_OPTIONS) return;
    form.setValue("options", [
      ...options,
      { optionText: "", isCorrect: false },
    ]);
  }, [options, form]);

  const removeOption = useCallback(
    (index: number) => {
      if (options.length <= MIN_OPTIONS) return;
      const newOptions = options.filter((_, i) => i !== index);
      form.setValue("options", newOptions);
    },
    [options, form],
  );

  const updateOptionText = useCallback(
    (index: number, text: string) => {
      const newOptions = [...options];
      newOptions[index] = { ...newOptions[index], optionText: text };
      form.setValue("options", newOptions);
    },
    [options, form],
  );

  const setCorrectOption = useCallback(
    (index: number) => {
      const newOptions = options.map((o, i) => ({
        ...o,
        isCorrect: i === index,
      }));
      form.setValue("options", newOptions);
    },
    [options, form],
  );

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="question"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.question.questionField")}</FormLabel>
            <FormControl>
              <div className="relative">
                <Textarea
                  placeholder={t("admin.question.textPlaceholder")}
                  maxLength={MAX_QUESTION}
                  className="min-h-[100px] resize-none"
                  {...field}
                />
                <span className="absolute end-3 top-3 text-xs text-muted-foreground">
                  {questionValue.length} / {MAX_QUESTION}
                </span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="points"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.question.pointsField")}</FormLabel>
            <FormControl>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    field.onChange(Math.max(1, (field.value ?? 1) - 1))
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="w-20 text-center"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value) || 1)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    field.onChange(Math.min(100, (field.value ?? 1) + 1))
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <FormLabel>{t("admin.question.optionsField")}</FormLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addOption}
            disabled={options.length >= MAX_OPTIONS}
          >
            <Plus className="me-1 h-3.5 w-3.5" />
            {t("admin.question.addOption")}
          </Button>
        </div>

        <RadioGroup
          value={correctIndex >= 0 ? String(correctIndex) : ""}
          className="space-y-2"
        >
          {options.map((opt, index) => (
            <OptionRow
              key={index}
              letter={LETTERS[index] ?? String.fromCharCode(65 + index)}
              option={opt}
              index={index}
              canDelete={options.length > MIN_OPTIONS}
              textValue={opt.optionText}
              onTextChange={(value) => updateOptionText(index, value)}
              onCorrectChange={() => setCorrectOption(index)}
              onDelete={() => removeOption(index)}
            />
          ))}
        </RadioGroup>

        {options.length < MIN_OPTIONS && (
          <p className="text-xs text-destructive">
            {t("admin.question.minOptions")}
          </p>
        )}
      </div>
    </div>
  );
}
