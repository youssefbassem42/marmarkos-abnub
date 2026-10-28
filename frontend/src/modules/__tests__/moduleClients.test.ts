/**
 * The clients of the bible, the notifications, the points, the users
 * and the anonymous messages.
 *
 * They are grouped in one file: they are thin, and what they have to
 * guarantee is the URL and the shape of the answer.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { anonymousMessagesApi } from "@/modules/anonymous-messages/api";
import { bibleApi } from "@/modules/bible/api";
import {
  VERSE_ADMIN_ITEM,
  VERSE_ANALYTICS,
  VERSE_ANALYTICS_OVERVIEW,
  VERSE_CARD,
  VERSE_QUICK_STATS,
  VERSE_STATS,
  VERSE_USER_ENGAGEMENT,
} from "@/test/fixtures/bible";
import {
  MARK_READ,
  MEMBER,
  MONTHLY_POINTS,
  NOTIFICATION,
  NOTIFICATION_SUMMARY,
  POINT_ACTIVITY,
  POINTS,
} from "@/test/fixtures/member";
import { notificationsApi } from "@/modules/notifications/api";
import { pointsApi } from "@/modules/points/api";
import { usersApi } from "@/modules/users/api";
import {
  onlyCall,
  recordApiCalls,
  recordApiCallsFor,
  type RecordingAdapter,
} from "@/test/recordingAdapter";

let recorder: RecordingAdapter;

beforeEach(() => {
  // The verses answer with the complete shape: an endpoint with a schema
  // rejects an incomplete answer.
  recorder = recordApiCallsFor({
    "/notifications/summary": NOTIFICATION_SUMMARY,
    "/notifications/read-all": MARK_READ,
    "/notifications/n1/read": MARK_READ,
    "/notifications": {
      items: [NOTIFICATION],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
    "/users/me/points/history": {
      items: [POINT_ACTIVITY],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
    "/users/me/points/monthly": MONTHLY_POINTS,
    "/users/me/points": POINTS,
    "/users": [MEMBER],
    "/bible-verses/analytics/overview": VERSE_ANALYTICS_OVERVIEW,
    "/bible-verses/analytics/quick-stats": VERSE_QUICK_STATS,
    "/bible-verses/published": {
      items: [VERSE_CARD],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
    "/bible-verses/current": VERSE_CARD,
    "/bible-verses/stats": VERSE_STATS,
    "POST /bible-verses": VERSE_ADMIN_ITEM,
    "/bible-verses/v1/schedule": VERSE_ADMIN_ITEM,
    "/bible-verses/v1/publish": VERSE_ADMIN_ITEM,
    "/bible-verses/v1/restore": VERSE_ADMIN_ITEM,
    "/bible-verses/v1/analytics/users": {
      items: [VERSE_USER_ENGAGEMENT],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
    "/bible-verses/v1/analytics": VERSE_ANALYTICS,
    "/bible-verses/v1": VERSE_ADMIN_ITEM,
    "/bible-verses": {
      items: [VERSE_ADMIN_ITEM],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
      has_next: false,
    },
  });
});

afterEach(() => {
  recorder.restore();
});

describe("bibleApi", () => {
  it("lists the verses of the manager", async () => {
    await bibleApi.getVerses({ page: 1 });

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/bible-verses");
    expect(call.params).toEqual({ page: 1 });
  });

  it("reads the current verse and answers null when there is none", async () => {
    recorder.restore();
    const empty = recordApiCalls({}, 204);

    await expect(bibleApi.getCurrent()).resolves.toBeNull();

    expect(onlyCall(empty.calls).url).toBe("/bible-verses/current");
    empty.restore();
  });

  it("answers the verse when there is one", async () => {
    recorder.restore();
    const withVerse = recordApiCallsFor({
      "/bible-verses/current": { ...VERSE_CARD, id: "v1", title: "A verse" },
    });

    await expect(bibleApi.getCurrent()).resolves.toMatchObject({
      id: "v1",
      title: "A verse",
    });

    withVerse.restore();
  });

  it("reads the feed of the published verses", async () => {
    await bibleApi.getPublished({ page: 2, size: 10 });

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/bible-verses/published");
    expect(call.params).toEqual({ page: 2, size: 10 });
  });

  it("creates, updates, archives and restores a verse", async () => {
    await bibleApi.createVerse({ title: "V" } as never);
    await bibleApi.updateVerse("v1", { title: "V2" } as never);
    await bibleApi.archiveVerse("v1");
    await bibleApi.restoreVerse("v1");

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /bible-verses",
      "patch /bible-verses/v1",
      "delete /bible-verses/v1",
      "post /bible-verses/v1/restore",
    ]);
  });

  it("publishes, schedules, reschedules and cancels a schedule", async () => {
    await bibleApi.publishVerse("v1");
    await bibleApi.scheduleVerse("v1", { publish_at: "2026-10-01" } as never);
    await bibleApi.rescheduleVerse("v1", { publish_at: "2026-10-08" } as never);
    await bibleApi.cancelSchedule("v1");

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /bible-verses/v1/publish",
      "post /bible-verses/v1/schedule",
      "patch /bible-verses/v1/schedule",
      "delete /bible-verses/v1/schedule",
    ]);
  });

  it("marks a verse as read and records an opening", async () => {
    await bibleApi.markAsRead("v1");
    await bibleApi.recordOpen("v1");

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /bible-verses/v1/read",
      "post /bible-verses/v1/open",
    ]);
  });

  it("reads the analytics of the verses", async () => {
    await bibleApi.getAnalyticsOverview();
    await bibleApi.getQuickStats();
    await bibleApi.getVerseAnalytics("v1", { granularity: "daily" });
    await bibleApi.getVerseAnalyticsUsers("v1", { read: "read", page: 1 });

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/bible-verses/analytics/overview",
      "/bible-verses/analytics/quick-stats",
      "/bible-verses/v1/analytics",
      "/bible-verses/v1/analytics/users",
    ]);
  });
});

describe("notificationsApi", () => {
  it("reads the feed and the summary", async () => {
    await notificationsApi.list({ page: 1 });
    await notificationsApi.summary();

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/notifications",
      "/notifications/summary",
    ]);
    expect(recorder.calls[0]?.params).toEqual({ page: 1 });
  });

  it("marks one notification and all of them as read", async () => {
    await notificationsApi.markRead("n1");
    await notificationsApi.markAllRead();

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /notifications/n1/read",
      "post /notifications/read-all",
    ]);
  });

  it("pushes a broadcast", async () => {
    await notificationsApi.push({ title_ar: "عنوان" } as never);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/notifications/push");
  });
});

describe("pointsApi", () => {
  it("reads the totals, the monthly series and the history", async () => {
    await pointsApi.getMyPoints();
    await pointsApi.getMonthlyPoints();
    await pointsApi.getMyHistory({ page: 1 });

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/users/me/points",
      "/users/me/points/monthly",
      "/users/me/points/history",
    ]);
  });
});

describe("usersApi", () => {
  it("reads the list of the members", async () => {
    await usersApi.getUsers();

    expect(onlyCall(recorder.calls).url).toBe("/users");
  });
});

describe("anonymousMessagesApi", () => {
  it("submits a message, lists them and retries a delivery", async () => {
    await anonymousMessagesApi.submit({ message: "hello" } as never);
    await anonymousMessagesApi.list({ status: "FAILED" });
    await anonymousMessagesApi.retry("m1");

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /anonymous-messages",
      "get /anonymous-messages",
      "post /anonymous-messages/m1/retry",
    ]);
    expect(recorder.calls[1]?.params).toEqual({ status: "FAILED" });
  });
});
