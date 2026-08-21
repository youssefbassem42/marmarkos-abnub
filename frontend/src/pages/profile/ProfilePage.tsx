import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, CheckCircle2, KeyRound, Mail, MapPin, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/layout/Navbar";
import { useLanguage } from "@/i18n/context";
import {
  ApiError,
  changePassword,
  updateProfile,
  uploadAvatar,
} from "@/lib/api";
import { getAccessToken, getAuthUser, updateStoredUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Status = { kind: "ok" | "error"; text: string } | null;

export function ProfilePage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("profile");
  const navigate = useNavigate();

  const [user, setUser] = useState(getAuthUser);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<Status>(null);

  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);

  // Signed-in users only.
  useEffect(() => {
    if (!getAccessToken()) navigate("/login", { replace: true });
  }, [navigate]);

  if (!user) return null;
  const inputClass = cn(
    "h-11 rounded-xl border-border bg-background focus-ring",
    isArabic ? "font-arabic text-lg placeholder:text-base" : "",
  );

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadAvatar(file, getAccessToken()!);
      updateStoredUser(updated);
      setUser(updated);
    } catch (error) {
      setProfileStatus({
        kind: "error",
        text:
          error instanceof ApiError && error.status === 403
            ? t("validation.uploadFailed")
            : t("validation.uploadFailed"),
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      const updated = await updateProfile(
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          date_of_birth: dateOfBirth || undefined,
          address: address.trim(),
        },
        getAccessToken()!,
      );
      updateStoredUser(updated);
      setUser(updated);
      setProfileStatus({ kind: "ok", text: t("validation.saved") });
    } catch (error) {
      setProfileStatus({
        kind: "error",
        text:
          error instanceof ApiError
            ? error.message || t("validation.saveFailed")
            : t("validation.networkError"),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordStatus(null);
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ kind: "error", text: t("password.mismatch") });
      return;
    }
    if (
      !(/[a-z]/.test(newPassword) &&
        /[A-Z]/.test(newPassword) &&
        /\d/.test(newPassword) &&
        /[^A-Za-z0-9]/.test(newPassword))
    ) {
      setPasswordStatus({ kind: "error", text: t("password.weak") });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(
        user.has_password
          ? { current_password: currentPassword, new_password: newPassword }
          : { new_password: newPassword },
        getAccessToken()!,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      updateStoredUser({ ...user, has_password: true });
      setUser({ ...user, has_password: true });
      setPasswordStatus({ kind: "ok", text: t("password.success") });
    } catch (error) {
      setPasswordStatus({
        kind: "error",
        text:
          error instanceof ApiError
            ? error.message || t("validation.saveFailed")
            : t("validation.networkError"),
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = `${(user.first_name ?? "?")[0]}${(user.last_name ?? "")[0] ?? ""}`.toUpperCase();

  return (
    <div dir={isArabic ? "rtl" : "ltr"} lang={language} className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-3xl px-5 pb-16 pt-28 lg:px-8">
        <header className="text-center">
          <h1 className={cn("text-3xl font-extrabold tracking-tight text-navy", isArabic && "font-arabic")}>
            {t("heading")}
          </h1>
          <p className={cn("mt-2 text-muted-foreground", isArabic ? "font-arabic text-lg" : "text-sm")}>
            {t("subtitle")}
          </p>
        </header>

        {/* Avatar */}
        <section className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_2px_24px_rgba(37,61,99,0.08)] sm:flex-row">
          <div className="relative">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={t("avatar.removeAlt")}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-full bg-navy text-2xl font-bold text-white">
                {initials}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label={t("avatar.change")}
              className="focus-ring absolute bottom-0 end-0 grid h-9 w-9 place-items-center rounded-full bg-mint text-white shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void handleAvatarChange(e.target.files?.[0])}
            />
          </div>
          <div className="text-center sm:text-start">
            <p className={cn("font-bold text-navy", isArabic ? "font-arabic text-xl" : "text-lg")}>
              {user.first_name} {user.last_name}
            </p>
            <p className="text-sm text-muted-foreground">{t("avatar.hint")}</p>
          </div>
        </section>

        {/* Profile fields */}
        <form
          onSubmit={handleProfileSubmit}
          noValidate
          className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[0_2px_24px_rgba(37,61,99,0.08)] sm:p-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("form.firstNameLabel")} htmlFor="firstName" icon={<User className="h-4 w-4" />}>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={inputClass} />
            </Field>
            <Field label={t("form.lastNameLabel")} htmlFor="lastName" icon={<User className="h-4 w-4" />}>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={inputClass} />
            </Field>
          </div>

          <Field label={t("form.emailLabel")} htmlFor="email" icon={<Mail className="h-4 w-4" />} hint={t("form.emailHint")}>
            <Input id="email" value={user.email} disabled dir="ltr" className={cn(inputClass, "cursor-not-allowed opacity-70")} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("form.phoneLabel")} htmlFor="phone" icon={<Phone className="h-4 w-4" />}>
              <Input id="phone" type="tel" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={cn(inputClass, "ps-9 pe-3 text-start")} />
            </Field>
            <Field label={t("form.dateOfBirthLabel")} htmlFor="dateOfBirth">
              <Input id="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
            </Field>
          </div>

          <Field label={t("form.addressLabel")} htmlFor="address" icon={<MapPin className="h-4 w-4" />}>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" className={cn(inputClass, "ps-9 pe-3")} />
          </Field>

          <StatusBanner status={profileStatus} />

          <Button
            type="submit"
            disabled={savingProfile}
            className={cn(
              "h-12 w-full rounded-xl bg-navy text-lg text-white transition-colors hover:bg-navy/90 focus-ring disabled:cursor-not-allowed disabled:opacity-60",
              isArabic && "font-arabic",
            )}
          >
            {savingProfile ? t("form.saving") : t("form.save")}
          </Button>
        </form>

        {/* Password */}
        <form
          onSubmit={handlePasswordSubmit}
          noValidate
          className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[0_2px_24px_rgba(37,61,99,0.08)] sm:p-8"
        >
          <h2 className={cn("flex items-center gap-2 font-extrabold text-navy", isArabic ? "font-arabic text-xl" : "text-lg")}>
            <KeyRound className="h-5 w-5 text-mint" aria-hidden="true" />
            {t("password.heading")}
          </h2>

          {!user.has_password && (
            <p className={cn("rounded-xl bg-blue-50 px-4 py-3 text-sm text-brand-blue", isArabic && "font-arabic")}>
              {t("password.noCurrentHint")}
            </p>
          )}

          {user.has_password && (
            <Field label={t("password.currentLabel")} htmlFor="currentPassword">
              <Input
                id="currentPassword"
                type="password"
                dir="ltr"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className={inputClass}
              />
            </Field>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("password.newLabel")} htmlFor="newPassword">
              <Input id="newPassword" type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
            </Field>
            <Field label={t("password.confirmLabel")} htmlFor="confirmPassword">
              <Input id="confirmPassword" type="password" dir="ltr" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
            </Field>
          </div>

          <StatusBanner status={passwordStatus} />

          <Button
            type="submit"
            disabled={savingPassword}
            className={cn(
              "h-12 w-full rounded-xl border border-navy bg-transparent text-base font-semibold text-navy transition-colors hover:bg-soft focus-ring disabled:cursor-not-allowed disabled:opacity-60",
              isArabic && "font-arabic",
            )}
          >
            {savingPassword ? t("password.updating") : t("password.cta")}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link to="/" className={cn("font-semibold text-brand-blue underline-offset-4 hover:underline", isArabic && "font-arabic")}>
            ← /
          </Link>
        </p>
      </main>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  icon,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        ) : null}
        <div className={icon ? "[&_input]:ps-9" : undefined}>{children}</div>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatusBanner({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <div
      role={status.kind === "error" ? "alert" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
        status.kind === "ok"
          ? "border border-mint/40 bg-mint/10 text-emerald-700"
          : "border border-brand-red/30 bg-brand-red/5 text-brand-red",
      )}
    >
      {status.kind === "ok" && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
      {status.text}
    </div>
  );
}
