import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthFooter } from "@/pages/auth/components/AuthFooter";
import { BrandPanel } from "@/pages/auth/components/BrandPanel";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
/**
 * The check-in screen's two-column split: light brand panel (26%) beside
 * the soft-grey work area with the admin topbar. Mirrors the design
 * screenshots; the brand panel collapses away below md so the camera
 * owns a phone viewport.
 */
export function AttendanceLayout() {
  const { t } = useTranslation("attendance");

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-background"
    >
      <main className="flex min-h-screen flex-col lg:flex-row">
        <BrandPanel
          lang="ar"
          variant="light"
          className="hidden w-full md:flex lg:w-[26%]"
        />
        <section className="flex w-full flex-col bg-soft lg:w-[74%]">
          <AdminTopbar
            title={t("checkIn.title")}
            subtitle={t("checkIn.subtitle")}
            backHref="/"
          />
          <div className="mx-auto w-full max-w-5xl px-5 py-6 lg:px-8">
            <Outlet />
          </div>
        </section>
      </main>
      <AuthFooter lang="ar" />
    </div>
  );
}
