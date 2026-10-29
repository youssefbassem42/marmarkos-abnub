import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserRouter, Link, Routes, Route } from "react-router-dom";

import { FocusAfterNavigation } from "@/router";

function renderApp() {
  return render(
    <BrowserRouter>
      <FocusAfterNavigation />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <nav>
                <Link to="/about">عن المنصة</Link>
              </nav>
              <h1>الرئيسية</h1>
            </>
          }
        />
        <Route
          path="/about"
          element={
            <>
              <main>عن المنصة</main>
              <p>
                <Link to="/">الرئيسية</Link>
              </p>
            </>
          }
        />
      </Routes>
    </BrowserRouter>,
  );
}

describe("the focus after a navigation", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("moves the focus to the h1 of the first page", async () => {
    const focused: Element[] = [];
    const original = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      focused.push(this);
      original.call(this, options);
    });

    renderApp();

    await waitFor(() => expect(focused).toHaveLength(1));
    expect(focused.at(-1)).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("moves the focus to the main region when the page has no h1", async () => {
    const focused: Element[] = [];
    const original = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      focused.push(this);
      original.call(this, options);
    });

    renderApp();

    fireEvent.click(screen.getByRole("link", { name: "عن المنصة" }));

    await screen.findByText("عن المنصة");

    await waitFor(() => expect(focused).toHaveLength(2));
    expect(focused.at(-1)).toBe(screen.getByText("عن المنصة"));
  });

  it("moves the focus back to the h1 when the member returns", async () => {
    const focused: Element[] = [];
    const original = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      focused.push(this);
      original.call(this, options);
    });

    renderApp();

    // The page may open on `/about` if a previous test left the address
    // there: go back to the landing page first.
    if (!screen.queryByRole("heading", { level: 1 })) {
      fireEvent.click(screen.getByRole("link", { name: "الرئيسية" }));
      await screen.findByRole("heading", { level: 1 });
    }

    fireEvent.click(screen.getByRole("link", { name: "عن المنصة" }));
    await screen.findByText("عن المنصة");

    fireEvent.click(screen.getByRole("link", { name: "الرئيسية" }));
    await waitFor(
      () =>
        expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
      { timeout: 5_000 },
    );

    await waitFor(() => expect(focused.length).toBeGreaterThanOrEqual(3));
    expect(focused.at(-1)).toBe(screen.getByRole("heading", { level: 1 }));
  });
});
