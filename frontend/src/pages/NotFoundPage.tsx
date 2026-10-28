import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * The page of a link that leads nowhere.
 *
 * The platform is Arabic-only (the English bundle was removed), so this
 * page speaks Arabic like every other page - the sibling "forbidden"
 * page already did.
 */
export function NotFoundPage() {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {t("notFound.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("notFound.body")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("notFound.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
