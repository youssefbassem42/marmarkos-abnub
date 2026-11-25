import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { BlogListPage } from "@/modules/blog/pages/blog/BlogListPage";
import { BlogPostPage } from "@/modules/blog/pages/blog/BlogPostPage";

const POST = {
  id: "post-1",
  title: "عنوان المنشور",
  excerpt: "ملخص المنشور",
  cover_image: "https://example.com/cover.jpg",
  tags: [{ id: "tag-1", name: "خدمة", slug: "khdma-1" }],
  likes_count: 4,
  comments_count: 2,
  status: "PUBLISHED",
  published_at: "2026-10-29T10:00:00Z",
  author: { id: "author-1", full_name: "كاتب المنشور" },
};

const PAGE = {
  items: [POST],
  total: 1,
  page: 1,
  size: 12,
  pages: 1,
  has_next: false,
};

const DETAIL = {
  ...POST,
  body: "<p>نص المنشور الآمن</p>",
  short_code: "a1b2c3d4",
};

describe("the public list of the blog", () => {
  it("shows the published post as a card", async () => {
    renderPage(<BlogListPage />, {
      route: "/blog?view=cards",
      answers: { "/blog/posts": PAGE },
    });

    expect(await screen.findByText("عنوان المنشور")).toBeInTheDocument();
    expect(screen.getByText("ملخص المنشور")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "صورة غلاف منشور عنوان المنشور" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "عنوان المنشور" })).toHaveAttribute(
      "href",
      "/blog/post-1",
    );
    expect(screen.getByRole("link", { name: "خدمة" })).toHaveAttribute(
      "href",
      "/blog?view=cards&tag=khdma-1",
    );
    expect(screen.getByRole("link", { name: "4 إعجاب" })).toHaveAttribute(
      "href",
      "/blog/post-1",
    );
    expect(screen.getByRole("link", { name: "2 تعليق" })).toHaveAttribute(
      "href",
      "/blog/post-1",
    );
    expect(
      screen.getByRole("button", { name: "نسخ الرابط" }),
    ).toBeInTheDocument();
  });

  it("searches by title and filters by tag through the URL", async () => {
    const user = userEvent.setup();
    const harness = renderPage(<BlogListPage />, {
      route: "/blog",
      answers: { "/blog/posts": PAGE },
    });

    await screen.findByText("عنوان المنشور");
    await user.type(screen.getByLabelText("ابحث في عنوان المنشور"), "عنوان");
    await user.type(screen.getByLabelText("وسم المنشور"), "خدمة");
    await user.click(screen.getByRole("button", { name: "تطبيق" }));

    await waitFor(() =>
      expect(
        harness.calls.some((call) => {
          const params = call.params as { q?: string; tag?: string };
          return params.q === "عنوان" && params.tag === "خدمة";
        }),
      ).toBe(true),
    );
  });

  it("switches between the card and list views", async () => {
    const user = userEvent.setup();
    renderPage(<BlogListPage />, {
      route: "/blog",
      answers: { "/blog/posts": PAGE },
    });

    await screen.findByText("عنوان المنشور");
    const listButton = screen.getByRole("button", { name: "قائمة" });
    await user.click(listButton);

    await waitFor(() =>
      expect(listButton).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      await screen.findByRole("link", { name: "4 إعجاب" }),
    ).toHaveAttribute("href", "/blog/post-1");
    expect(
      await screen.findByRole("link", { name: "2 تعليق" }),
    ).toHaveAttribute("href", "/blog/post-1");
  });

  it("leaves a zero count out of the card and the list row", async () => {
    renderPage(<BlogListPage />, {
      route: "/blog",
      answers: {
        "/blog/posts": {
          ...PAGE,
          items: [{ ...POST, likes_count: 0, comments_count: 0 }],
        },
      },
    });

    expect(await screen.findByText("عنوان المنشور")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /إعجاب|تعليق/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the card and the list row complete when details are absent", async () => {
    const user = userEvent.setup();
    renderPage(<BlogListPage />, {
      route: "/blog",
      answers: {
        "/blog/posts": {
          ...PAGE,
          items: [
            {
              ...POST,
              excerpt: null,
              cover_image: null,
              published_at: null,
              likes_count: 0,
              comments_count: 2,
            },
          ],
        },
      },
    });

    expect(await screen.findByText("عنوان المنشور")).toBeInTheDocument();
    expect(screen.getByText("لا توجد صورة غلاف")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2 تعليق" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /إعجاب/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "قائمة" }));
    expect(
      await screen.findByRole("link", { name: "2 تعليق" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /إعجاب/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when no post matches", async () => {
    renderPage(<BlogListPage />, {
      route: "/blog?tag=غير-موجود",
      answers: {
        "/blog/posts": { ...PAGE, items: [], total: 0 },
      },
    });

    expect(
      await screen.findByText("لا توجد منشورات تطابق البحث أو الوسم المختار"),
    ).toBeInTheDocument();
  });

  it("shows the error state when the posts cannot be loaded", async () => {
    renderPage(<BlogListPage />, {
      route: "/blog",
      answers: { "/blog/posts": { status: 500 } },
    });

    expect(
      await screen.findByRole("button", { name: /حاول مرة تاني/ }),
    ).toBeInTheDocument();
  });
});

describe("the public page of a blog post", () => {
  it("shows the server-sanitised body and the way back", async () => {
    renderPage(<BlogPostPage />, {
      route: "/blog/post-1",
      path: "/blog/:slug",
      answers: { "/blog/posts/post-1": DETAIL },
    });

    expect(await screen.findByText("نص المنشور الآمن")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "عنوان المنشور" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/كاتب المنشور/).length).toBeGreaterThan(0);

    const back = screen.getByRole("link", { name: "العودة إلى المدونة" });
    expect(back).toHaveAttribute("href", "/blog");
    expect(
      screen.getByRole("button", { name: "نسخ الرابط" }),
    ).toBeInTheDocument();
  });

  it("shows a retry state when the post cannot be loaded", async () => {
    renderPage(<BlogPostPage />, {
      route: "/blog/post-1",
      path: "/blog/:slug",
      answers: { "/blog/posts/post-1": { status: 404 } },
    });

    expect(
      await screen.findByRole("button", { name: /حاول مرة تاني/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("المنشور غير موجود")).toBeInTheDocument();
  });
});
