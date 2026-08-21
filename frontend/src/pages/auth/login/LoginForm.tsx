import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, loginUser } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PasswordField } from "../components/PasswordField";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { loginSchema, type LoginFormValues } from "./loginSchema";

interface LoginFormProps {
  lang: "ar" | "en";
}

export function LoginForm({ lang }: LoginFormProps) {
  const { t } = useTranslation("login");
  const isArabic = lang === "ar";
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(
      loginSchema({
        emailRequired: t("validation.emailRequired"),
        emailInvalid: t("validation.emailInvalid"),
        passwordRequired: t("validation.passwordRequired"),
      }),
    ),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const { access_token: accessToken, user } = await loginUser({
        email: values.email,
        password: values.password,
      });
      saveAuth({ accessToken, user }, rememberMe);
      navigate("/");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setSubmitError(t("validation.invalidCredentials"));
        } else {
          setSubmitError(t("validation.loginFailed"));
        }
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

      <div className="space-y-1.5">
        <Label htmlFor="password">
          {t("form.passwordLabel")}
          <span className="ms-1 text-brand-red" aria-hidden="true">
            *
          </span>
        </Label>
        <PasswordField
          id="password"
          value={watch("password")}
          onChange={(value) =>
            setValue("password", value, { shouldValidate: true })
          }
          placeholder={t("form.passwordPlaceholder")}
          invalid={Boolean(errors.password)}
          autoComplete="current-password"
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="rememberMe"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
            className="h-5 w-5 rounded-md border-navy"
          />
          <label
            htmlFor="rememberMe"
            className={cn(
              "cursor-pointer text-muted-foreground",
              isArabic ? "font-arabic text-lg" : "text-sm font-medium",
            )}
          >
            {t("form.rememberMe")}
          </label>
        </div>
        <Link
          to="/forgot-password"
          className={cn(
            "font-semibold text-mint underline-offset-4 hover:underline focus-ring",
            isArabic ? "font-arabic text-lg" : "text-sm",
          )}
        >
          {t("form.forgotPassword")}
        </Link>
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
            <LogIn className="h-5 w-5" aria-hidden="true" />
            {t("form.cta")}
          </>
        )}
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        {t("form.or")}
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <SocialAuthButtons
        googleLabel={t("social.google")}
        facebookLabel={t("social.facebook")}
        comingSoonLabel={t("social.comingSoon")}
      />

      <p
        className={cn(
          "text-center text-muted-foreground",
          isArabic ? "font-arabic text-lg" : "text-sm",
        )}
      >
        {t("noAccount")}{" "}
        <Link
          to="/register"
          className="font-semibold text-mint underline-offset-4 hover:underline"
        >
          {t("createAccount")}
        </Link>
      </p>
    </form>
  );
}
