/**
 * The page "من نحن" (About Us).
 *
 * It replaced the placeholder at /about-us: the logo of the platform, the
 * text of the page (mission, meeting, audience, contact, verse of the day)
 * and the shell of the landing page - the navbar and the footer.
 */

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { AboutUsPage } from "@/pages/about/AboutUsPage";

describe("the page 'من نحن'", () => {
  it("renders the logo, the title and the sections of the page", () => {
    renderPage(<AboutUsPage />);

    expect(
      screen.getAllByAltText(/شعار إجتماع الشباب بأبنوب/),
    ).not.toHaveLength(0);
    expect(screen.getByRole("heading", { name: "من نحن" })).toBeInTheDocument();
    expect(screen.getByText(/رسالتنا/)).toBeInTheDocument();
    expect(screen.getByText(/الاجتماع/)).toBeInTheDocument();
    expect(screen.getByText(/الجميع مرحب بهم/)).toBeInTheDocument();
    expect(
      screen.getByText(/إجتماع الشباب بأبنوب — أبنوب، أسيوط، مصر/),
    ).toBeInTheDocument();
    expect(screen.getByText(/آية اليوم/)).toBeInTheDocument();
  });

  it("shows the blocks that fade in", () => {
    // Without the observer of the landing page the .reveal blocks stay at
    // opacity 0 and the page reads as empty in the browser.
    const { result } = renderPage(<AboutUsPage />);

    const revealed = result.container.querySelectorAll(".reveal.is-visible");
    expect(revealed.length).toBeGreaterThan(0);
  });

  it("has one h1", () => {
    renderPage(<AboutUsPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("links to the verse of the day", () => {
    renderPage(<AboutUsPage />);

    expect(
      screen.getByRole("link", { name: /أقسام الكتاب المقدس/ }),
    ).toHaveAttribute("href", "/bible-verses");
  });
});
