import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError, resetPassword } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PasswordField } from "../components/PasswordField";
import { PasswordRequirements } from "./PasswordRequirements";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "./resetPasswordSchema";

interface ResetPasswordFormProps {
  lang: "ar" | "en";
  token: string;
  onSuccess: () => void;
}

export function ResetPasswordForm({
  lang,
  token,
  onSuccess,
}: ResetPasswordFormProps) {
  const { t } = useTranslation("resetPassword");
  const isArabic = lang === "ar";
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(
      resetPasswordSchema({
        passwordRequired: t("validation.passwordRequired"),
        passwordTooShort: t("validation.passwordTooShort"),
        passwordTooLong: t("validation.passwordTooLong"),
        passwordWeak: t("validation.passwordWeak"),
        confirmRequired: t("validation.confirmRequired"),
        passwordMismatch: t("validation.passwordMismatch"),
      }),
    ),
    mode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await resetPassword({ token, password: values.password });
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400 || error.status === 401) {
          setSubmitError(t("validation.invalidToken"));
        } else {
          setSubmitError(t("validation.resetFailed"));
        }
      } else {
        setSubmitError(t("validation.networkError"));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="password">
          {t("form.newPasswordLabel")}
          <span className="ms-1 text-brand-red" aria-hidden="true">
            *
          </span>
        </Label>
        <PasswordField
          id="password"
          value={password}
          onChange={(value) =>
            setValue("password", value, { shouldValidate: true })
          }
          placeholder={t("form.newPasswordPlaceholder")}
          invalid={Boolean(errors.password)}
          lang={lang}
          showPasswordLabel={t("form.showPassword")}
          hidePasswordLabel={t("form.hidePassword")}
        />
        {errors.password?.message ? (
          <p
            id="password-error"
            className="text-sm font-medium text-brand-red"
            role="alert"
          >
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <PasswordRequirements password={password} lang={lang} />

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">
          {t("form.confirmPasswordLabel")}
          <span className="ms-1 text-brand-red" aria-hidden="true">
            *
          </span>
        </Label>
        <PasswordField
          id="confirmPassword"
          value={confirmPassword}
          onChange={(value) =>
            setValue("confirmPassword", value, { shouldValidate: true })
          }
          placeholder={t("form.confirmPasswordPlaceholder")}
          invalid={Boolean(errors.confirmPassword)}
          lang={lang}
          showPasswordLabel={t("form.showPassword")}
          hidePasswordLabel={t("form.hidePassword")}
        />
        {errors.confirmPassword?.message ? (
          <p
            id="confirmPassword-error"
            className="text-sm font-medium text-brand-red"
            role="alert"
          >
            {errors.confirmPassword.message}
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
            <Lock className="h-5 w-5" aria-hidden="true" />
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
          "h-12 w-full rounded-xl border-navy text-navy focus-ring",
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
