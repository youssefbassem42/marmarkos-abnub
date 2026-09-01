import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { BookOpen } from "lucide-react";
import { useCurrentVerse } from "../hooks/useCurrentVerse";
import { useVerseFeed } from "../hooks/useVerseFeed";
import { VerseHeroCard, VerseHeroCardSkeleton } from "../components/VerseHeroCard";
import { VerseCard, VerseCardSkeleton } from "../components/VerseCard";
import { VerseFilters } from "../components/VerseFilters";

export default function BibleVersesPage() {
  const { t } = useTranslation("bible");
  const { t: tCommon } = useTranslation("common");

  const [searchParams, setSearchParams] = useSearchParams();

  const searchQuery = searchParams.get("q") ?? "";
  const readFilter = (searchParams.get("read") ?? "all") as
    | "all"
    | "true"
    | "false";
  const hasQuizFilter = (searchParams.get("has_quiz") ?? "all") as
    | "all"
    | "true";
  const page = Number(searchParams.get("page") ?? "1");

  const updateParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === "all" || (key === "read" && value === "all")) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        if (key !== "page") next.delete("page");
        return next;
      });
    },
    [setSearchParams],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateParam("q", value);
    },
    [updateParam],
  );

  const handleReadChange = useCallback(
    (value: "all" | "true" | "false") => {
      updateParam("read", value);
    },
    [updateParam],
  );

  const handleHasQuizChange = useCallback(
    (value: "all" | "true") => {
      updateParam("has_quiz", value);
    },
    [updateParam],
  );

  const handlePageChange = useCallback(
    (p: number) => {
      updateParam("page", String(p));
    },
    [updateParam],
  );

  const feedParams = useMemo(
    () => ({
      q: searchQuery || undefined,
      read: readFilter !== "all" ? readFilter : undefined,
      has_quiz: hasQuizFilter === "true" ? true : undefined,
      page,
      size: 9,
    }),
    [searchQuery, readFilter, hasQuizFilter, page],
  );

  const currentVerse = useCurrentVerse();
  const feed = useVerseFeed(feedParams);

  const showHero =
    !searchQuery && readFilter === "all" && hasQuizFilter === "all" && page === 1;

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-5 pt-28 pb-16 lg:px-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-4 gap-1 font-arabic"
        >
          <Link to="/">
            <ArrowLeft
              className="h-4 w-4 rtl:hidden"
              aria-hidden="true"
            />
            <ArrowLeft
              className="hidden h-4 w-4 rotate-180 rtl:block"
              aria-hidden="true"
            />
            {tCommon("back")}
          </Link>
        </Button>

        <header>
          <h1
            className="text-2xl font-bold text-ink md:text-3xl font-arabic"
          >
            {t("list.title")}
          </h1>
          <p
            className="mt-1 text-sm text-muted-foreground font-arabic text-base"
          >
            {t("list.subtitle")}
          </p>
        </header>

      <VerseFilters
        search={searchQuery}
        onSearchChange={handleSearchChange}
        read={readFilter}
        onReadChange={handleReadChange}
        hasQuiz={hasQuizFilter}
        onHasQuizChange={handleHasQuizChange}
      />

      {currentVerse.isError && <ErrorRetry onRetry={currentVerse.refetch} />}

      {showHero && currentVerse.isLoading && <VerseHeroCardSkeleton />}

      {showHero && currentVerse.data && (
        <VerseHeroCard verse={currentVerse.data} />
      )}

      <h2
        className="text-lg font-bold text-ink font-arabic text-xl"
      >
        {t("list.previous")}
      </h2>

      {feed.isError && <ErrorRetry onRetry={feed.refetch} />}

      {feed.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <VerseCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!feed.isLoading && feed.data && feed.data.items.length === 0 && (
        <EmptyState
          Icon={BookOpen}
          title={t("list.empty.title")}
        />
      )}

      {feed.data && feed.data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feed.data.items.map((verse) => (
            <VerseCard key={verse.id} verse={verse} />
          ))}
        </div>
      )}

      {feed.data && feed.data.pages > 1 && (
        <AppPagination
          page={feed.data.page}
          pages={feed.data.pages}
          onPageChange={handlePageChange}
        />
      )}
      </main>
    </div>
  );
}
