import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BlogPostFormPage } from "@/modules/blog/pages/admin/BlogPostFormPage";
import { renderPage } from "@/test/pageHarness";

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
  it("shows the empty form of a new post", async () => {
    renderPage(<BlogPostFormPage />, { admin: true });

    expect(await screen.findByLabelText("عنوان المنشور")).toHaveValue("");
    expect(screen.getByLabelText("مقتطف المنشور")).toHaveValue("");
    expect(screen.getByLabelText("الوسوم")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /^\s*حفظ\s*$/ }),
    ).toBeInTheDocument();
  });

  it("fills the form with the post of the administration", async () => {
    renderPage(<BlogPostFormPage />, {
      admin: true,
      route: "/admin/blog/posts/22222222-2222-4222-8222-222222222222/edit",
      path: "/admin/blog/posts/:postId/edit",
      answers: {
        "/admin/blog/posts/22222222-2222-4222-8222-222222222222": A_POST,
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
    const calls = renderPage(<BlogPostFormPage />, { admin: true });

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

  it("creates a post with what the administrator wrote", async () => {
    const user = userEvent.setup();
    const calls = renderPage(<BlogPostFormPage />, {
      admin: true,
      answers: { "POST /admin/blog/posts": A_POST },
    });

    await user.type(
      await screen.findByLabelText("عنوان المنشور"),
      "عنوان جديد",
    );
    await user.click(screen.getByRole("button", { name: /^\s*حفظ\s*$/ }));

    await waitFor(() => {
      expect(calls.calls.some((call) => call.method === "post")).toBe(true);
    });
    const call = calls.calls.find((entry) => entry.method === "post");
    const body = JSON.parse(String(call?.data ?? "{}"));
    expect(body.title).toBe("عنوان جديد");
    expect(body.tags).toEqual([]);
  });
});
