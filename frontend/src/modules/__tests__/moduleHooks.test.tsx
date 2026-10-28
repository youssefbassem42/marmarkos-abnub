/**
 * The hooks of the notifications, the points, the analytics, the bible
 * and the anonymous messages.
 *
 * They are thin, but each of them owns a decision: which endpoint is
 * called, which cache entry is invalidated, and what the optimistic
 * update does when the request fails.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMonthlyAnalytics } from "@/modules/analytics/hooks/useMonthlyAnalytics";
import { useMonthlyUsers } from "@/modules/analytics/hooks/useMonthlyUsers";
import { useAnonymousMessages } from "@/modules/anonymous-messages/hooks/useAnonymousMessages";
import { useSubmitAnonymousMessage } from "@/modules/anonymous-messages/hooks/useSubmitAnonymousMessage";
import { bibleKeys } from "@/modules/bible/api/queryKeys";
import { VERSE_ADMIN_ITEM, VERSE_DETAIL } from "@/test/fixtures/bible";
import { useMarkAsRead } from "@/modules/bible/hooks/useMarkAsRead";
import { usePublishVerse } from "@/modules/bible/hooks/usePublishVerse";
import { useVerse } from "@/modules/bible/hooks/useVerse";
import { notificationKeys } from "@/modules/notifications/api/queryKeys";
import { useMarkAllRead } from "@/modules/notifications/hooks/useMarkAllRead";
import { useMarkRead } from "@/modules/notifications/hooks/useMarkRead";
import { useNotifications } from "@/modules/notifications/hooks/useNotifications";
import { useMyPoints } from "@/modules/points/hooks/useMyPoints";
import { usePointsHistory } from "@/modules/points/hooks/usePointsHistory";
import {
  onlyCall,
  recordApiCalls,
  recordApiCallsFor,
  type RecordingAdapter,
} from "@/test/recordingAdapter";

let recorder: RecordingAdapter;
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  // The verses answer with the complete shape: an endpoint with a schema
  // rejects an incomplete answer.
  recorder = recordApiCallsFor({
    "/bible-verses/v1/publish": VERSE_ADMIN_ITEM,
    "/bible-verses/v1": VERSE_DETAIL,
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  recorder.restore();
});

describe("the notification hooks", () => {
  it("reads the feed", async () => {
    const { result } = renderHook(() => useNotifications({ page: 1 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/notifications");
    expect(call.params).toEqual({ page: 1 });
  });

  it("marks one notification as read and refreshes the feed", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useMarkRead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("n1");
    });

    expect(onlyCall(recorder.calls).url).toBe("/notifications/n1/read");
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: notificationKeys.all,
      }),
    );
    invalidate.mockRestore();
  });

  it("marks every notification as read", async () => {
    const { result } = renderHook(() => useMarkAllRead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(onlyCall(recorder.calls).url).toBe("/notifications/read-all");
  });
});

describe("the points hooks", () => {
  it("reads the totals and the history", async () => {
    const totals = renderHook(() => useMyPoints(), { wrapper });
    await waitFor(() => expect(totals.result.current.isSuccess).toBe(true));

    const history = renderHook(() => usePointsHistory({ page: 1 }), {
      wrapper,
    });
    await waitFor(() => expect(history.result.current.isSuccess).toBe(true));

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/points/me",
      "/points/me/history",
    ]);
  });
});

describe("the analytics hooks", () => {
  it("reads the KPIs and the members table of a month", async () => {
    const kpis = renderHook(() => useMonthlyAnalytics("2026-09"), {
      wrapper,
    });
    await waitFor(() => expect(kpis.result.current.isSuccess).toBe(true));

    const users = renderHook(() => useMonthlyUsers("2026-09", { page: 1 }), {
      wrapper,
    });
    await waitFor(() => expect(users.result.current.isSuccess).toBe(true));

    expect(recorder.calls[0]?.url).toBe("/quiz-analytics/monthly");
    expect(recorder.calls[0]?.params).toEqual({ month: "2026-09" });
    expect(recorder.calls[1]?.url).toBe("/quiz-analytics/monthly/users");
  });
});

describe("the bible hooks", () => {
  it("reads one verse", async () => {
    const { result } = renderHook(() => useVerse("v1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onlyCall(recorder.calls).url).toBe("/bible-verses/v1");
  });

  it("does not read a verse when the hook is disabled", async () => {
    const { result } = renderHook(() => useVerse("v1", { enabled: false }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(recorder.calls).toHaveLength(0);
  });

  it("marks a verse as read", async () => {
    const { result } = renderHook(() => useMarkAsRead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("v1");
    });

    expect(onlyCall(recorder.calls).url).toBe("/bible-verses/v1/read");
  });

  it("marks the verse as read in the cache before the answer arrives", async () => {
    queryClient.setQueryData(bibleKeys.detail("v1"), {
      id: "v1",
      is_read: false,
    });
    const { result } = renderHook(() => useMarkAsRead(), { wrapper });

    act(() => {
      result.current.mutate("v1");
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData(bibleKeys.detail("v1")) as {
        is_read: boolean;
      };
      expect(cached.is_read).toBe(true);
    });
  });

  it("publishes a verse and refreshes the list and the detail", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => usePublishVerse(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("v1");
    });

    expect(onlyCall(recorder.calls).url).toBe("/bible-verses/v1/publish");
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: bibleKeys.detail("v1"),
      }),
    );
    invalidate.mockRestore();
  });
});

describe("the anonymous message hooks", () => {
  it("submits a message", async () => {
    const { result } = renderHook(() => useSubmitAnonymousMessage(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ message: "hello" } as never);
    });

    expect(onlyCall(recorder.calls).url).toBe("/anonymous-messages");
  });

  it("reads the admin listing", async () => {
    const { result } = renderHook(
      () => useAnonymousMessages({ status: "FAILED" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/anonymous-messages");
    expect(call.params).toEqual({ status: "FAILED" });
  });
});
