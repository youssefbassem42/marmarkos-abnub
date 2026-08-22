import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestPasswordReset } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "./forgotPasswordSchema";

interface ForgotPasswordFormProps {
  lang: "ar" | "en";
  onSuccess: () => void;
}

export function ForgotPasswordForm({
  lang,
  onSuccess,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation("forgotPassword");
  const isArabic = lang === "ar";
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(
      forgotPasswordSchema({
        emailRequired: t("validation.emailRequired"),
        emailInvalid: t("validation.emailInvalid"),
      }),
    ),
    mode: "onChange",
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await requestPasswordReset({ email: values.email });
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(t("validation.requestFailed"));
      } else {
        setSubmitError(t("validation.networkError"));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email">
          {t("form.emailLabel")}
          <span className="ms-1 text-brand-red" aria-hidden="true">
            *
          </span>
        </Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="email"
            type="email"
            placeholder={t("form.emailPlaceholder")}
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            className={cn(
              "h-11 w-full rounded-xl border-border bg-background ps-9 pe-3 focus-ring",
              isArabic && "font-arabic text-lg placeholder:text-base",
              errors.email && "border-brand-red focus-visible:ring-brand-red",
            )}
            {...register("email")}
          />
        </div>
        {errors.email?.message ? (
          <p
            id="email-error"
            className="text-sm font-medium text-brand-red"
            role="alert"
          >
            {errors.email.message}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <div
          role="alert"
          className="rounded-xl border border-brand-red/30 bg-brand-red/5 px-4 py-3 text-sm font-medium text-brand-red"
        >
          {submitError}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={isSubmitting || !isValid}
        className="h-12 w-full rounded-xl bg-navy text-lg text-white transition-colors hover:bg-navy/90 focus-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
            {t("form.ctaLoading")}
          </>
        ) : (
          <>
            <Send className="h-5 w-5" aria-hidden="true" />
            {t("form.cta")}
          </>
        )}
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        {t("form.or")}
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <Button
        asChild
        variant="outline"
        className={cn(
          "h-12 w-full rounded-xl border-navy text-ink focus-ring",
          isArabic ? "font-arabic text-lg" : "text-base font-semibold",
        )}
      >
        <Link to="/login">
          {isArabic ? (
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          )}
          {t("form.backToLogin")}
        </Link>
      </Button>
    </form>
  );
}
