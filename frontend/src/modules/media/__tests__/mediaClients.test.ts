/**
 * The client of the media module: the URLs it calls and the shape of the
 * answers it reads.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mediaApi } from "../api";
import {
  onlyCall,
  recordApiCallsFor,
  type RecordingAdapter,
} from "@/test/recordingAdapter";

let recorder: RecordingAdapter;

beforeEach(() => {
  recorder = recordApiCallsFor({
    "/admin/landing/slides": {
      items: [
        {
          id: "s1",
          image: "https://example.com/slide1.jpg",
          title: "الشريحة الأولى",
          subtitle: null,
          order: 1,
          active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
    "/landing/slides": {
      items: [
        {
          id: "s1",
          image: "https://example.com/slide1.jpg",
          title: "الشريحة الأولى",
          subtitle: null,
          order: 1,
        },
      ],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
    "POST /admin/landing/slides": {
      id: "s2",
      image: "https://example.com/slide2.jpg",
      title: "الشريحة الثانية",
      subtitle: null,
      order: 2,
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    "PATCH /admin/landing/slides/s1": {
      id: "s1",
      image: "https://example.com/slide1.jpg",
      title: "الشريحة الأولى",
      subtitle: "وصف",
      order: 1,
      active: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  });
});

afterEach(() => {
  recorder.restore();
});

describe("mediaApi", () => {
  it("lists every slide for the administration", async () => {
    await mediaApi.getAdminSlides({ page: 1, size: 20 });

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("get");
    expect(call.url).toBe("/admin/landing/slides");
    expect(call.params).toEqual({ page: 1, size: 20 });
  });

  it("lists the active slides for the landing page", async () => {
    await mediaApi.getPublicSlides({ page: 1 });

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("get");
    expect(call.url).toBe("/landing/slides");
  });

  it("creates a slide with the image, the title and the subtitle", async () => {
    const form = new FormData();
    form.append("file", new File([], "slide.jpg", { type: "image/jpeg" }));
    form.append("title", "الشريحة الثانية");
    form.append("subtitle", "وصف");

    await mediaApi.createSlide(form);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/admin/landing/slides");
    expect(call.data).toBe(form);
    expect(form.get("title")).toBe("الشريحة الثانية");
  });

  it("updates a slide", async () => {
    const form = new FormData();
    form.append("active", "false");

    await mediaApi.updateSlide("s1", form);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("patch");
    expect(call.url).toBe("/admin/landing/slides/s1");
    expect(call.data).toBe(form);
  });

  it("deletes a slide", async () => {
    await mediaApi.deleteSlide("s1");

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("delete");
    expect(call.url).toBe("/admin/landing/slides/s1");
  });

  it("reorders the slides", async () => {
    await mediaApi.reorderSlides(["s2", "s1"]);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/admin/landing/slides/reorder");
    expect(JSON.parse(call.data as string)).toEqual({ ids: ["s2", "s1"] });
  });
});
