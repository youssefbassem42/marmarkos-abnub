import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BlogAdminListPage } from "@/modules/blog/pages/admin/BlogAdminListPage";
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

const PAGE = {
  items: [A_POST],
  total: 1,
  page: 1,
  size: 20,
  pages: 1,
  has_next: false,
};

describe("the administration of the posts of the blog", () => {
  it("lists the posts with their state and their author", async () => {
    renderPage(<BlogAdminListPage />, {
      admin: true,
      answers: { "/admin/blog/posts": PAGE },
    });

    expect(await screen.findByText("موضوع في الإيمان")).toBeInTheDocument();
    expect(screen.getByText("مسودة")).toBeInTheDocument();
    expect(screen.getByText("محمود")).toBeInTheDocument();
  });

  it("offers the way back and the link of the new post", async () => {
    renderPage(<BlogAdminListPage />, {
      admin: true,
      answers: { "/admin/blog/posts": PAGE },
    });

    const create = await screen.findByRole("link", { name: "منشور جديد" });
    expect(create).toHaveAttribute("href", "/admin/blog/posts/new");

    const back = screen.getByRole("link", { name: /رجوع/ });
    expect(back).toHaveAttribute("href", "/admin/dashboard");
  });

  it("shows the empty state when there is no post", async () => {
    renderPage(<BlogAdminListPage />, {
      admin: true,
      answers: {
        "/admin/blog/posts": {
          ...PAGE,
          items: [],
          total: 0,
        },
      },
    });

    expect(await screen.findByText("لا توجد منشورات بعد")).toBeInTheDocument();
  });

  it("publishes a post when the administrator asks for it", async () => {
    const user = userEvent.setup();
    const calls = renderPage(<BlogAdminListPage />, {
      admin: true,
      answers: {
        "/admin/blog/posts": PAGE,
        "POST /admin/blog/posts": A_POST,
      },
    });

    await user.click(await screen.findByRole("button", { name: /نشر الآن/ }));

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "post" &&
            call.url.includes(`/admin/blog/posts/${A_POST.id}/publish`),
        ),
      ).toBe(true);
    });
  });

  it("asks before archiving a post", async () => {
    const user = userEvent.setup();
    renderPage(<BlogAdminListPage />, {
      admin: true,
      answers: { "/admin/blog/posts": PAGE },
    });

    await user.click(await screen.findByRole("button", { name: /أرشفة/ }));

    expect(await screen.findByText("أرشفة المنشور")).toBeInTheDocument();
  });
});
