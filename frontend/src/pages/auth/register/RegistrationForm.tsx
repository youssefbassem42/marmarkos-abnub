import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Mail, Phone, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError, registerUser } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FormField } from "./FormField";
import { SelectField } from "./SelectField";
import { PasswordField } from "../components/PasswordField";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { registerSchema, type RegisterFormValues } from "./registerSchema";

type RegisterFormProps = {
  onSuccess: (email: string) => void;
  lang: "ar" | "en";
};

export function RegistrationForm({ onSuccess, lang }: RegisterFormProps) {
  const { t } = useTranslation("register");
  const isArabic = lang === "ar";
  const inputClass = cn(
    "h-11 rounded-xl border-border bg-background px-3 focus-ring",
    isArabic ? "font-arabic text-lg placeholder:text-base" : "text-base",
  );

  const [submitError, setSubmitError] = useState<string | null>(null);

  const messages = {
    required: t("validation.required"),
    nameTooLong: t("validation.nameTooLong"),
    emailRequired: t("validation.emailRequired"),
    emailInvalid: t("validation.emailInvalid"),
    passwordTooShort: t("validation.passwordTooShort"),
    passwordTooLong: t("validation.passwordTooLong"),
    phoneInvalid: t("validation.phoneInvalid"),
    termsRequired: t("validation.termsRequired"),
    passwordMismatch: t("validation.passwordMismatch"),
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema(messages)),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      dateOfBirth: "",
      phone: "",
      iAm: "",
      howHeard: "",
      terms: false,
    },
  });

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");
  const iAm = watch("iAm");
  const howHeard = watch("howHeard");
  const terms = watch("terms");

  const iAmOptions = [
    { value: "member", label: t("options.iAm.member") },
    { value: "servant", label: t("options.iAm.servant") },
    { value: "leader", label: t("options.iAm.leader") },
    { value: "other", label: t("options.iAm.other") },
  ];

  const howHeardOptions = [
    { value: "friend", label: t("options.howHeard.friend") },
    { value: "church", label: t("options.howHeard.church") },
    { value: "social", label: t("options.howHeard.social") },
    { value: "event", label: t("options.howHeard.event") },
    { value: "other", label: t("options.howHeard.other") },
  ];

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerUser({
        email: values.email,
        password: values.password,
        first_name: values.firstName,
        last_name: values.lastName,
        phone: values.phone || undefined,
      });
      onSuccess(values.email);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setSubmitError(t("apiErrors.emailTaken"));
        } else {
          setSubmitError(t("apiErrors.registrationFailed"));
        }
      } else {
        setSubmitError(t("apiErrors.networkError"));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="firstName"
          label={t("form.firstNameLabel")}
          required
          error={errors.firstName?.message}
        >
          <Input
            id="firstName"
            placeholder={t("form.firstNamePlaceholder")}
            autoComplete="given-name"
            aria-invalid={Boolean(errors.firstName)}
            className={inputClass}
            {...register("firstName")}
          />
        </FormField>

        <FormField
          id="lastName"
          label={t("form.lastNameLabel")}
          required
          error={errors.lastName?.message}
        >
          <Input
            id="lastName"
            placeholder={t("form.lastNamePlaceholder")}
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
            className={inputClass}
            {...register("lastName")}
          />
        </FormField>
      </div>

      <FormField
        id="email"
        label={t("form.emailLabel")}
        required
        error={errors.email?.message}
      >
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
              inputClass,
              "w-full ps-9 pe-3",
              isArabic ? "font-arabic" : "",
            )}
            {...register("email")}
          />
        </div>
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="password"
          label={t("form.passwordLabel")}
          required
          error={errors.password?.message}
        >
          <PasswordField
            id="password"
            value={password}
            onChange={(value) =>
              setValue("password", value, { shouldValidate: true })
            }
            placeholder={t("form.passwordPlaceholder")}
            invalid={Boolean(errors.password)}
            lang={lang}
            showPasswordLabel={t("form.showPassword")}
            hidePasswordLabel={t("form.hidePassword")}
          />
        </FormField>

        <FormField
          id="confirmPassword"
          label={t("form.confirmPasswordLabel")}
          required
          error={errors.confirmPassword?.message}
        >
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
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="dateOfBirth"
          label={t("form.dateOfBirthLabel")}
          error={errors.dateOfBirth?.message}
        >
          <div className="relative">
            <Calendar
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="dateOfBirth"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              aria-invalid={Boolean(errors.dateOfBirth)}
              className={cn(
                inputClass,
                "ps-9 pe-3",
                isArabic ? "font-arabic" : "",
              )}
              {...register("dateOfBirth")}
            />
          </div>
        </FormField>

        <FormField
          id="phone"
          label={t("form.phoneLabel")}
          error={errors.phone?.message}
        >
          <div className="relative">
            <Phone
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="phone"
              type="tel"
              placeholder={t("form.phonePlaceholder")}
              autoComplete="tel"
              inputMode="tel"
              dir="ltr"
              aria-invalid={Boolean(errors.phone)}
              className={cn(
                inputClass,
                "ps-9 pe-3 text-start",
                isArabic ? "font-arabic" : "",
              )}
              {...register("phone")}
            />
          </div>
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="iAm"
          label={t("form.iAmLabel")}
          required
          error={errors.iAm?.message}
        >
          <SelectField
            id="iAm"
            value={iAm}
            onChange={(value) =>
              setValue("iAm", value, { shouldValidate: true })
            }
            placeholder={t("form.selectPlaceholder")}
            options={iAmOptions}
            invalid={Boolean(errors.iAm)}
          />
        </FormField>

        <FormField
          id="howHeard"
          label={t("form.howHeardLabel")}
          required
          error={errors.howHeard?.message}
        >
          <SelectField
            id="howHeard"
            value={howHeard}
            onChange={(value) =>
              setValue("howHeard", value, { shouldValidate: true })
            }
            placeholder={t("form.selectPlaceholder")}
            options={howHeardOptions}
            invalid={Boolean(errors.howHeard)}
          />
        </FormField>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="terms"
          checked={terms}
          onCheckedChange={(checked) =>
            setValue("terms", checked === true, { shouldValidate: true })
          }
          aria-invalid={Boolean(errors.terms)}
          className="mt-1 h-5 w-5 rounded-md border-navy"
        />
        <label
          htmlFor="terms"
          className={cn(
            "leading-relaxed text-muted-foreground",
            isArabic ? "font-arabic text-lg" : "text-sm",
          )}
        >
          {t("terms.prefix")}{" "}
          <a
            href="/terms"
            className="font-semibold text-brand-blue underline-offset-4 hover:underline"
          >
            {t("terms.termsLink")}
          </a>{" "}
          {t("terms.and")}{" "}
          <a
            href="/privacy"
            className="font-semibold text-brand-blue underline-offset-4 hover:underline"
          >
            {t("terms.privacyLink")}
          </a>
        </label>
      </div>
      {errors.terms?.message ? (
        <p className="text-sm font-medium text-brand-red" role="alert">
          {errors.terms.message}
        </p>
      ) : null}

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
            <UserPlus className="h-5 w-5" aria-hidden="true" />
            {t("form.cta")}
          </>
        )}
      </Button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span
          className={cn(
            "text-sm text-muted-foreground",
            isArabic && "font-arabic text-lg",
          )}
        >
          {t("form.or")}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <SocialAuthButtons
        googleLabel={t("social.google")}
        facebookLabel={t("social.facebook")}
        comingSoonLabel={t("social.comingSoon")}
      />

      <p
        className={cn(
          "text-center text-muted-foreground",
          isArabic ? "font-arabic text-lg" : "text-base",
        )}
      >
        {t("loginPrompt")}{" "}
        <Link
          to="/login"
          className="font-semibold text-mint underline-offset-4 hover:underline"
        >
          {t("loginCta")}
        </Link>
      </p>
    </form>
  );
}
