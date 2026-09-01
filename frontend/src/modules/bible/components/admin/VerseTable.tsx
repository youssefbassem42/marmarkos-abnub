import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/datetime";
import { VerseRowActions } from "./VerseRowActions";
import type { VerseAdminItem } from "../../types";

interface VerseTableProps {
  items: VerseAdminItem[];
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PUBLISHED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ARCHIVED: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function VerseTable({ items }: VerseTableProps) {
  const { t, i18n } = useTranslation("bible");
  const locale = i18n.language;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.table.colTitle")}</TableHead>
          <TableHead>{t("admin.table.colStatus")}</TableHead>
          <TableHead>{t("admin.table.colDate")}</TableHead>
          <TableHead className="text-center">{t("admin.colOpens")}</TableHead>
          <TableHead>{t("admin.colQuiz")}</TableHead>
          <TableHead className="text-end">{t("admin.table.colActions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((verse) => (
          <TableRow key={verse.id}>
            <TableCell>
              <Link
                to={`/admin/bible-verses/${verse.id}/edit`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {verse.title}
              </Link>
              {verse.subtitle && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {verse.subtitle}
                </p>
              )}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={STATUS_BADGE_CLASS[verse.status] ?? ""}
              >
                {t(`admin.statuses.${verse.status}`)}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatRelativeDate(verse.created_at, locale)}
            </TableCell>
            <TableCell className="text-center tabular-nums">
              {verse.status === "PUBLISHED" ? "—" : "—"}
            </TableCell>
            <TableCell>
              {verse.status === "PUBLISHED" || verse.status === "SCHEDULED" ? (
                <Link
                  to={`/admin/bible-verses/${verse.id}/quiz`}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {t("admin.addQuiz")}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-end">
              <VerseRowActions verse={verse} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
