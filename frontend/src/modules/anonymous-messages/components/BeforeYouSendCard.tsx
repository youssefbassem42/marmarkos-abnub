import { Flame, Heart, Info, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Design's glyph set for the four "Before You Send" lines. */
const ITEM_ICONS = [MessageSquare, Flame, Heart, Info] as const;

/** "Before You Send": four short guidance bullets beside the info card. */
export function BeforeYouSendCard({ className }: { className?: string }) {
  const { t } = useTranslation("anonymousMessages");
  const items = t("beforeYouSend.items", {
    returnObjects: true,
  }) as readonly string[];

  return (
    <section
      className={cn(
        "card-elevated rounded-2xl border border-border bg-card p-6",
        className,
      )}
    >
      <h2 className="font-heading text-base font-bold text-ink">
        {t("beforeYouSend.title")}
      </h2>
      <ul className="mt-4 space-y-4">
        {items.map((item, index) => {
          const Icon = ITEM_ICONS[index % ITEM_ICONS.length];
          return (
            <li key={item} className="flex items-start gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary"
                aria-hidden="true"
              >
                <Icon className="size-4.5 text-brand-blue" />
              </span>
              <p className="pt-1.5 text-xs leading-relaxed text-muted-foreground">
                {item}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
