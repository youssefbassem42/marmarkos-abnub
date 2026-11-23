import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LikeButton } from "@/modules/blog/components/LikeButton";
import { renderPage } from "@/test/pageHarness";
import { clearAuth, updateStoredUser } from "@/lib/auth";
import type { RegisteredUser } from "@/lib/api";

const A_LIKE = {
  post_id: "22222222-2222-4222-8222-222222222222",
  likes_count: 3,
  liked: false,
};

const A_MEMBER = {
  id: "55555555-5555-4555-8555-555555555555",
  full_name: "محمود",
  email: "member@example.com",
  role: "MEMBER",
} as unknown as RegisteredUser;

describe("the like of a post of the blog", () => {
  afterEach(() => {
    clearAuth();
  });

  it("shows the number of the likes to a visitor and asks them to sign in", async () => {
    renderPage(<LikeButton postId="post-1" />, {
      answers: { "/blog/posts/post-1/likes": A_LIKE },
    });

    expect(await screen.findByText("3")).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "سجّل الدخول لتعبير عن إعجابك",
    });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("lets a signed-in member give a like and shows the answer of the server", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    const calls = renderPage(<LikeButton postId="post-1" />, {
      answers: {
        "/blog/posts/post-1/likes": A_LIKE,
        "POST /blog/posts/post-1/like": {
          ...A_LIKE,
          likes_count: 4,
          liked: true,
        },
      },
    });

    const button = await screen.findByRole("button", { name: /أعجبني/ });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "post" &&
            call.url.includes("/blog/posts/post-1/like"),
        ),
      ).toBe(true);
    });
    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  it("takes the like back when the member asks for it", async () => {
    updateStoredUser(A_MEMBER);
    const user = userEvent.setup();
    const calls = renderPage(<LikeButton postId="post-1" />, {
      answers: {
        "/blog/posts/post-1/likes": { ...A_LIKE, liked: true },
        "DELETE /blog/posts/post-1/like": {
          ...A_LIKE,
          likes_count: 2,
          liked: false,
        },
      },
    });

    const button = await screen.findByRole("button", { name: /أعجبك/ });
    expect(button).toHaveAttribute("aria-pressed", "true");

    await user.click(button);

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "delete" &&
            call.url.includes("/blog/posts/post-1/like"),
        ),
      ).toBe(true);
    });
    expect(await screen.findByText("2")).toBeInTheDocument();
  });
});
