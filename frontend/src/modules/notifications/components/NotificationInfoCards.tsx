import { useTranslation } from "react-i18next";
import { Bell, Filter, HeartHandshake, Megaphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CARD_ICONS: LucideIcon[] = [Bell, Filter, HeartHandshake, Megaphone];
const ICON_TINTS = [
  "bg-mint/10 text-mint",
  "bg-brand-blue/10 text-brand-blue",
  "bg-brand-orange/10 text-brand-orange",
  "bg-navy/10 text-navy dark:text-white",
];

/** The four-card strip under the feed; copy carries the D-14 rewords. */
export function NotificationInfoCards({ className }: { className?: string }) {
  const { t } = useTranslation("notifications");
  const cards = t("infoCards", {
    returnObjects: true,
  }) as readonly { title: string; description: string }[];

  return (
    <section
      aria-label={t("title")}
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
    >
      {cards.map((card, index) => {
        const Icon = CARD_ICONS[index % CARD_ICONS.length];
        return (
          <article
            key={card.title}
            className="card-elevated rounded-2xl border border-border bg-card p-5"
          >
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full",
                ICON_TINTS[index % ICON_TINTS.length],
              )}
              aria-hidden="true"
            >
              <Icon className="size-5" />
            </span>
            <h3 className="mt-3 font-heading text-sm font-bold text-ink">
              {card.title}
            </h3>
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed text-muted-foreground",
                typeof document !== "undefined" &&
                  document.documentElement.lang === "ar" &&
                  "font-arabic",
              )}
            >
              {card.description}
            </p>
          </article>
        );
      })}
    </section>
  );
}
