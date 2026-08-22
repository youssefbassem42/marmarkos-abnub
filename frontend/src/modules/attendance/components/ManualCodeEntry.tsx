import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Keyboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ManualCodeEntryProps {
  expanded: boolean;
  isPending: boolean;
  onSubmit: (code: string) => void;
  onCancel?: () => void;
}

/**
 * Collapsible manual entry row from the design. Auto-expands (and
 * focuses) when the camera is denied or unsupported.
 */
export function ManualCodeEntry({
  expanded,
  isPending,
  onSubmit,
  onCancel,
}: ManualCodeEntryProps) {
  const { t } = useTranslation("attendance");
  const isArabic =
    t("checkIn.title") !== undefined && document.documentElement.dir === "rtl";

  const schema = z.object({
    code: z
      .string()
      .transform((value) => value.trim().replace(/\s+/g, ""))
      .refine((value) => value.length >= 8, {
        message: t("errors.validation"),
      }),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
    mode: "onChange",
  });

  useEffect(() => {
    if (expanded) setFocus("code");
  }, [expanded, setFocus]);

  const Chevron = isArabic ? ChevronLeft : ChevronRight;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => undefined}
        aria-expanded={expanded}
        disabled={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-start"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-mint/15">
          <Keyboard className="h-5 w-5 text-mint" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">
            {t("checkIn.manual.title")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {t("checkIn.manual.subtitle")}
          </span>
        </span>
        {!expanded && (
          <Chevron
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded && (
        <form
          onSubmit={handleSubmit(({ code }) => onSubmit(code))}
          className="space-y-3 px-4 pb-4"
          noValidate
        >
          <label
            htmlFor="manual-code"
            className="block text-sm font-medium text-ink"
          >
            {t("checkIn.manual.label")}
          </label>
          <Input
            id="manual-code"
            dir="ltr"
            autoComplete="off"
            placeholder={t("checkIn.manual.placeholder")}
            aria-invalid={errors.code ? true : undefined}
            className="h-12 rounded-xl ps-4 focus-ring"
            {...register("code")}
          />
          {errors.code?.message && (
            <p role="alert" className="text-sm font-medium text-status-absent">
              {errors.code.message}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!isValid || isPending}
              className="btn-primary h-11 flex-1 justify-center px-5 text-sm"
            >
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t("checkIn.manual.submit")}
            </Button>
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                className="btn-outline h-11 px-5 text-sm"
              >
                {t("checkIn.manual.cancel")}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
