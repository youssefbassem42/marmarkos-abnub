import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeToggle } from "@/components/layout/ThemeToggle";

/**
 * The switch of the theme: it keeps the choice of the member in the
 * browser and puts the class `dark` on the root of the document. The
 * labels are the Arabic of the platform (the strings live in `ar.ts`).
 */
describe("the switch of the theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("starts in the light mode and offers the dark one", () => {
    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: "التبديل إلى الوضع الداكن" }),
    ).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("switches to the dark mode and keeps the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(
      screen.getByRole("button", { name: "التبديل إلى الوضع الداكن" }),
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("marmarkos.theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "التبديل إلى الوضع الفاتح" }),
    ).toBeInTheDocument();
  });

  it("switches back to the light mode", async () => {
    localStorage.setItem("marmarkos.theme", "dark");
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(
      screen.getByRole("button", { name: "التبديل إلى الوضع الفاتح" }),
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("marmarkos.theme")).toBe("light");
  });

  it("reads the choice the member made before", () => {
    localStorage.setItem("marmarkos.theme", "dark");
    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: "التبديل إلى الوضع الفاتح" }),
    ).toBeInTheDocument();
  });
});
