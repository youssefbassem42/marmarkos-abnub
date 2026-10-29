import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/lib/zodResolver";
import { X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { loose } from "@/lib/schemas/common";
import type { LandingSlideAdminItem } from "../types";

const slideFormSchema = loose({
  title: z.string().min(1, "العنوان مطلوب"),
  subtitle: z.string(),
});

type SlideFormValues = z.infer<typeof slideFormSchema>;

interface SlideFormProps {
  slide: LandingSlideAdminItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: {
    title: string;
    subtitle: string | null;
    file: File | null;
  }) => void;
  isSaving: boolean;
}

export function SlideForm({
  slide,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: SlideFormProps) {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(slide?.image ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SlideFormValues>({
    resolver: zodResolver(slideFormSchema),
    defaultValues: {
      title: slide?.title ?? "",
      subtitle: slide?.subtitle ?? "",
    },
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      setFile(selected);
      if (selected) {
        setPreview(URL.createObjectURL(selected));
      } else {
        setPreview(slide?.image ?? null);
      }
      if (inputRef.current) inputRef.current.value = "";
    },
    [slide?.image],
  );

  const handleRemove = useCallback(() => {
    setFile(null);
    setPreview(slide?.image ?? null);
    if (inputRef.current) inputRef.current.value = "";
  }, [slide?.image]);

  const onSubmit = form.handleSubmit((values) => {
    onSave({
      title: values.title,
      subtitle: values.subtitle || null,
      file,
    });
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {slide ? t("slides.editTitle") : t("slides.create")}
          </DialogTitle>
          <DialogDescription>{t("slides.fields.image")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Image */}
            <div className="space-y-3">
              <span className="font-medium text-ink">
                {t("slides.fields.image")}
              </span>
              <div className="space-y-3">
                {preview ? (
                  <div className="relative group">
                    <img
                      src={preview}
                      alt="معاينة الصورة"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 end-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleRemove}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-40 rounded-lg border-2 border-dashed transition-colors cursor-pointer",
                    )}
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      {t("slides.upload")}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {t("slides.uploadHint")}
                    </p>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isSaving}
                />
                {!preview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => inputRef.current?.click()}
                    disabled={isSaving}
                  >
                    <Upload className="me-2 h-4 w-4" />
                    {t("slides.upload")}
                  </Button>
                )}
              </div>
            </div>

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("slides.fields.title")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("slides.fields.title")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subtitle */}
            <FormField
              control={form.control}
              name="subtitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("slides.fields.subtitle")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("slides.fields.subtitle")}
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "جارٍ الحفظ..." : tCommon("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
