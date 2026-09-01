import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface VersePreviewProps {
  title: string;
  subtitle: string;
  verseReference: string;
  text: string;
  reflection: string;
  image: string | null;
}

type ViewMode = "mobile" | "desktop";

export function VersePreview({
  title,
  subtitle,
  verseReference,
  text,
  reflection,
  image,
}: VersePreviewProps) {
  const { t } = useTranslation("bible");
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">
          {t("admin.form.preview.title")}
        </CardTitle>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={viewMode === "desktop" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("desktop")}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "mobile" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("mobile")}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-lg border bg-card",
            viewMode === "mobile" ? "max-w-[320px]" : "max-w-full",
          )}
        >
          {image && (
            <img
              src={image}
              alt={title}
              className="w-full h-48 object-cover"
            />
          )}
          <div className="p-4 space-y-3">
            <div>
              <h3 className="text-lg font-semibold">{title || "—"}</h3>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
              <p className="text-xs text-primary mt-1 font-medium">
                {verseReference || "—"}
              </p>
            </div>
            <Separator />
            <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap">
              {text || "—"}
            </div>
            {reflection && (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground italic whitespace-pre-wrap">
                  {reflection}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
