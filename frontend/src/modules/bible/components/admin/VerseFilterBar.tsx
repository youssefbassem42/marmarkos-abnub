import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VerseFilterBarProps {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  onPatch: (updates: Record<string, string | undefined>) => void;
  className?: string;
}

export function VerseFilterBar({
  q,
  dateFrom,
  dateTo,
  onPatch,
  className,
}: VerseFilterBarProps) {
  const { t } = useTranslation("bible");

  const hasFilters = Boolean(q || dateFrom || dateTo);

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder={t("admin.filters.search")}
          value={q ?? ""}
          onChange={(e) => onPatch({ q: e.target.value || undefined, page: undefined })}
          className="ps-8"
        />
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dateFrom ?? ""}
          onChange={(e) => onPatch({ date_from: e.target.value || undefined, page: undefined })}
          className="w-[150px]"
          aria-label={t("admin.dateFrom")}
        />
        <span className="text-sm text-muted-foreground">–</span>
        <Input
          type="date"
          value={dateTo ?? ""}
          onChange={(e) => onPatch({ date_to: e.target.value || undefined, page: undefined })}
          className="w-[150px]"
          aria-label={t("admin.dateTo")}
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPatch({ q: undefined, date_from: undefined, date_to: undefined, page: undefined })}
          className="gap-1"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t("admin.clearFilters")}
        </Button>
      )}
    </div>
  );
}
