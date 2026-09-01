import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Pencil, Calendar, Brain, BarChart3, Archive } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useArchiveVerse } from "../../hooks";
import type { VerseAdminItem } from "../../types";

interface VerseRowActionsProps {
  verse: VerseAdminItem;
}

export function VerseRowActions({ verse }: VerseRowActionsProps) {
  const { t } = useTranslation("bible");
  const navigate = useNavigate();
  const archiveVerse = useArchiveVerse();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const handleArchive = useCallback(() => {
    archiveVerse.mutate(verse.id, {
      onSuccess: () => {
        toast.success(t("admin.archived"));
        setArchiveOpen(false);
      },
      onError: () => {
        toast.error(t("admin.archiveFailed"));
      },
    });
  }, [archiveVerse, verse.id, t]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t("admin.table.colActions")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={() => navigate(`/admin/bible-verses/${verse.id}/edit`)}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {t("admin.actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={() => navigate(`/admin/bible-verses/${verse.id}/schedule`)}
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            {t("admin.actions.schedule")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={() => navigate(`/admin/bible-verses/${verse.id}/quiz`)}
          >
            <Brain className="h-4 w-4" aria-hidden="true" />
            {t("admin.actions.quiz")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={() => navigate(`/admin/bible-verses/${verse.id}/analytics`)}
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            {t("admin.actions.analytics")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            {t("admin.actions.archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.archiveConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.archiveConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveVerse.isPending}>
              {t("admin.archiveConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={archiveVerse.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.archiveConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
