import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Edit, Image, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
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
import {
  useAdminSlides,
  useCreateSlide,
  useDeleteSlide,
  useReorderSlides,
  useUpdateSlide,
} from "../../hooks";
import type { LandingSlideAdminItem } from "../../types";
import { SlideForm } from "../../components/SlideForm";

interface SlideRowProps {
  slide: LandingSlideAdminItem;
  index: number;
  slides: LandingSlideAdminItem[];
  onMove: (fromIndex: number, toIndex: number) => void;
  onEdit: (slide: LandingSlideAdminItem) => void;
  onDelete: (slide: LandingSlideAdminItem) => void;
}

function SlideRow({
  slide,
  index,
  slides,
  onMove,
  onEdit,
  onDelete,
}: SlideRowProps) {
  const { t } = useTranslation("admin");
  const updateSlide = useUpdateSlide();
  const isUpdating = updateSlide.isPending;

  const handleActivate = (checked: boolean) => {
    const form = new FormData();
    form.append("active", String(checked));
    updateSlide.mutate(
      { slideId: slide.id, data: form },
      {
        onSuccess: () => {
          toast.success(
            checked
              ? t("slides.actions.activate")
              : t("slides.actions.deactivate"),
          );
        },
        onError: () => {
          toast.error(t("slides.failed"));
        },
      },
    );
  };

  return (
    <TableRow key={slide.id} data-index={String(index)}>
      <TableCell className="w-[120px]">
        <div className="flex items-center gap-3">
          {slide.image ? (
            <img
              src={slide.image}
              alt={slide.title ?? t("slides.table.colImage")}
              width={64}
              height={64}
              className="h-16 w-16 object-cover rounded-lg border"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg border border-dashed bg-muted/50 flex items-center justify-center">
              <Image
                className="h-8 w-8 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-medium text-ink truncate"
              title={slide.title ?? ""}
            >
              {slide.title ?? t("slides.table.colImage")}
            </p>
            {slide.subtitle && (
              <p
                className="text-xs text-muted-foreground truncate"
                title={slide.subtitle}
              >
                {slide.subtitle}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="w-[140px]">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index === 0 || isUpdating}
            onClick={() => onMove(index, index - 1)}
            aria-label={t("slides.actions.moveUp")}
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index === slides.length - 1 || isUpdating}
            onClick={() => onMove(index, index + 1)}
            aria-label={t("slides.actions.moveDown")}
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {index + 1}
          </span>
        </div>
      </TableCell>
      <TableCell className="w-[72px]">
        <Switch
          checked={slide.active}
          onCheckedChange={handleActivate}
          disabled={isUpdating}
          aria-label={
            slide.active
              ? t("slides.actions.deactivate")
              : t("slides.actions.activate")
          }
        />
      </TableCell>
      <TableCell className="w-[140px]">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(slide)}
            disabled={isUpdating}
          >
            <Edit className="me-1 h-4 w-4" aria-hidden="true" />
            {t("slides.actions.edit")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onDelete(slide)}
            disabled={isUpdating}
          >
            <Trash2 className="me-1 h-4 w-4" aria-hidden="true" />
            {t("slides.actions.delete")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function SlidesPage() {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");

  const [page, setPage] = useState(1);
  const size = 20;

  const query = useAdminSlides({ page, size });
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const pages = Math.max(query.data?.pages ?? 1, 1);

  const createSlide = useCreateSlide();
  const updateSlide = useUpdateSlide();
  const deleteSlide = useDeleteSlide();
  const reorderSlides = useReorderSlides();
  const isSaving =
    createSlide.isPending ||
    updateSlide.isPending ||
    deleteSlide.isPending ||
    reorderSlides.isPending;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LandingSlideAdminItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [slideToDelete, setSlideToDelete] =
    useState<LandingSlideAdminItem | null>(null);

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (slide: LandingSlideAdminItem) => {
    setEditing(slide);
    setDialogOpen(true);
  };

  const handleSave = async (values: {
    title: string;
    subtitle: string | null;
    file: File | null;
  }) => {
    const formData = new FormData();
    formData.append("title", values.title);
    if (values.subtitle) formData.append("subtitle", values.subtitle);
    if (values.file) formData.append("file", values.file);

    try {
      if (editing) {
        await updateSlide.mutateAsync({
          slideId: editing.id,
          data: formData,
        });
      } else {
        await createSlide.mutateAsync(formData);
      }
      toast.success(t("slides.saved"));
      setDialogOpen(false);
      setEditing(null);
    } catch {
      toast.error(t("slides.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!slideToDelete) return;
    try {
      await deleteSlide.mutateAsync(slideToDelete.id);
      toast.success(tCommon("delete"));
      setDeleteOpen(false);
      setSlideToDelete(null);
    } catch {
      toast.error(t("slides.failed"));
      setDeleteOpen(false);
      setSlideToDelete(null);
    }
  };

  const handleMove = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex < 0 || toIndex < 0 || toIndex >= items.length) return;
      const ordered = [...items];
      const [moved] = ordered.splice(fromIndex, 1);
      ordered.splice(toIndex, 0, moved);
      try {
        await reorderSlides.mutateAsync(ordered.map((slide) => slide.id));
        toast.success(t("slides.reordered"));
      } catch {
        toast.error(t("slides.failed"));
      }
    },
    [items, reorderSlides, t],
  );

  if (query.isPending) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
        <AdminTopbar
          title={t("slides.title")}
          subtitle={t("slides.subtitle")}
        />
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-primary/10"
            />
          ))}
        </div>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
        <AdminTopbar
          title={t("slides.title")}
          subtitle={t("slides.subtitle")}
        />
        <ErrorRetry onRetry={() => void query.refetch()} />
      </div>
    );
  }

  return (
    <div>
      <AdminTopbar title={t("slides.title")} subtitle={t("slides.subtitle")} />

      <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div />
          <Button type="button" onClick={handleCreate} disabled={isSaving}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("slides.create")}
          </Button>
        </div>

        <section className="mt-5 rounded-2xl border border-border bg-card card-elevated">
          {items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                Icon={Image}
                title={t("slides.table.empty")}
                action={
                  <Button type="button" onClick={handleCreate}>
                    {t("slides.create")}
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">
                        {t("slides.table.colImage")}
                      </TableHead>
                      <TableHead>{t("slides.table.colTitle")}</TableHead>
                      <TableHead className="w-[140px]">
                        {t("slides.table.colOrder")}
                      </TableHead>
                      <TableHead className="w-[72px]">
                        {t("slides.table.colActive")}
                      </TableHead>
                      <TableHead className="w-[140px]">
                        {t("slides.table.colActions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((slide, index) => (
                      <SlideRow
                        key={slide.id}
                        slide={slide}
                        index={index}
                        slides={items}
                        onMove={handleMove}
                        onEdit={handleEdit}
                        onDelete={(s) => {
                          setSlideToDelete(s);
                          setDeleteOpen(true);
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pages > 1 && (
                <div className="flex justify-center border-t border-border px-5 py-3">
                  <AppPagination
                    page={page}
                    pages={pages}
                    onPageChange={(next) => setPage(next)}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <SlideForm
        slide={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        isSaving={createSlide.isPending || updateSlide.isPending}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setSlideToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("slides.deleteConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("slides.deleteConfirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteSlide.isPending}
            >
              {t("slides.deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
