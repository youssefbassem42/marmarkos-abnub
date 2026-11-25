import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BlogPostFormPage } from "@/modules/blog/pages/blog/BlogPostFormPage";
import { renderPage } from "@/test/pageHarness";

Object.defineProperty(HTMLElement.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
});

const A_POST = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "موضوع في الإيمان",
  excerpt: "مقتطف الموضوع",
  body: "<p>نص الموضوع</p>",
  cover_image: null,
  tags: [{ id: "1", name: "إيمان", slug: "eman" }],
  likes_count: 0,
  comments_count: 0,
  status: "DRAFT",
  short_code: "abc123",
  published_at: null,
  author: { id: "3", full_name: "محمود" },
  author_id: "3",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

describe("the form of a post of the blog", () => {
  it("shows the empty form on the new-post route", async () => {
    renderPage(<BlogPostFormPage />, {
      route: "/blog/new",
      path: "/blog/new",
    });

    expect(await screen.findByLabelText("عنوان المنشور")).toHaveValue("");
    expect(screen.getByLabelText("مقتطف المنشور")).toHaveValue("");
    expect(screen.getByLabelText("الوسوم")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /^\s*حفظ\s*$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "العودة إلى المدونة" }),
    ).toHaveAttribute("href", "/blog");
  });

  it("fills the form from the blog detail route", async () => {
    renderPage(<BlogPostFormPage />, {
      route: "/blog/22222222-2222-4222-8222-222222222222/edit",
      path: "/blog/:postId/edit",
      answers: {
        "/blog/posts/22222222-2222-4222-8222-222222222222": A_POST,
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText("عنوان المنشور")).toHaveValue(
        "موضوع في الإيمان",
      );
    });
    expect(screen.getByLabelText("الوسوم")).toHaveValue("إيمان");
  });

  it("refuses to save a post without a title", async () => {
    const user = userEvent.setup();
    const calls = renderPage(<BlogPostFormPage />, {
      route: "/blog/new",
      path: "/blog/new",
    });

    await user.click(
      await screen.findByRole("button", { name: /^\s*حفظ\s*$/ }),
    );

    expect(
      await screen.findByText("العنوان والنص مطلوبان"),
    ).toBeInTheDocument();
    expect(calls.calls.filter((call) => call.method === "post")).toHaveLength(
      0,
    );
  });

  it("creates a post through the blog route", async () => {
    const user = userEvent.setup();
    const calls = renderPage(<BlogPostFormPage />, {
      route: "/blog/new",
      path: "/blog/new",
      answers: { "POST /blog/posts": A_POST },
    });

    await user.type(
      await screen.findByLabelText("عنوان المنشور"),
      "عنوان جديد",
    );
    const editor = document.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();
    editor!.focus();
    await user.keyboard("نص جديد");
    await user.click(screen.getByRole("button", { name: /^\s*حفظ\s*$/ }));

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) => call.method === "post" && call.url === "/blog/posts",
        ),
      ).toBe(true);
    });
    const call = calls.calls.find(
      (entry) => entry.method === "post" && entry.url === "/blog/posts",
    );
    const body = JSON.parse(String(call?.data ?? "{}"));
    expect(body.title).toBe("عنوان جديد");
    expect(body.tags).toEqual([]);
  });
});
