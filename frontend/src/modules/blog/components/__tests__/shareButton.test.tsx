import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ShareButton } from "@/modules/blog/components/ShareButton";
import { renderPage } from "@/test/pageHarness";

const ORIGINAL_CLIPBOARD = navigator.clipboard;

const DETAIL = {
  id: "post-1",
  title: "عنوان المنشور",
  excerpt: "ملخص المنشور",
  body: "<p>نص المنشور</p>",
  cover_image: null,
  tags: [],
  published_at: "2026-10-29T10:00:00Z",
  author: { id: "author-1", full_name: "كاتب المنشور" },
  status: "PUBLISHED",
  likes_count: 1,
  comments_count: 0,
  short_code: "a1b2c3d4",
};

function setClipboard(value: Pick<Clipboard, "writeText"> | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setClipboard(ORIGINAL_CLIPBOARD);
});

describe("the share button of a blog post", () => {
  it("copies the tiny link and tells the member that it was copied", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    renderPage(<ShareButton post={{ id: "post-1", short_code: "a1b2c3d4" }} />);

    await user.click(screen.getByRole("button", { name: "نسخ الرابط" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/p/a1b2c3d4`,
      );
    });
    expect(
      screen.getByRole("button", { name: "تم نسخ الرابط" }),
    ).toBeInTheDocument();
  });

  it("shows the tiny link in a box when the clipboard refuses it", async () => {
    const user = userEvent.setup();
    setClipboard({
      writeText: vi.fn().mockRejectedValue(new Error("refused")),
    });

    renderPage(<ShareButton post={{ id: "post-1", short_code: "a1b2c3d4" }} />);

    await user.click(screen.getByRole("button", { name: "نسخ الرابط" }));

    const box = await screen.findByLabelText("انسخ الرابط يدويًا");
    expect(box).toHaveValue(`${window.location.origin}/p/a1b2c3d4`);
    expect(
      screen.queryByRole("button", { name: "تم نسخ الرابط" }),
    ).not.toBeInTheDocument();
  });

  it("shows the tiny link when the browser has no clipboard", async () => {
    const user = userEvent.setup();
    setClipboard(undefined);

    renderPage(<ShareButton post={{ id: "post-1", short_code: "a1b2c3d4" }} />);

    await user.click(screen.getByRole("button", { name: "نسخ الرابط" }));

    expect(await screen.findByLabelText("انسخ الرابط يدويًا")).toHaveValue(
      `${window.location.origin}/p/a1b2c3d4`,
    );
  });

  it("reads the short code of a card only when the member shares it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const harness = renderPage(<ShareButton post={{ id: "post-1" }} />, {
      answers: { "/blog/posts/post-1": DETAIL },
    });

    expect(harness.calls).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "نسخ الرابط" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/p/a1b2c3d4`,
      );
    });
    expect(
      harness.calls.some(
        (call) =>
          call.method === "get" && call.url.includes("/blog/posts/post-1"),
      ),
    ).toBe(true);
  });

  it("warns the member when the post has no short code", async () => {
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

    renderPage(<ShareButton post={{ id: "post-1" }} />, {
      // The platform answers with a post that carries no tiny link (an
      // empty code): the member gets the sentence that says exactly
      // that, not a generic failure.
      answers: { "/blog/posts/post-1": { ...DETAIL, short_code: "" } },
    });

    await user.click(screen.getByRole("button", { name: "نسخ الرابط" }));

    // The post has no tiny link: the member gets a sentence that says
    // exactly that, not a generic failure.
    expect(
      await screen.findByText(
        "لا يوجد رابط مشاركة لهذا المنشور. حدّث الصفحة وحاول مرة أخرى.",
      ),
    ).toBeInTheDocument();
  });
});
