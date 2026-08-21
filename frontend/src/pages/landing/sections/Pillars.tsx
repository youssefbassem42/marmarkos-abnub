import { BookOpen, Users, Heart, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";

const pillars = [
  { Icon: BookOpen, color: "var(--brand-mint)" },
  { Icon: Users, color: "var(--brand-blue)" },
  { Icon: Heart, color: "var(--brand-orange)" },
  { Icon: Flame, color: "var(--brand-red)" },
];

export function Pillars() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("landing");
  const items = t("pillars.items", {
    returnObjects: true,
  }) as readonly { title: string; text: string }[];

  return (
    <section id="ministries" className="bg-soft py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto flex max-w-xl items-center gap-5">
          <span className="h-px flex-1 bg-border" />
          <h2
            className={cn(
              "text-center text-2xl font-extrabold tracking-tight text-navy lg:text-[28px]",
              isArabic ? "font-arabic text-3xl" : "",
            )}
          >
            {t("pillars.heading")}
          </h2>
          <span className="h-px flex-1 bg-border" />
        </div>

        <ul className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {items.map(({ title, text }, i) => {
            const { Icon, color } = pillars[i % pillars.length];
            return (
              <li
                key={title}
                className={cn(
                  "reveal flex flex-col items-center px-4 text-center lg:px-8",
                  isArabic ? "font-arabic" : "",
                  i > 0 && "lg:border-l lg:border-border",
                )}
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                <span
                  className="grid h-[70px] w-[70px] shrink-0 place-items-center rounded-full text-white shadow-sm transition-transform duration-300 hover:-translate-y-1"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="h-8 w-8" aria-hidden="true" />
                </span>
                <h3
                  className={cn(
                    "mt-6 text-[15px] font-extrabold tracking-tight text-navy",
                    isArabic ? "text-xl" : "",
                  )}
                >
                  {title}
                </h3>
                <p
                  className={cn(
                    "mt-3 max-w-[15rem] text-sm leading-6 text-muted-foreground",
                    isArabic ? "text-base leading-7" : "",
                  )}
                >
                  {text}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
