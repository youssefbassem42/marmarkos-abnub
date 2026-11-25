import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { ErrorRetry } from "@/components/common/ErrorRetry";
import { toApiError } from "@/lib/api";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useBlogPostByShortCode } from "../../hooks";

/**
 * The public address of a tiny link.
 *
 * The code is looked up and the member is sent to the slug of the post.
 * An unknown code is a real 404, not a silent blank page.
 */
export function BlogShortLinkPage() {
  const { t } = useTranslation("blog");
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const query = useBlogPostByShortCode(code);

  useEffect(() => {
    const slug = query.data?.slug;
    if (!slug) return;
    navigate(`/blog/${encodeURIComponent(slug)}`, { replace: true });
  }, [navigate, query.data]);

  if (query.error && toApiError(query.error).status === 404) {
    return <NotFoundPage />;
  }

  if (query.error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-sm text-muted-foreground">{t("shortLink.failed")}</p>
        <ErrorRetry onRetry={() => void query.refetch()} />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2
        className="h-6 w-6 animate-spin text-brand-blue"
        aria-hidden="true"
      />
      <p className="text-sm font-arabic">{t("shortLink.loading")}</p>
    </div>
  );
}

export default BlogShortLinkPage;
