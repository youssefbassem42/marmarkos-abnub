import { useTranslation } from "react-i18next";
import { Flame, Heart, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterItem {
  title: string;
  description: string;
}

const footerIcons = [
  { Icon: ShieldCheck, accent: "bg-mint/15 text-mint" },
  { Icon: Users, accent: "bg-brand-blue/15 text-brand-blue" },
  { Icon: Heart, accent: "bg-brand-orange/15 text-brand-orange" },
  { Icon: Flame, accent: "bg-brand-red/15 text-brand-red" },
] as const;

interface AuthFooterProps {
  lang: "ar" | "en";
}

export function AuthFooter({ lang }: AuthFooterProps) {
  const { t } = useTranslation("common");
  const isArabic = lang === "ar";
  const items = t("footer", { returnObjects: true }) as readonly FooterItem[];

  return (
    <section
      dir={isArabic ? "rtl" : "ltr"}
      lang={lang}
      className="bg-navy py-14"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {items.map(({ title, description }, index) => {
          const { Icon, accent } = footerIcons[index];
          return (
            <div key={title} className="flex flex-col items-center text-center">
              <span
                className={`grid h-16 w-16 place-items-center rounded-full ${accent}`}
              >
                <Icon className="h-8 w-8" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-heading text-xl font-semibold text-white">
                {title}
              </h3>
              <p
                className={cn(
                  "mt-2 max-w-xs leading-relaxed text-white/80",
                  isArabic ? "font-arabic text-lg" : "text-base",
                )}
              >
                {description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
