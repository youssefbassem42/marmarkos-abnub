/**
 * The navbar of the platform.
 *
 * Its links are the bookmarks of the members: every one of them must
 * point to a real screen, and the gallery has no link any more.
 */

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { Navbar } from "@/components/layout/Navbar";

describe("the navbar", () => {
  it("links to the real screens of the platform", () => {
    renderPage(<Navbar variant="landing" />);

    for (const home of screen.getAllByRole("link", { name: "الرئيسية" })) {
      expect(home).toHaveAttribute("href", "/");
    }
    expect(screen.getByRole("link", { name: "من نحن" })).toHaveAttribute(
      "href",
      "/about-us",
    );
    expect(screen.getByRole("link", { name: "المدونة" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("link", { name: "رسائل مجهولة" })).toHaveAttribute(
      "href",
      "/anonymous-messages",
    );
  });

  it("has no link to the gallery any more", () => {
    renderPage(<Navbar variant="landing" />);

    expect(
      screen.queryByRole("link", { name: /معرض الصور/ }),
    ).not.toBeInTheDocument();
  });
});
