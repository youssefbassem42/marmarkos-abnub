import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface FooterItem {
  title: string;
  description: string;
}

/**
 * The navy strip closing the public anonymous page (DR-8): the four
 * `common.footer` blocks reused verbatim — never duplicated copy — plus
 * the copyright line with the canonical name and a computed year.
 */
export function BrandFooterStrip({
  className,
}: {
  className?: string;
}): ReactElement {
  const { t } = useTranslation("common");
  const { t: tLanding } = useTranslation("landing");
  const items = t("footer", { returnObjects: true }) as readonly FooterItem[];

  return (
    <section className={cn("bg-navy", className)}>
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {items.map(({ title, description }) => (
          <div key={title} className="text-center sm:text-start">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-white">
              {title}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70">
              {description}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t border-white/12">
        <div className="mx-auto max-w-7xl px-5 py-4 text-center text-xs text-white/60 lg:px-8">
          {tLanding("footer.copyright", {
            year: new Date().getFullYear(),
          })}
        </div>
      </div>
    </section>
  );
}
