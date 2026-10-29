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
  status: "DRAFT",
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
    "/admin/blog/posts": {
      items: [POST],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
    "POST /admin/blog/posts/cover": { url: "https://example.com/cover.jpg" },
    "POST /admin/blog/posts": POST,
    "GET /blog/posts/11111111-1111-4111-8111-111111111111": POST,
    "PATCH /admin/blog/posts/11111111-1111-4111-8111-111111111111": POST,
    "POST /admin/blog/posts/11111111-1111-4111-8111-111111111111/publish": POST,
    "POST /admin/blog/posts/11111111-1111-4111-8111-111111111111/schedule":
      POST,
  });
});

afterEach(() => {
  recorder.restore();
});

describe("blogApi", () => {
  it("lists the published posts with their filters", async () => {
    await blogApi.getPosts({ tag: "خدمة", q: "عنوان", page: 2, size: 10 });

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("get");
    expect(call.url).toBe("/blog/posts");
    expect(call.params).toEqual({
      tag: "خدمة",
      q: "عنوان",
      page: 2,
      size: 10,
    });
  });

  it("reads one post", async () => {
    await blogApi.getPost(POST.id);

    expect(onlyCall(recorder.calls).url).toBe(`/blog/posts/${POST.id}`);
  });

  it("lists every post for the administration", async () => {
    await blogApi.getAdminPosts({ page: 1, size: 20 });

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/admin/blog/posts");
    expect(call.params).toEqual({ page: 1, size: 20 });
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
      "post /admin/blog/posts",
      "patch /admin/blog/posts/11111111-1111-4111-8111-111111111111",
      "post /admin/blog/posts/11111111-1111-4111-8111-111111111111/publish",
      "post /admin/blog/posts/11111111-1111-4111-8111-111111111111/schedule",
    ]);
  });

  it("archives a post", async () => {
    await blogApi.deletePost(POST.id);

    expect(onlyCall(recorder.calls).method).toBe("delete");
  });

  it("uploads the cover as multipart data", async () => {
    const file = new File(["image"], "cover.jpg", { type: "image/jpeg" });

    const answer = await blogApi.uploadCover(file);

    expect(answer.url).toBe("https://example.com/cover.jpg");
    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/admin/blog/posts/cover");
    expect(call.data).toBeInstanceOf(FormData);
  });
});
