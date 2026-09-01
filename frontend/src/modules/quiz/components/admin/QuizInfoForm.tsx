import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink } from "lucide-react";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useVerse } from "@/modules/bible/hooks/useVerse";
import type { UseFormReturn } from "react-hook-form";
import type { QuizFormValues } from "./quizSchema";

interface QuizInfoFormProps {
  form: UseFormReturn<QuizFormValues>;
  verseId: string;
  isEdit?: boolean;
}

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

export function QuizInfoForm({ form, verseId, isEdit }: QuizInfoFormProps) {
  const { t } = useTranslation("quiz");
  const { data: verse } = useVerse(verseId);

  const titleValue = form.watch("title") ?? "";
  const descValue = form.watch("description") ?? "";

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.builder.titleField")}</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  placeholder={t("admin.builder.titlePlaceholder")}
                  maxLength={TITLE_MAX}
                  {...field}
                />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {titleValue.length} / {TITLE_MAX}
                </span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.builder.descriptionField")}</FormLabel>
            <FormControl>
              <div className="relative">
                <Textarea
                  placeholder={t(
                    "admin.builder.descriptionPlaceholder",
                  )}
                  maxLength={DESCRIPTION_MAX}
                  className="min-h-[80px] resize-none"
                  {...field}
                />
                <span className="absolute end-3 top-3 text-xs text-muted-foreground">
                  {descValue.length} / {DESCRIPTION_MAX}
                </span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t("admin.builder.relatedVerse")}
        </p>
        {verse ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{verse.title}</p>
              <p className="text-xs text-muted-foreground">
                {verse.verse_reference}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{verseId}</p>
        )}
      </div>
    </div>
  );
}
