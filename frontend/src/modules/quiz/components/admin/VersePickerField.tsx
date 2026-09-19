import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminVerses } from "@/modules/bible/hooks/useAdminVerses";
import { useVerse } from "@/modules/bible/hooks/useVerse";
import type { VerseStatus } from "@/modules/bible/types";

interface VersePickerFieldProps {
  value?: string;
  onValueChange?: (verseId: string) => void;
  disabled?: boolean;
}

const STATUS_STYLES: Record<VerseStatus, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  SCHEDULED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  DRAFT: "bg-muted text-muted-foreground",
  ARCHIVED: "bg-muted text-muted-foreground line-through",
};

/** Searchable bible-verse picker used when attaching a quiz to a verse. */
export function VersePickerField({
  value,
  onValueChange,
  disabled,
}: VersePickerFieldProps) {
  const { t } = useTranslation("bible");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const versesQuery = useAdminVerses({ q: search || undefined, page: 1, size: 50 });
  const verses = useMemo(() => versesQuery.data?.items ?? [], [versesQuery.data]);

  const selectedVerse = useMemo(() => {
    if (!value) return undefined;
    return verses.find((verse) => verse.id === value);
  }, [value, verses]);

  const selectedFallback = useVerse(value ?? "", {
    enabled: !!value && !selectedVerse,
  });

  const statusLabels: Record<VerseStatus, string> = {
    PUBLISHED: t("admin.versePicker.status.published"),
    SCHEDULED: t("admin.versePicker.status.scheduled"),
    DRAFT: t("admin.versePicker.status.draft"),
    ARCHIVED: t("admin.versePicker.status.archived"),
  };
  const label = useMemo(() => {
    if (selectedVerse) {
      return `${selectedVerse.verse_reference} — ${selectedVerse.title}`;
    }
    const fallback = selectedFallback.data;
    if (value && fallback) {
      return `${fallback.verse_reference} — ${fallback.title}`;
    }
    return "";
  }, [selectedVerse, selectedFallback.data, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-11 w-full justify-between rounded-xl border-border font-arabic"
        >
          <span className={cn("truncate", !label && "text-muted-foreground")}>
            {label || t("admin.versePicker.placeholder")}
          </span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("admin.versePicker.search")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64 overflow-y-auto themed-scrollbar">
            {versesQuery.isPending && (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            )}
            {!versesQuery.isPending && !verses.length && (
              <CommandEmpty className="py-6 text-center">
                <SearchX className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <span className="font-arabic text-sm text-muted-foreground">
                  {t("admin.versePicker.empty")}
                </span>
              </CommandEmpty>
            )}
            {!versesQuery.isPending && verses.length > 0 && (
              <CommandGroup>
                {verses.map((verse) => (
                  <CommandItem
                    key={verse.id}
                    value={verse.id}
                    onSelect={(currentValue) => {
                      onValueChange?.(currentValue);
                      setOpen(false);
                    }}
                    className="font-arabic"
                  >
                    <Check
                      className={cn(
                        "me-2 h-4 w-4",
                        value === verse.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        {verse.verse_reference} — {verse.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {verse.book} · {verse.chapter}:{verse.verse_start}
                        {verse.verse_end ? `-${verse.verse_end}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "ms-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        STATUS_STYLES[verse.status],
                      )}
                    >
                      {statusLabels[verse.status]}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}