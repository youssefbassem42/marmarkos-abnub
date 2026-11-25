import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { blogApi } from "../api";
import {
  onlyCall,
  recordApiCallsFor,
  type RecordingAdapter,
} from "@/test/recordingAdapter";

const POST = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "عنوان المنشور",
  excerpt: "ملخص المنشور",
  body: "<p>نص المنشور</p>",
  cover_image: null,
  tags: [{ id: "tag-1", name: "خدمة", slug: "khdma-1" }],
  likes_count: 0,
  comments_count: 0,
  status: "DRAFT",
  short_code: "abc123",
  published_at: null,
  author: { id: "author-1", full_name: "كاتب المنشور" },
  author_id: "author-1",
  created_at: "2026-10-29T10:00:00Z",
  updated_at: "2026-10-29T10:00:00Z",
};

let recorder: RecordingAdapter;

beforeEach(() => {
  recorder = recordApiCallsFor({
    "/blog/posts": {
      items: [POST],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
    "POST /blog/posts/cover": { url: "https://example.com/cover.jpg" },
    "POST /blog/posts": POST,
    "GET /blog/posts/short/abc123": {
      post_id: POST.id,
      slug: "short-slug",
    },
    [`GET /blog/posts/${POST.id}`]: POST,
    [`PATCH /blog/posts/${POST.id}`]: POST,
    [`POST /blog/posts/${POST.id}/publish`]: POST,
    [`POST /blog/posts/${POST.id}/schedule`]: POST,
    "/blog/comments/44444444-4444-4444-8444-444444444444/likes": {
      comment_id: "44444444-4444-4444-8444-444444444444",
      likes_count: 2,
      liked: false,
    },
    "POST /blog/comments/44444444-4444-4444-8444-444444444444/like": {
      comment_id: "44444444-4444-4444-8444-444444444444",
      likes_count: 3,
      liked: true,
    },
    "DELETE /blog/comments/44444444-4444-4444-8444-444444444444/like": {
      comment_id: "44444444-4444-4444-8444-444444444444",
      likes_count: 2,
      liked: false,
    },
  });
});

afterEach(() => {
  recorder.restore();
});

describe("blogApi", () => {
  it("lists the posts with their filters", async () => {
    await blogApi.getPosts({
      tag: "خدمة",
      q: "عنوان",
      page: 2,
      size: 10,
      status: "DRAFT",
    });

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("get");
    expect(call.url).toBe("/blog/posts");
    expect(call.params).toEqual({
      tag: "خدمة",
      q: "عنوان",
      page: 2,
      size: 10,
      status: "DRAFT",
    });
  });

  it("reads one post", async () => {
    await blogApi.getPost(POST.id);

    expect(onlyCall(recorder.calls).url).toBe(`/blog/posts/${POST.id}`);
  });

  it("resolves a short link", async () => {
    const answer = await blogApi.getShortLink("abc123");

    expect(answer).toEqual({
      post_id: POST.id,
      slug: "short-slug",
    });
    expect(onlyCall(recorder.calls).url).toBe("/blog/posts/short/abc123");
  });

  it("reads, gives and takes back the like of a comment", async () => {
    const commentId = "44444444-4444-4444-8444-444444444444";

    await blogApi.getCommentLikes(commentId);
    await blogApi.likeComment(commentId);
    await blogApi.unlikeComment(commentId);

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `get /blog/comments/${commentId}/likes`,
      `post /blog/comments/${commentId}/like`,
      `delete /blog/comments/${commentId}/like`,
    ]);
  });

  it("creates, updates, publishes and schedules a post", async () => {
    await blogApi.createPost({
      title: "عنوان المنشور",
      excerpt: null,
      body: "<p>نص المنشور</p>",
      cover_image: null,
      tags: ["خدمة"],
      published_at: null,
    });
    await blogApi.updatePost(POST.id, { title: "عنوان جديد" });
    await blogApi.publishPost(POST.id);
    await blogApi.schedulePost(POST.id, {
      published_at: "2026-11-01T18:00:00Z",
    });

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /blog/posts",
      "patch /blog/posts/11111111-1111-4111-8111-111111111111",
      "post /blog/posts/11111111-1111-4111-8111-111111111111/publish",
      "post /blog/posts/11111111-1111-4111-8111-111111111111/schedule",
    ]);
  });

  it("archives a post", async () => {
    await blogApi.deletePost(POST.id);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("delete");
    expect(call.url).toBe(`/blog/posts/${POST.id}`);
  });

  it("uploads the cover as multipart data", async () => {
    const file = new File(["image"], "cover.jpg", { type: "image/jpeg" });

    const answer = await blogApi.uploadCover(file);

    expect(answer.url).toBe("https://example.com/cover.jpg");
    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/blog/posts/cover");
    expect(call.data).toBeInstanceOf(FormData);
  });
});
