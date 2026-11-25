import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, List, Search, Tag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type BlogView = "cards" | "list";

interface BlogFiltersProps {
  search: string;
  tag: string;
  view: BlogView;
  /** The lifecycle of the posts; only the staff filters by it. */
  status?: string;
  /** The staff may filter by the state of the post. */
  canFilterByStatus?: boolean;
  onFiltersChange: (search: string, tag: string) => void;
  onViewChange: (value: BlogView) => void;
  onStatusChange?: (value: string) => void;
}

/** The title search, the tag filter, and the card/list switch. */
export function BlogFilters({
  search,
  tag,
  view,
  status = "",
  canFilterByStatus = false,
  onFiltersChange,
  onViewChange,
  onStatusChange,
}: BlogFiltersProps) {
  const { t } = useTranslation("blog");
  const [searchDraft, setSearchDraft] = useState(search);
  const [tagDraft, setTagDraft] = useState(tag);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setTagDraft(tag), [tag]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    onFiltersChange(searchDraft.trim(), tagDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft("");
    setTagDraft("");
    onFiltersChange("", "");
  };

  return (
    <section className="rounded-2xl border border-border bg-card card-elevated">
      <form
        onSubmit={applyFilters}
        className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end"
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="blog-search">{t("filters.searchLabel")}</Label>
          <div className="relative">
            <Search
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground end-3"
              aria-hidden="true"
            />
            <Input
              id="blog-search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              className="pe-9"
            />
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <Label htmlFor="blog-tag">{t("filters.tagLabel")}</Label>
          <div className="relative">
            <Tag
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground end-3"
              aria-hidden="true"
            />
            <Input
              id="blog-tag"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              placeholder={t("filters.tagPlaceholder")}
              className="pe-9"
            />
          </div>
        </div>

        {canFilterByStatus ? (
          <div className="space-y-2">
            <Label htmlFor="blog-status">{t("filters.statusLabel")}</Label>
            <select
              id="blog-status"
              value={status}
              onChange={(event) => onStatusChange?.(event.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-ink focus-ring"
            >
              <option value="">{t("filters.statusAll")}</option>
              <option value="DRAFT">{t("admin.status.draft")}</option>
              <option value="PUBLISHED">{t("admin.status.published")}</option>
              <option value="SCHEDULED">{t("admin.status.scheduled")}</option>
              <option value="ARCHIVED">{t("admin.status.archived")}</option>
            </select>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t("filters.apply")}</Button>
          {search || tag ? (
            <Button type="button" variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden="true" />
              {t("filters.clear")}
            </Button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium text-ink">
          {t("filters.viewLabel")}
        </span>
        <div
          className="inline-flex w-fit items-center rounded-xl bg-muted p-1"
          role="group"
          aria-label={t("filters.viewLabel")}
        >
          <Button
            type="button"
            variant={view === "cards" ? "secondary" : "ghost"}
            size="sm"
            className={cn(view === "cards" && "bg-card shadow-sm")}
            aria-pressed={view === "cards"}
            onClick={() => onViewChange("cards")}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            {t("filters.cardsView")}
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className={cn(view === "list" && "bg-card shadow-sm")}
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
          >
            <List className="h-4 w-4" aria-hidden="true" />
            {t("filters.listView")}
          </Button>
        </div>
      </div>
    </section>
  );
}
