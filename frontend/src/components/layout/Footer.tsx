import {
  MapPin,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Youtube,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";
import logo from "@/assets/church-logo.png";

const socials = [
  { Icon: Facebook, label: "Facebook" },
  { Icon: Instagram, label: "Instagram" },
  { Icon: Youtube, label: "YouTube" },
];

export function Footer() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("landing");
  const quickItems = t("footer.quickItems", {
    returnObjects: true,
  }) as readonly string[];
  const ministryItems = t("footer.ministryItems", {
    returnObjects: true,
  }) as readonly string[];

  return (
    <footer
      id="contact"
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
      className="bg-navy text-white"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] lg:px-8">
        <div>
          <img
            src={logo}
            alt="إجتماع الشباب بأبنوب church logo"
            width={160}
            height={112}
            loading="lazy"
            className="h-24 w-auto brightness-0 invert"
          />
          <p
            dir="rtl"
            lang="ar"
            className="font-arabic mt-3 w-fit text-lg font-bold"
          >
            إجتماع الشباب بأبنوب
          </p>
        </div>

        <nav aria-label={t("footer.quickLinks")}>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em]">
            {t("footer.quickLinks")}
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            {quickItems.map((label, i) => (
              <li key={label}>
                <a
                  href={`#${linkSlug[i]}`}
                  className="focus-ring rounded-sm hover:text-mint"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("footer.ministries")}>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em]">
            {t("footer.ministries")}
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            {ministryItems.map((label) => (
              <li key={label}>
                <a
                  href="#ministries"
                  className="focus-ring rounded-sm hover:text-mint"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em]">
            {t("footer.contactUs")}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li className="flex gap-3">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-mint"
                aria-hidden="true"
              />
              <span className={isArabic ? "font-arabic" : ""}>
                {t("footer.addressLine1")}
                <br />
                {t("footer.addressLine2")}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Phone
                className="h-4 w-4 shrink-0 text-mint"
                aria-hidden="true"
              />
              <a
                href="tel:+201234567890"
                dir="ltr"
                className="focus-ring rounded-sm hover:text-mint"
              >
                +20 123 456 7890
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
              <a
                href="mailto:youth@churchname.org"
                className="focus-ring rounded-sm hover:text-mint"
              >
                youth@churchname.org
              </a>
            </li>
          </ul>
          <ul className="mt-5 flex gap-3">
            {socials.map(({ Icon, label }) => (
              <li key={label}>
                <a
                  href="#contact"
                  aria-label={label}
                  className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-white/12 transition-colors hover:bg-mint"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/12">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className={cn(isArabic && "font-arabic")}>
            {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Anchor slugs matching the quick-link order in i18n. */
const linkSlug = [
  "home",
  "about",
  "ministries",
  "events",
  "gallery",
  "contact",
];
