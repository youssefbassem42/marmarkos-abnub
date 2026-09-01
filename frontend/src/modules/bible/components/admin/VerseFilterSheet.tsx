import { useTranslation } from "react-i18next";
import { ListFilter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface VerseFilterSheetProps {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  onPatch: (updates: Record<string, string | undefined>) => void;
}

export function VerseFilterSheet({
  q,
  dateFrom,
  dateTo,
  onPatch,
}: VerseFilterSheetProps) {
  const { t } = useTranslation("bible");

  const hasFilters = Boolean(q || dateFrom || dateTo);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ListFilter className="h-4 w-4" aria-hidden="true" />
          {t("admin.filters.all")}
          {hasFilters && (
            <span className="ms-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>{t("admin.filters.status")}</SheetTitle>
          <SheetDescription>{t("admin.filters.search")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <Input
              placeholder={t("admin.filters.search")}
              value={q ?? ""}
              onChange={(e) =>
                onPatch({ q: e.target.value || undefined, page: undefined })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("admin.dateFrom")}
              </label>
              <Input
                type="date"
                value={dateFrom ?? ""}
                onChange={(e) =>
                  onPatch({
                    date_from: e.target.value || undefined,
                    page: undefined,
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("admin.dateTo")}
              </label>
              <Input
                type="date"
                value={dateTo ?? ""}
                onChange={(e) =>
                  onPatch({
                    date_to: e.target.value || undefined,
                    page: undefined,
                  })
                }
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onPatch({
                  q: undefined,
                  date_from: undefined,
                  date_to: undefined,
                  page: undefined,
                })
              }
              className="gap-1"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t("admin.clearFilters")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
