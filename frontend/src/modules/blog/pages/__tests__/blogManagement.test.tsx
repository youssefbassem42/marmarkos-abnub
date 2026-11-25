import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BlogListPage } from "@/modules/blog/pages/blog/BlogListPage";
import { renderPage } from "@/test/pageHarness";
import { clearAuth, updateStoredUser } from "@/lib/auth";
import type { RegisteredUser } from "@/lib/api";

const A_POST = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "موضوع في الإيمان",
  excerpt: "مقتطف الموضوع",
  cover_image: null,
  tags: [{ id: "1", name: "إيمان", slug: "eman" }],
  likes_count: 0,
  comments_count: 0,
  status: "DRAFT",
  published_at: null,
  author: { id: "3", full_name: "محمود" },
};

const PAGE = {
  items: [A_POST],
  total: 1,
  page: 1,
  size: 12,
  pages: 1,
  has_next: false,
};

function signIn(role: "ADMIN" | "SERVANT" | "MEMBER") {
  updateStoredUser({
    id: "33333333-3333-4333-8333-333333333333",
    email: `${role.toLowerCase()}@example.com`,
    phone: null,
    first_name: "محمود",
    last_name: "عبد الله",
    date_of_birth: null,
    address: null,
    avatar: null,
    role,
    status: "ACTIVE",
    public_id: "M-0001",
    created_at: "2026-01-01T00:00:00Z",
    has_password: true,
    email_verified: true,
  });
}

describe("the management of the posts from the blog", () => {
  afterEach(() => clearAuth());

  it("offers an administrator the way to write and manage a draft", async () => {
    signIn("ADMIN");

    renderPage(<BlogListPage />, {
      answers: { "/blog/posts": PAGE },
    });

    expect(await screen.findByText("موضوع في الإيمان")).toBeInTheDocument();
    // The state of the draft: the badge of the card (the filter of the
    // staff carries the same word in its list).
    expect(screen.getAllByText("مسودة").length).toBeGreaterThan(0);
    expect(screen.getByText(/محمود/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "اكتب منشورًا" })).toHaveAttribute(
      "href",
      "/blog/new",
    );
    expect(screen.getByRole("link", { name: "تعديل" })).toHaveAttribute(
      "href",
      `/blog/${A_POST.id}/edit`,
    );
  });

  it("offers a servant the same management actions", async () => {
    signIn("SERVANT");

    renderPage(<BlogListPage />, {
      answers: { "/blog/posts": PAGE },
    });

    expect(
      await screen.findByRole("link", { name: "اكتب منشورًا" }),
    ).toBeInTheDocument();
    await screen.findByText("موضوع في الإيمان");
    expect(
      screen.getByRole("button", { name: "نشر الآن" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "جدولة" })).toBeInTheDocument();
  });

  it("shows a member neither the writing action nor the management actions", async () => {
    signIn("MEMBER");

    renderPage(<BlogListPage />, {
      answers: {
        "/blog/posts": {
          ...PAGE,
          items: [{ ...A_POST, status: "PUBLISHED" }],
        },
      },
    });

    expect(await screen.findByText("موضوع في الإيمان")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "اكتب منشورًا" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "نشر الآن" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "أرشفة" }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when there is no post", async () => {
    signIn("ADMIN");

    renderPage(<BlogListPage />, {
      answers: {
        "/blog/posts": {
          ...PAGE,
          items: [],
          total: 0,
        },
      },
    });

    expect(await screen.findByText("لا توجد منشورات بعد")).toBeInTheDocument();
  });

  it("publishes a post through the blog route", async () => {
    signIn("ADMIN");
    const user = userEvent.setup();
    const calls = renderPage(<BlogListPage />, {
      answers: {
        "/blog/posts": PAGE,
        [`POST /blog/posts/${A_POST.id}/publish`]: A_POST,
      },
    });

    await user.click(await screen.findByRole("button", { name: "نشر الآن" }));

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "post" &&
            call.url === `/blog/posts/${A_POST.id}/publish`,
        ),
      ).toBe(true);
    });
  });

  it("schedules a draft through the blog route", async () => {
    signIn("ADMIN");
    const user = userEvent.setup();
    const calls = renderPage(<BlogListPage />, {
      answers: {
        "/blog/posts": PAGE,
        [`POST /blog/posts/${A_POST.id}/schedule`]: A_POST,
      },
    });

    await user.click(await screen.findByRole("button", { name: "جدولة" }));

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "post" &&
            call.url === `/blog/posts/${A_POST.id}/schedule`,
        ),
      ).toBe(true);
    });
  });

  it("asks before archiving a post", async () => {
    signIn("ADMIN");
    const user = userEvent.setup();
    const calls = renderPage(<BlogListPage />, {
      answers: { "/blog/posts": PAGE },
    });

    await user.click(await screen.findByRole("button", { name: "أرشفة" }));
    expect(await screen.findByText("أرشفة المنشور")).toBeInTheDocument();

    const archiveButtons = screen.getAllByRole("button", { name: "أرشفة" });
    await user.click(archiveButtons.at(-1)!);

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "delete" && call.url === `/blog/posts/${A_POST.id}`,
        ),
      ).toBe(true);
    });
  });
});
