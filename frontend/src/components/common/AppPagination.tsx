import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppPaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Compact page list around the current page: 1 … c-1 c c+1 … N. */
function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }
  const window: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) window.push("…");
  for (let p = start; p <= end; p += 1) window.push(p);
  if (end < pages - 1) window.push("…");
  window.push(pages);
  return window;
}

/**
 * The design's `‹ 1 2 3 … 10 ›` pager (P4-501), wrapping the shadcn
 * pagination primitives — their first consumer. Chevron direction
 * flips with the document direction; focus stays keyboard-reachable.
 */
export function AppPagination({
  page,
  pages,
  onPageChange,
  className,
}: AppPaginationProps) {
  if (pages <= 1) return null;

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(event) => {
              event.preventDefault();
              if (page > 1) onPageChange(page - 1);
            }}
            aria-disabled={page <= 1}
            className={cn(
              "gap-1",
              page <= 1 && "pointer-events-none opacity-40",
            )}
          >
            <ChevronLeft className="h-4 w-4 rtl:hidden" aria-hidden="true" />
            <ChevronRight
              className="hidden h-4 w-4 rtl:block"
              aria-hidden="true"
            />
          </PaginationPrevious>
        </PaginationItem>

        {pageWindow(page, pages).map((entry, index) =>
          entry === "…" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink
                href="#"
                isActive={entry === page}
                onClick={(event) => {
                  event.preventDefault();
                  if (entry !== page) onPageChange(entry);
                }}
                aria-label={String(entry)}
              >
                {new Intl.NumberFormat().format(entry)}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(event) => {
              event.preventDefault();
              if (page < pages) onPageChange(page + 1);
            }}
            aria-disabled={page >= pages}
            className={cn(
              "gap-1",
              page >= pages && "pointer-events-none opacity-40",
            )}
          >
            <ChevronRight className="h-4 w-4 rtl:hidden" aria-hidden="true" />
            <ChevronLeft
              className="hidden h-4 w-4 rtl:block"
              aria-hidden="true"
            />
          </PaginationNext>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
