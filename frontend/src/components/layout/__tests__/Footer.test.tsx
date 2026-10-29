/**
 * The footer of the platform.
 *
 * It is rendered on every page, so its quick links must work on every
 * page: they are Links now, not anchors to the sections of the landing
 * page. The social part keeps Facebook only - the account and the group.
 */

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { Footer } from "@/components/layout/Footer";

describe("the footer", () => {
  it("makes the quick links work on every page", () => {
    renderPage(<Footer />, { route: "/notifications" });

    expect(screen.getByRole("link", { name: "الرئيسية" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "من نحن" })).toHaveAttribute(
      "href",
      "/about-us",
    );
    expect(screen.getByRole("link", { name: "الخدمات" })).toHaveAttribute(
      "href",
      "/#ministries",
    );
    expect(screen.getByRole("link", { name: "الفعاليات" })).toHaveAttribute(
      "href",
      "/#events",
    );
    expect(screen.getByRole("link", { name: "تواصل معنا" })).toHaveAttribute(
      "href",
      "/about-us",
    );
  });

  it("has no link to the gallery any more", () => {
    renderPage(<Footer />);

    expect(
      screen.queryByRole("link", { name: /معرض الصور/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps Facebook only in the social part", () => {
    renderPage(<Footer />);

    const social = screen.getAllByRole("link", { name: /فيسبوك/ });
    expect(social).toHaveLength(2);
    for (const link of social) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
    expect(
      screen.queryByRole("link", { name: /إنستغرام|إنستجرام/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /يوتيوب|YouTube/i }),
    ).not.toBeInTheDocument();
  });
});
