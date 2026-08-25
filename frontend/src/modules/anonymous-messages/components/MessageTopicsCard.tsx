import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

/** The light-blue tips box: two columns of suggested topics on desktop. */
export function MessageTopicsCard({ className }: { className?: string }) {
  const { t } = useTranslation("anonymousMessages");
  const items = t("topics.items", { returnObjects: true }) as readonly string[];

  return (
    <section
      className={cn(
        "rounded-2xl border border-brand-blue/20 bg-brand-blue/5 p-6",
        className,
      )}
    >
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
        <Lightbulb className="size-5 text-brand-blue" aria-hidden="true" />
        {t("topics.title")}
      </h2>
      <ul className="mt-3 grid list-inside list-disc grid-cols-1 gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
