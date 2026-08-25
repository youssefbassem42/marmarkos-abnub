import { Clock, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

const ITEM_ICONS = [
  { Icon: ShieldCheck, tint: "text-brand-blue", bg: "bg-brand-blue/10" },
  { Icon: Users, tint: "text-mint", bg: "bg-mint/10" },
  { Icon: Clock, tint: "text-brand-orange", bg: "bg-brand-orange/10" },
] as const;

interface InfoItem {
  title: string;
  description: string;
}

/**
 * "Important Information": three reassurance rows. The third item ships
 * the D-14 reword ("Every message is read") — no delivery-time promise.
 */
export function ImportantInfoCard() {
  const { t } = useTranslation("anonymousMessages");
  const items = t("importantInfo.items", {
    returnObjects: true,
  }) as readonly InfoItem[];

  return (
    <section className="card-elevated rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-base font-bold text-ink">
        {t("importantInfo.title")}
      </h2>
      <ul className="mt-4 space-y-4">
        {items.map((item, index) => {
          const { Icon, tint, bg } = ITEM_ICONS[index % ITEM_ICONS.length];
          return (
            <li key={item.title} className="flex items-start gap-3">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${bg}`}
                aria-hidden="true"
              >
                <Icon className={`size-4.5 ${tint}`} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
