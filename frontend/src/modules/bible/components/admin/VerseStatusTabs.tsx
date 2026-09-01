import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useVerseStats } from "../../hooks";
import type { VerseStatus } from "../../types";

type StatusKey = "all" | VerseStatus;

interface VerseStatusTabsProps {
  value?: string;
  onChange: (status: string | undefined) => void;
}

const STATUS_ORDER: StatusKey[] = [
  "all",
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
];

export function VerseStatusTabs({ value, onChange }: VerseStatusTabsProps) {
  const { t } = useTranslation("bible");
  const { data: stats } = useVerseStats();

  const counts: Record<StatusKey, number> = {
    all: stats?.total ?? 0,
    DRAFT: stats?.drafts ?? 0,
    SCHEDULED: stats?.scheduled ?? 0,
    PUBLISHED: stats?.published ?? 0,
    ARCHIVED: stats?.archived ?? 0,
  };

  return (
    <Tabs
      value={value ?? "all"}
      onValueChange={(v) => onChange(v === "all" ? undefined : v)}
    >
      <TabsList className="w-full justify-start overflow-x-auto">
        {STATUS_ORDER.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className="gap-1.5"
          >
            {t(`admin.statuses.${key}`)}
            <Badge
              variant="secondary"
              className={cn(
                "ml-1 h-5 min-w-5 px-1 text-xs tabular-nums",
                value === key || (key === "all" && !value)
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {counts[key]}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
