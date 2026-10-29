import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Church, Mail, MapPin } from "lucide-react";
import logo from "@/assets/church-logo.png";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

export function AboutUsPage() {
  const { t } = useTranslation("aboutUs");
  const { t: tCommon } = useTranslation("common");

  // The blocks that fade in need the observer of the landing page: without
  // it they stay at opacity 0 and the page reads as empty.
  useScrollReveal();

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="landing" />
      <main className="space-y-6">
        <section className="bg-soft rounded-2xl card-elevated p-6 lg:p-10">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:px-8 lg:items-center">
            <div className="reveal flex flex-col items-center gap-4 lg:items-start">
              <span className="grid h-24 w-24 place-items-center rounded-2xl bg-white/10">
                <img
                  src={logo}
                  alt={tCommon("brand.logoAlt")}
                  width={150}
                  height={100}
                  className="h-[100px] w-[150px] object-contain"
                  loading="lazy"
                />
              </span>
              <h1
                className={cn(
                  "text-ink font-heading font-extrabold tracking-tight",
                  "text-[clamp(2rem,6vw,3rem)] text-center lg:text-left",
                )}
              >
                {t("title")}
              </h1>
            </div>

            <div className="reveal">
              <h2
                className={cn(
                  "text-ink font-heading font-extrabold tracking-tight",
                  "text-[clamp(1.9rem,4vw,2.5rem)]",
                )}
              >
                {t("mission.heading")}
              </h2>
              <p className="mt-3 max-w-prose leading-8 text-muted-foreground font-arabic text-lg">
                {t("mission.text")}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-soft rounded-2xl card-elevated p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <Church className="h-6 w-6 text-mint" aria-hidden="true" />
            <h2 className="text-ink font-heading font-extrabold text-2xl">
              {t("meeting.heading")}
            </h2>
          </div>
          <p className="mt-3 max-w-prose leading-8 text-muted-foreground font-arabic text-lg">
            {t("meeting.text")}
          </p>
          <p className="mt-2 font-arabic text-muted-foreground text-lg">
            {t("meeting.time")} &middot; {t("meeting.location")}
          </p>
        </section>

        <section className="bg-soft rounded-2xl card-elevated p-6 lg:p-8">
          <h2 className="text-ink font-heading font-extrabold text-2xl">
            {t("audience.heading")}
          </h2>
          <p className="mt-3 max-w-prose leading-8 text-muted-foreground font-arabic text-lg">
            {t("audience.text")}
          </p>
        </section>

        <section className="bg-soft rounded-2xl card-elevated p-6 lg:p-8">
          <h2 className="text-ink font-heading font-extrabold text-2xl">
            {t("contact.heading")}
          </h2>
          <ul className="mt-4 space-y-3">
            <li className="flex items-center gap-3">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-mint"
                aria-hidden="true"
              />
              <span className="font-arabic text-muted-foreground text-lg">
                {t("contact.address")}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
              <a
                href={`mailto:${t("contact.email")}`}
                className="focus-ring rounded-sm hover:text-mint font-arabic text-muted-foreground text-lg"
              >
                {t("contact.email")}
              </a>
            </li>
          </ul>
        </section>

        <section className="bg-soft rounded-2xl card-elevated p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <h2 className="text-ink font-heading font-extrabold text-2xl">
              {t("verse.heading")}
            </h2>
          </div>
          <figure>
            <blockquote
              className={cn(
                "mt-3 font-verse text-[15px] font-medium italic leading-7 text-brand-blue not-italic text-lg leading-8",
              )}
            >
              {t("verse.text")}
            </blockquote>
            <figcaption className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-mint font-arabic">
              {t("verse.ref")}
            </figcaption>
          </figure>
          <Link
            to="/bible-verses"
            className={cn(
              "mt-6 inline-flex items-center gap-2 btn-outline text-sm",
            )}
          >
            <span className="font-arabic">{t("verse.readMore")}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
