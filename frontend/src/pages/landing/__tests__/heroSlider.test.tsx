/**
 * The slider of the landing page: the slides of the server, the dots and
 * the fallback when the server has no slide.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderPage } from "@/test/pageHarness";
import { mediaApi } from "@/modules/media/api";
import { Hero } from "../sections/Hero";

vi.mock("@/modules/media/api", () => ({
  mediaApi: {
    getAdminSlides: vi.fn(),
    getPublicSlides: vi.fn(),
    createSlide: vi.fn(),
    updateSlide: vi.fn(),
    deleteSlide: vi.fn(),
    reorderSlides: vi.fn(),
  },
}));

const SLIDES = [
  {
    id: "s1",
    image: "https://example.com/s1.jpg",
    title: "الشريحة الأولى",
    subtitle: null,
    order: 1,
  },
  {
    id: "s2",
    image: "https://example.com/s2.jpg",
    title: "الشريحة الثانية",
    subtitle: null,
    order: 2,
  },
];

function renderHero(
  overrides: {
    slides?: typeof SLIDES;
    error?: boolean;
  } = {},
) {
  const { slides = SLIDES, error = false } = overrides;
  const mocked = vi.mocked(mediaApi.getPublicSlides);
  if (error) mocked.mockRejectedValue(new Error("boom"));
  else
    mocked.mockResolvedValue({
      items: slides,
      total: slides.length,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    });
  return renderPage(<Hero />, { answers: {} });
}

describe("the slider of the landing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the slides of the server instead of the static image", async () => {
    renderHero();

    await waitFor(() =>
      expect(screen.getAllByAltText("الشريحة الأولى").length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.getAllByAltText("الشريحة الثانية")).toHaveLength(1);
    // The static image is gone.
    expect(
      screen.queryByAltText("شباب يعبدون بأيدي مرفوعة"),
    ).not.toBeInTheDocument();
  });

  it("renders one dot per slide with an accessible name", async () => {
    renderHero();

    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
    expect(
      screen.getByRole("tab", { name: "الشريحة 1 من 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "الشريحة 2 من 2" }),
    ).toBeInTheDocument();
  });

  it("keeps the static image when the server has no slide", async () => {
    renderHero({ slides: [] });

    await waitFor(() =>
      expect(
        screen.getByAltText(/شباب يعبدون بأيدي مرفوعة/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("keeps the static image when the server fails", async () => {
    renderHero({ error: true });

    await waitFor(() =>
      expect(
        screen.getByAltText(/شباب يعبدون بأيدي مرفوعة/),
      ).toBeInTheDocument(),
    );
  });
});
