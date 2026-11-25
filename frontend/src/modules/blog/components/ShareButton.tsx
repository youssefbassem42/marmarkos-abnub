import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiError } from "@/hooks/useApiError";
import { blogApi } from "../api";

interface ShareablePost {
  id: string;
  short_code?: string;
}

interface ShareButtonProps {
  post: ShareablePost;
}

/** The tiny, first-party link of a post. */
function tinyLink(shortCode: string): string {
  return new URL(
    `/p/${encodeURIComponent(shortCode)}`,
    window.location.origin,
  ).toString();
}

/**
 * Copy the tiny link of a post.
 *
 * A card of the list does not always carry the short code. In that case
 * the detail is read only when the member asks to share, so a list of
 * twelve posts does not make twelve needless requests.
 */
export function ShareButton({ post }: ShareButtonProps) {
  const { t } = useTranslation("blog");
  const describeError = useApiError();
  const inputId = useId();
  const [manualLink, setManualLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const handleShare = async () => {
    setIsPreparing(true);
    setHasFailed(false);
    setFailureMessage(null);

    try {
      let shortCode = post.short_code;
      if (!shortCode) {
        const detail = (await blogApi.getPost(post.id)) as {
          short_code?: string;
        };
        shortCode = detail.short_code;
      }

      if (!shortCode) {
        setHasFailed(true);
        setFailureMessage(t("share.linkUnavailable"));
        return;
      }

      const link = tinyLink(shortCode);
      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error("The clipboard is not available");
        }
        await navigator.clipboard.writeText(link);
        setManualLink(null);
        setIsCopied(true);
      } catch {
        setManualLink(link);
      }
    } catch (error) {
      setHasFailed(true);
      setFailureMessage(describeError(error).message);
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="inline-flex items-center gap-2"
        onClick={() => void handleShare()}
        disabled={isPreparing}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {isPreparing
          ? t("share.preparing")
          : isCopied
            ? t("share.copied")
            : t("share.copy")}
      </Button>

      {manualLink ? (
        <div className="w-64 max-w-full space-y-1 text-start">
          <label
            htmlFor={inputId}
            className="block text-xs text-muted-foreground"
          >
            {t("share.manualLabel")}
          </label>
          <Input
            id={inputId}
            readOnly
            dir="ltr"
            value={manualLink}
            onFocus={(event) => event.currentTarget.select()}
            className="h-8 text-xs"
          />
        </div>
      ) : null}

      {hasFailed ? (
        <p role="alert" className="text-xs text-destructive">
          {failureMessage ?? t("share.failed")}
        </p>
      ) : null}
    </div>
  );
}

export default ShareButton;
