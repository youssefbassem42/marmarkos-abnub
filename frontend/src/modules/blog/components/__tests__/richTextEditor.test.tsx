import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { RichTextEditor } from "../RichTextEditor";

// ProseMirror asks the browser where the caret is when a click reaches the
// editor. JSDOM has no layout engine, so the test supplies the minimum
// geometric answer that the editor needs.
Object.defineProperty(document, "elementFromPoint", {
  configurable: true,
  value: () => document.body,
});
Object.defineProperty(document, "caretRangeFromPoint", {
  configurable: true,
  value: () => null,
});

describe("the shared rich-text editor", () => {
  it("writes the formatted HTML when the writer types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderPage(
      <RichTextEditor value="" onChange={onChange} aria-label="نص المنشور" />,
    );

    const toolbar = await screen.findByRole("group", { name: "نص المنشور" });
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "عريض" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "قائمة نقطية" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "رمز تعبيري" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "عريض" }));
    const editable = document.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editable).not.toBeNull();
    editable!.focus();
    await user.keyboard("نص مميز");

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const html = onChange.mock.calls.at(-1)?.[0] as string;
    expect(html).toContain("<strong>نص مميز</strong>");
  });

  it("shows the HTML that the server sent", async () => {
    renderPage(
      <RichTextEditor value="<p>نص المنشور المحفوظ</p>" onChange={vi.fn()} />,
    );

    expect(await screen.findByText("نص المنشور المحفوظ")).toBeInTheDocument();
  });
});
