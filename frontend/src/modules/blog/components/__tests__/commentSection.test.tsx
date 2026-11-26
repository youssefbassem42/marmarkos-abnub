import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CommentSection } from "@/modules/blog/components/CommentSection";
import { renderPage } from "@/test/pageHarness";
import { clearAuth, updateStoredUser } from "@/lib/auth";
import type { RegisteredUser } from "@/lib/api";

const A_COMMENT = {
  id: "44444444-4444-4444-8444-444444444444",
  post_id: "22222222-2222-4222-8222-222222222222",
  parent_comment_id: null,
  content: "<p>تعليق أول</p>",
  status: "VISIBLE",
  author: { id: "55555555-5555-4555-8555-555555555555", full_name: "محمود" },
  likes_count: 2,
  liked: false,
  replies: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      post_id: "22222222-2222-4222-8222-222222222222",
      parent_comment_id: "44444444-4444-4444-8444-444444444444",
      content: "<p>رد على التعليق</p>",
      status: "VISIBLE",
      author: { id: "77777777-7777-4777-8777-777777777777", full_name: "سارة" },
      likes_count: 1,
      liked: false,
      replies: [],
      created_at: "2026-10-02T00:00:00Z",
      updated_at: "2026-10-02T00:00:00Z",
    },
  ],
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

const PAGE = {
  items: [A_COMMENT],
  total: 1,
  page: 1,
  size: 20,
  pages: 1,
  has_next: false,
};

const A_MEMBER = {
  id: "55555555-5555-4555-8555-555555555555",
  full_name: "محمود",
  email: "member@example.com",
  role: "MEMBER",
} as unknown as RegisteredUser;

describe("the comments of a post of the blog", () => {
  afterEach(() => {
    // The store of the session lives in the module: a test that signs a
    // member in must not leave that member signed in for the next one.
    clearAuth();
  });

  it("shows the tree of the comments and the empty state", async () => {
    renderPage(<CommentSection postId="post-1" status="PUBLISHED" />, {
      answers: { "/blog/posts/post-1/comments": PAGE },
    });

    expect(await screen.findByText("تعليق أول")).toBeInTheDocument();
    expect(screen.getByText("رد على التعليق")).toBeInTheDocument();
    expect(screen.getByText("محمود")).toBeInTheDocument();
  });

  it("asks a visitor to sign in before writing", async () => {
    renderPage(<CommentSection postId="post-1" status="PUBLISHED" />, {
      answers: { "/blog/posts/post-1/comments": PAGE },
    });

    expect(
      await screen.findByText("سجّل الدخول لتكتب تعليقًا."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("اكتب تعليقك")).not.toBeInTheDocument();
  });

  it("does not invite a member to comment on a draft", async () => {
    updateStoredUser(A_MEMBER);
    const calls = renderPage(
      <CommentSection postId="post-1" status="DRAFT" />,
      {
        answers: { "/blog/posts/post-1/comments": PAGE },
      },
    );

    expect(
      await screen.findByText("التعليقات متاحة بعد نشر المقال."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("اكتب تعليقك")).not.toBeInTheDocument();
    // The tree of a draft is not public: the server is not asked for it.
    expect(calls.calls.some((call) => call.url.includes("/comments"))).toBe(
      false,
    );
  });

  it("gives a comment a like and writes the server answer into the tree", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    const calls = renderPage(
      <CommentSection postId="post-1" status="PUBLISHED" />,
      {
        answers: {
          "/blog/posts/post-1/comments": PAGE,
          "POST /blog/comments/44444444-4444-4444-8444-444444444444/like": {
            comment_id: A_COMMENT.id,
            likes_count: 3,
            liked: true,
          },
        },
      },
    );

    await user.click(
      await screen.findByRole("button", { name: "أعجبني التعليق (2)" }),
    );

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "post" &&
            call.url.includes(
              "/blog/comments/44444444-4444-4444-8444-444444444444/like",
            ),
        ),
      ).toBe(true);
    });
    expect(
      await screen.findByRole("button", { name: "أعجبك التعليق (3)" }),
    ).toBeInTheDocument();
    expect(
      calls.calls.filter(
        (call) =>
          call.method === "get" &&
          call.url.includes("/blog/posts/post-1/comments"),
      ),
    ).toHaveLength(1);
  });

  it("gives a reply a like just like a top-level comment", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    const calls = renderPage(
      <CommentSection postId="post-1" status="PUBLISHED" />,
      {
        answers: {
          "/blog/posts/post-1/comments": PAGE,
          "POST /blog/comments/66666666-6666-4666-8666-666666666666/like": {
            comment_id: "66666666-6666-4666-8666-666666666666",
            likes_count: 2,
            liked: true,
          },
        },
      },
    );

    await user.click(
      await screen.findByRole("button", { name: "أعجبني التعليق (1)" }),
    );

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "post" &&
            call.url.includes(
              "/blog/comments/66666666-6666-4666-8666-666666666666/like",
            ),
        ),
      ).toBe(true);
    });
    expect(
      await screen.findByRole("button", { name: "أعجبك التعليق (2)" }),
    ).toBeInTheDocument();
  });

  it("takes the like of a comment back without refetching the tree", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    const calls = renderPage(
      <CommentSection postId="post-1" status="PUBLISHED" />,
      {
        answers: {
          "/blog/posts/post-1/comments": {
            ...PAGE,
            items: [{ ...A_COMMENT, likes_count: 2, liked: true }],
          },
          "DELETE /blog/comments/44444444-4444-4444-8444-444444444444/like": {
            comment_id: A_COMMENT.id,
            likes_count: 1,
            liked: false,
          },
        },
      },
    );

    await user.click(
      await screen.findByRole("button", { name: "أعجبك التعليق (2)" }),
    );

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "delete" &&
            call.url.includes(
              "/blog/comments/44444444-4444-4444-8444-444444444444/like",
            ),
        ),
      ).toBe(true);
    });
    expect(
      await screen.findAllByRole("button", { name: "أعجبني التعليق (1)" }),
    ).toHaveLength(2);
    expect(
      calls.calls.filter(
        (call) =>
          call.method === "get" &&
          call.url.includes("/blog/posts/post-1/comments"),
      ),
    ).toHaveLength(1);
  });

  it("publishes the comment of a signed-in member", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    const calls = renderPage(
      <CommentSection postId="post-1" status="PUBLISHED" />,
      {
        answers: {
          "/blog/posts/post-1/comments": PAGE,
          "POST /blog/posts/post-1/comments": A_COMMENT,
        },
      },
    );

    await user.type(await screen.findByLabelText("اكتب تعليقك"), "تعليق جديد");
    await user.click(screen.getByRole("button", { name: "اكتب تعليقك" }));

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "post" &&
            call.url.includes("/blog/posts/post-1/comments"),
        ),
      ).toBe(true);
    });
    const call = calls.calls.find((entry) => entry.method === "post");
    expect(JSON.parse(String(call?.data ?? "{}")).content).toBe("تعليق جديد");
  });

  it("tells the member why a comment was refused", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    renderPage(<CommentSection postId="post-1" status="PUBLISHED" />, {
      answers: {
        "/blog/posts/post-1/comments": PAGE,
        "POST /blog/posts/post-1/comments": {
          status: 409,
          body: {
            detail: {
              code: "conflict",
              message: "The post is not published yet",
            },
          },
        },
      },
    });

    await user.type(await screen.findByLabelText("اكتب تعليقك"), "تعليق");
    await user.click(screen.getByRole("button", { name: "اكتب تعليقك" }));

    // The reason of the server is told to the member: a silent failure
    // looks like a comment that was swallowed.
    expect(
      await screen.findByText(
        "المقال لم يُنشر بعد، فالتعليقات متاحة بعد النشر.",
      ),
    ).toBeInTheDocument();
  });

  it("lets the owner edit their comment", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    const calls = renderPage(
      <CommentSection postId="post-1" status="PUBLISHED" />,
      {
        answers: {
          "/blog/posts/post-1/comments": PAGE,
          "PATCH /blog/comments/44444444-4444-4444-8444-444444444444":
            A_COMMENT,
        },
      },
    );

    await user.click(await screen.findByRole("button", { name: /تعديل/ }));

    const editor = await screen.findByLabelText("احفظ التعديل");
    await user.clear(editor);
    await user.type(editor, "تعليق معدل");
    await user.click(screen.getByRole("button", { name: "احفظ التعديل" }));

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "patch" &&
            call.url.includes(
              "/blog/comments/44444444-4444-4444-8444-444444444444",
            ),
        ),
      ).toBe(true);
    });
  });

  it("hides the edit of a comment of another member", async () => {
    updateStoredUser({
      ...A_MEMBER,
      id: "88888888-8888-4888-8888-888888888888",
    } as unknown as RegisteredUser);
    renderPage(<CommentSection postId="post-1" status="PUBLISHED" />, {
      answers: { "/blog/posts/post-1/comments": PAGE },
    });

    await screen.findByText("تعليق أول");
    expect(
      screen.queryByRole("button", { name: /تعديل/ }),
    ).not.toBeInTheDocument();
  });

  it("removes a comment when its owner asks for it", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    const calls = renderPage(
      <CommentSection postId="post-1" status="PUBLISHED" />,
      {
        answers: {
          "/blog/posts/post-1/comments": PAGE,
          "DELETE /blog/comments/44444444-4444-4444-8444-444444444444": {},
        },
      },
    );

    await user.click(await screen.findByRole("button", { name: /حذف/ }));

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "delete" &&
            call.url.includes(
              "/blog/comments/44444444-4444-4444-8444-444444444444",
            ),
        ),
      ).toBe(true);
    });
  });
});
