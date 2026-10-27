/**
 * The shared components: the statistic card, the pager and the tiles
 * of the dashboard.
 *
 * The pager decides which page numbers are shown — a wrong window
 * would hide a page the member cannot reach any more.
 */

import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { AppPagination } from "@/components/common/AppPagination";
import { StatCard } from "@/components/common/StatCard";

describe("StatCard", () => {
  it("shows the label, the value and the hint", () => {
    render(
      <StatCard icon={Activity} label="الحضور" value={42} hint="هذا الشهر" />,
    );

    expect(screen.getByText("الحضور")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("هذا الشهر")).toBeInTheDocument();
  });

  it("keeps a text value as it is", () => {
    render(<StatCard icon={Activity} label="المعدل" value="75%" />);

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("hides the hint when there is none", () => {
    render(<StatCard icon={Activity} label="الحضور" value={1} />);

    expect(screen.queryByText("هذا الشهر")).not.toBeInTheDocument();
  });
});

describe("AppPagination", () => {
  it("shows nothing when there is one page", () => {
    const { container } = render(
      <AppPagination page={1} pages={1} onPageChange={() => undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows every page when there are few", () => {
    render(<AppPagination page={2} pages={5} onPageChange={() => undefined} />);

    for (const number of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByRole("link", { name: number })).toBeInTheDocument();
    }
    expect(screen.queryByText("More pages")).not.toBeInTheDocument();
  });

  it("shortens the list when there are many pages", () => {
    render(
      <AppPagination page={5} pages={20} onPageChange={() => undefined} />,
    );

    expect(screen.getByRole("link", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "20" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "5" })).toBeInTheDocument();
    // The ellipsis replaces the hidden pages.
    expect(screen.getAllByText("More pages").length).toBeGreaterThan(0);
  });

  it("asks for the page that was clicked", () => {
    const onPageChange = vi.fn();
    render(<AppPagination page={1} pages={5} onPageChange={onPageChange} />);

    screen.getByRole("link", { name: "3" }).click();

    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
