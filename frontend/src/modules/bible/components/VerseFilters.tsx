import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ReadFilter = "all" | "true" | "false";
type QuizFilter = "all" | "true";

interface VerseFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  read: ReadFilter;
  onReadChange: (value: ReadFilter) => void;
  hasQuiz: QuizFilter;
  onHasQuizChange: (value: QuizFilter) => void;
}

export function VerseFilters({
  search,
  onSearchChange,
  read,
  onReadChange,
  hasQuiz,
  onHasQuizChange,
}: VerseFiltersProps) {
  const { t } = useTranslation("bible");

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center font-arabic"
    >
      <div className="relative flex-1">
        <Search
          className="absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("list.search")}
          className="ps-9"
        />
      </div>

      <Select value={read} onValueChange={(v) => onReadChange(v as ReadFilter)}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder={t("list.filter")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("list.filterAll")}</SelectItem>
          <SelectItem value="true">{t("list.filterRead")}</SelectItem>
          <SelectItem value="false">{t("list.filterUnread")}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={hasQuiz}
        onValueChange={(v) => onHasQuizChange(v as QuizFilter)}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder={t("list.quizBadge")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("list.filterAll")}</SelectItem>
          <SelectItem value="true">{t("list.filterHasQuiz")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
