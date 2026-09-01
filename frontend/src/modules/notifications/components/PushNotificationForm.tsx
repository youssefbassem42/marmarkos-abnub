import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Megaphone, Send } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePushNotification } from "../hooks";
import { pushSchema, type PushFormValues } from "./pushSchema";

/**
 * The admin push composer (US-016/US-017): bilingual copy required in
 * both languages, optional CTA, and an opt-in email fan-out guarded by
 * a confirmation dialog (R-1: bulk email is slow).
 */
export function PushNotificationForm() {
  const { t } = useTranslation("notifications");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [pendingValues, setPendingValues] = useState<PushFormValues | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<PushFormValues>({
    resolver: zodResolver(
      pushSchema({
        titleArRequired: t("admin.composer.titleAr"),
        messageArRequired: t("admin.composer.messageAr"),
      }),
    ),
    defaultValues: {
      title_ar: "",
      message_ar: "",
      cta_url: "",
    },
  });

  const push = usePushNotification();

  const doSend = (values: PushFormValues) => {
    setConfirmOpen(false);
    push.mutate(
      {
        title_ar: values.title_ar,
        // The API/DB keep title_en/message_en NOT NULL (frozen contract); the platform is Arabic-only.
        title_en: values.title_ar,
        message_ar: values.message_ar,
        message_en: values.message_ar,
        cta_url: values.cta_url ? values.cta_url : null,
        send_email: sendEmail,
      },
      {
        onSuccess: (response) => {
          toast.success(
            t("toast.pushed", {
              sent: response.emails_sent,
              failed: response.emails_failed,
            }),
          );
          reset();
          setSendEmail(false);
        },
        onError: (error) =>
          toast.error(getApiErrorMessage(error, t("toast.pushFailed"))),
      },
    );
  };

  const submit = handleSubmit((values) => {
    if (sendEmail) {
      setPendingValues(values);
      setConfirmOpen(true);
      return;
    }
    doSend(values);
  });

  const fieldError = (hasError: boolean) => cn(hasError && "border-brand-red");

  return (
    <section className="card-elevated rounded-2xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
        <Megaphone className="size-5 text-mint" aria-hidden="true" />
        {t("admin.composer.title")}
      </h2>

      <form
        onSubmit={submit}
        className="mt-5 grid gap-4 lg:grid-cols-2"
        noValidate
      >
        {/* The one screen where both directions coexist: Arabic fields
            always render RTL in the Arabic face; English fields stay LTR
            whatever the active UI language is. */}
        <div className="grid gap-1.5">
          <Label htmlFor="push-title-ar">{t("admin.composer.titleAr")}</Label>
          <Input
            id="push-title-ar"
            dir="rtl"
            className={cn("font-arabic", fieldError(Boolean(errors.title_ar)))}
            {...register("title_ar")}
          />
          {errors.title_ar && (
            <p className="text-xs text-brand-red">{errors.title_ar.message}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="push-message-ar">
            {t("admin.composer.messageAr")}
          </Label>
          <Textarea
            id="push-message-ar"
            dir="rtl"
            rows={4}
            className={cn(
              "font-arabic",
              fieldError(Boolean(errors.message_ar)),
            )}
            {...register("message_ar")}
          />
          {errors.message_ar && (
            <p className="text-xs text-brand-red">
              {errors.message_ar.message}
            </p>
          )}
        </div>

        <div className="grid content-start gap-1.5">
          <Label htmlFor="push-cta">{t("admin.composer.ctaUrl")}</Label>
          <Input
            id="push-cta"
            type="url"
            placeholder="https://…"
            dir="ltr"
            className={fieldError(Boolean(errors.cta_url))}
            {...register("cta_url")}
          />
          {errors.cta_url && (
            <p className="text-xs text-brand-red">{errors.cta_url.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 self-start rounded-xl bg-secondary px-4 py-3 lg:col-span-2">
          <span className="text-sm font-medium text-ink">
            {t("admin.composer.sendEmail")}
          </span>
          <Switch
            checked={sendEmail}
            onCheckedChange={setSendEmail}
            aria-label={t("admin.composer.sendEmail")}
          />
        </div>

        <button
          type="submit"
          disabled={push.isPending}
          className="btn-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-2"
        >
          <Send className="size-4 rtl:rotate-180" aria-hidden="true" />
          {push.isPending
            ? t("admin.composer.submitting")
            : t("admin.composer.submit")}
        </button>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.confirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.confirm.cancel")}</AlertDialogCancel>
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              onClick={() =>
                pendingValues && doSend(getValues() as PushFormValues)
              }
            >
              {t("admin.confirm.confirm")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
