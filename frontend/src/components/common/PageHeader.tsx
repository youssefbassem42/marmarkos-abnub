import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** The title of the page. It wraps; it never overflows. */
  title: string;
  /** One line of description under the title. */
  description?: string;
  /** The route of the way back. When there is none, no way back is rendered. */
  backTo?: string;
  /** The label of the way back. Defaults to ``common.back``. */
  backLabel?: string;
  /** The buttons of the page. They wrap under the title on a phone. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The shared header of a page: the title, an optional description, the
 * page actions and a real link back to the parent route.
 *
 * The way back is the first element of the tab order of the page: it is an
 * anchor, so it can be opened in a new tab and it is reachable with the
 * keyboard. The platform is RTL, so the arrow points to the right.
 */
export function PageHeader({
  title,
  description,
  backTo,
  backLabel,
  actions,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation("common");
  const label = backLabel ?? t("back");

  return (
    <Card className={cn("rounded-2xl", className)}>
      <div className="flex flex-col gap-4 p-6">
        {backTo ? (
          <Link
            to={backTo}
            className={cn(
              "btn-outline focus-ring rounded-xl inline-flex items-center gap-2 px-4 py-2 text-sm font-medium",
            )}
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        ) : null}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="font-heading text-ink text-lg sm:text-xl break-words">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground break-words">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </Card>
  );
}
