import { useTranslation } from "react-i18next";
import { useFormContext, useWatch } from "react-hook-form";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CoverImageField } from "./CoverImageField";
import { VersePreview } from "./VersePreview";
import { BIBLE_BOOKS, type VerseFormValues } from "./verseSchema";

function CharCounter({ count, max }: { count: number; max: number }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        count > max ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {count} / {max}
    </span>
  );
}

export function VerseForm() {
  const { t } = useTranslation("bible");
  const { control, watch } = useFormContext<VerseFormValues>();

  const watchedTitle = useWatch({ control, name: "title" }) ?? "";
  const watchedSubtitle = useWatch({ control, name: "subtitle" }) ?? "";
  const watchedVerseRef = useWatch({ control, name: "verseReference" }) ?? "";
  const watchedBook = useWatch({ control, name: "book" }) ?? "";
  const watchedChapter = useWatch({ control, name: "chapter" });
  const watchedVerseStart = useWatch({ control, name: "verseStart" });
  const watchedVerseEnd = useWatch({ control, name: "verseEnd" });
  const watchedText = useWatch({ control, name: "text" }) ?? "";
  const watchedReflection = useWatch({ control, name: "reflection" }) ?? "";
  const watchedImage = useWatch({ control, name: "image" }) ?? "";
  const watchedTranslation = useWatch({ control, name: "translation" }) ?? "";
  const watchedStatus = useWatch({ control, name: "status" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-6">
        {/* Title */}
        <FormField
          control={control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                {t("admin.form.fields.title")}
                <CharCounter count={field.value?.length ?? 0} max={100} />
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t("admin.form.fields.title")}
                  maxLength={100}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Subtitle */}
        <FormField
          control={control}
          name="subtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                {t("admin.form.fields.subtitle")}
                <CharCounter count={field.value?.length ?? 0} max={200} />
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t("admin.form.fields.subtitle")}
                  maxLength={200}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Verse Reference */}
        <FormField
          control={control}
          name="verseReference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("admin.form.fields.verseRef")}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    placeholder="John 3:16"
                    maxLength={120}
                  />
                  {field.value && field.value.length > 0 && field.value.length <= 120 && (
                    <Check className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Book */}
        <FormField
          control={control}
          name="book"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.form.fields.book")}</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("admin.form.fields.book")}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BIBLE_BOOKS.map((book) => (
                    <SelectItem key={book} value={book}>
                      {book}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Chapter / Verse Start / Verse End row */}
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={control}
            name="chapter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.form.fields.chapter")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    max={150}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="verseStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.form.fields.verseStart")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    max={150}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="verseEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.form.fields.verseEnd")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    max={150}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Text */}
        <FormField
          control={control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                {t("admin.form.fields.text")}
                <CharCounter count={field.value?.length ?? 0} max={2000} />
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  className="min-h-[120px]"
                  maxLength={2000}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Reflection */}
        <FormField
          control={control}
          name="reflection"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                {t("admin.form.fields.reflection")}
                <CharCounter count={field.value?.length ?? 0} max={5000} />
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  className="min-h-[100px]"
                  maxLength={5000}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Translation */}
        <FormField
          control={control}
          name="translation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.form.fields.translation")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="NIV"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cover Image */}
        <FormField
          control={control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.form.fields.image")}</FormLabel>
              <FormControl>
                <CoverImageField
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Status Radio */}
        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>{t("admin.tabs.general")}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-row gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="DRAFT" id="draft" />
                    <Label htmlFor="draft" className="cursor-pointer">
                      {t("admin.form.status.draft")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="PUBLISHED" id="published" />
                    <Label htmlFor="published" className="cursor-pointer">
                      {t("admin.form.status.published")}
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Preview Panel */}
      <div className="hidden lg:block">
        <div className="sticky top-6">
          <VersePreview
            title={watchedTitle}
            subtitle={watchedSubtitle}
            verseReference={watchedVerseRef}
            text={watchedText}
            reflection={watchedReflection}
            image={watchedImage || null}
          />
        </div>
      </div>
    </div>
  );
}
