/**
 * The remaining hooks of the bible, the quiz, the points and the users.
 *
 * They are thin wrappers around the clients; what they own is the
 * cache invalidation (a mutation that changes a list has to refresh
 * that list) and the endpoint they call.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bibleKeys } from "@/modules/bible/api/queryKeys";
import { useAdminVerses } from "@/modules/bible/hooks/useAdminVerses";
import { useArchiveVerse } from "@/modules/bible/hooks/useArchiveVerse";
import { useCancelSchedule } from "@/modules/bible/hooks/useCancelSchedule";
import { useCreateVerse } from "@/modules/bible/hooks/useCreateVerse";
import { useCurrentVerse } from "@/modules/bible/hooks/useCurrentVerse";
import { useRecordOpen } from "@/modules/bible/hooks/useRecordOpen";
import { useRescheduleVerse } from "@/modules/bible/hooks/useRescheduleVerse";
import { useScheduleVerse } from "@/modules/bible/hooks/useScheduleVerse";
import { useUpdateVerse } from "@/modules/bible/hooks/useUpdateVerse";
import { useVerseAnalytics } from "@/modules/bible/hooks/useVerseAnalytics";
import { useVerseAnalyticsOverview } from "@/modules/bible/hooks/useVerseAnalyticsOverview";
import { useVerseAnalyticsUsers } from "@/modules/bible/hooks/useVerseAnalyticsUsers";
import { useVerseFeed } from "@/modules/bible/hooks/useVerseFeed";
import { useVerseQuickStats } from "@/modules/bible/hooks/useVerseQuickStats";
import { useVerseStats } from "@/modules/bible/hooks/useVerseStats";
import { useMonthlyPoints } from "@/modules/points/hooks/useMonthlyPoints";
import { quizKeys } from "@/modules/quiz/api/queryKeys";
import { useAdminQuizzes } from "@/modules/quiz/hooks/useAdminQuizzes";
import { useArchiveQuiz } from "@/modules/quiz/hooks/useArchiveQuiz";
import { useAttemptResult } from "@/modules/quiz/hooks/useAttemptResult";
import { useAttemptReview } from "@/modules/quiz/hooks/useAttemptReview";
import { useCreateQuiz } from "@/modules/quiz/hooks/useCreateQuiz";
import { useDeleteQuestion } from "@/modules/quiz/hooks/useDeleteQuestion";
import { useDuplicateQuestion } from "@/modules/quiz/hooks/useDuplicateQuestion";
import { usePublishQuiz } from "@/modules/quiz/hooks/usePublishQuiz";
import { useQuiz } from "@/modules/quiz/hooks/useQuiz";
import { useQuizAnalyticsOverview } from "@/modules/quiz/hooks/useQuizAnalyticsOverview";
import { useQuizByVerse } from "@/modules/quiz/hooks/useQuizByVerse";
import { useQuizForTake } from "@/modules/quiz/hooks/useQuizForTake";
import { useQuizValidation } from "@/modules/quiz/hooks/useQuizValidation";
import { useReorderQuestions } from "@/modules/quiz/hooks/useReorderQuestions";
import { useSaveQuestion } from "@/modules/quiz/hooks/useSaveQuestion";
import { useUpdateQuestion } from "@/modules/quiz/hooks/useUpdateQuestion";
import { useUpdateQuiz } from "@/modules/quiz/hooks/useUpdateQuiz";
import { useUsers } from "@/modules/users/hooks/useUsers";
import {
  onlyCall,
  recordApiCalls,
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
  recorder = recordApiCalls({});
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  recorder.restore();
});

describe("the bible queries", () => {
  it("reads the manager list, the feed and the current verse", async () => {
    const list = renderHook(() => useAdminVerses({ page: 1 }), {
      wrapper,
    });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    const feed = renderHook(() => useVerseFeed({ page: 2 }), { wrapper });
    await waitFor(() => expect(feed.result.current.isSuccess).toBe(true));

    const current = renderHook(() => useCurrentVerse(), { wrapper });
    await waitFor(() => expect(current.result.current.isSuccess).toBe(true));

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/bible-verses",
      "/bible-verses/published",
      "/bible-verses/current",
    ]);
    expect(recorder.calls[0]?.params).toEqual({ page: 1 });
  });

  it("reads the statistics and the analytics", async () => {
    const stats = renderHook(() => useVerseStats(), { wrapper });
    await waitFor(() => expect(stats.result.current.isSuccess).toBe(true));

    const overview = renderHook(() => useVerseAnalyticsOverview(), { wrapper });
    await waitFor(() => expect(overview.result.current.isSuccess).toBe(true));

    const quick = renderHook(() => useVerseQuickStats(), { wrapper });
    await waitFor(() => expect(quick.result.current.isSuccess).toBe(true));

    const detail = renderHook(() => useVerseAnalytics("v1"), { wrapper });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));

    const users = renderHook(() => useVerseAnalyticsUsers("v1"), { wrapper });
    await waitFor(() => expect(users.result.current.isSuccess).toBe(true));

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/bible-verses/stats",
      "/bible-verses/analytics/overview",
      "/bible-verses/analytics/quick-stats",
      "/bible-verses/v1/analytics",
      "/bible-verses/v1/analytics/users",
    ]);
  });
});

describe("the bible mutations", () => {
  it("creates a verse and refreshes the list", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateVerse(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ title: "V" } as never);
    });

    expect(onlyCall(recorder.calls).url).toBe("/bible-verses");
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: bibleKeys.verses() }),
    );
    invalidate.mockRestore();
  });

  it("updates and archives a verse", async () => {
    const update = renderHook(() => useUpdateVerse(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({
        verseId: "v1",
        data: { title: "V2" } as never,
      });
    });

    const archive = renderHook(() => useArchiveVerse(), { wrapper });
    await act(async () => {
      await archive.result.current.mutateAsync("v1");
    });

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "patch /bible-verses/v1",
      "delete /bible-verses/v1",
    ]);
  });

  it("schedules, reschedules and cancels a schedule", async () => {
    const schedule = renderHook(() => useScheduleVerse(), { wrapper });
    await act(async () => {
      await schedule.result.current.mutateAsync({
        verseId: "v1",
        data: { publish_at: "2026-10-01" } as never,
      });
    });

    const reschedule = renderHook(() => useRescheduleVerse(), { wrapper });
    await act(async () => {
      await reschedule.result.current.mutateAsync({
        verseId: "v1",
        data: { publish_at: "2026-10-08" } as never,
      });
    });

    const cancel = renderHook(() => useCancelSchedule(), { wrapper });
    await act(async () => {
      await cancel.result.current.mutateAsync("v1");
    });

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /bible-verses/v1/schedule",
      "patch /bible-verses/v1/schedule",
      "delete /bible-verses/v1/schedule",
    ]);
  });

  it("records the opening of a verse once", async () => {
    const { rerender } = renderHook(
      ({ verseId }: { verseId: string | undefined }) => useRecordOpen(verseId),
      { wrapper, initialProps: { verseId: "v1" as string | undefined } },
    );

    await waitFor(() => expect(recorder.calls).toHaveLength(1));

    rerender({ verseId: "v1" });

    await waitFor(() => expect(recorder.calls).toHaveLength(1));
    expect(recorder.calls[0]?.url).toBe("/bible-verses/v1/open");
  });

  it("does not record an opening without a verse", async () => {
    renderHook(() => useRecordOpen(undefined), { wrapper });

    await waitFor(() => expect(recorder.calls).toHaveLength(0));
  });
});

describe("the quiz queries", () => {
  it("reads the list, one quiz, the quiz of a verse and the checklist", async () => {
    const list = renderHook(() => useAdminQuizzes({ page: 1 }), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    const one = renderHook(() => useQuiz("q1"), { wrapper });
    await waitFor(() => expect(one.result.current.isSuccess).toBe(true));

    const byVerse = renderHook(() => useQuizByVerse("v1"), { wrapper });
    await waitFor(() => expect(byVerse.result.current.isSuccess).toBe(true));

    const validation = renderHook(() => useQuizValidation("q1"), { wrapper });
    await waitFor(() => expect(validation.result.current.isSuccess).toBe(true));

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/quizzes",
      "/quizzes/q1",
      "/quizzes/by-verse/v1",
      "/quizzes/q1/validation",
    ]);
  });

  it("reads the quiz of a member and the analytics", async () => {
    const take = renderHook(() => useQuizForTake("q1"), { wrapper });
    await waitFor(() => expect(take.result.current.isSuccess).toBe(true));

    const overview = renderHook(() => useQuizAnalyticsOverview(), { wrapper });
    await waitFor(() => expect(overview.result.current.isSuccess).toBe(true));

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/quizzes/q1",
      "/quizzes/analytics/overview",
    ]);
  });

  it("does not read the quiz of a member when it is disabled", async () => {
    const { result } = renderHook(
      () => useQuizForTake("q1", { enabled: false }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(recorder.calls).toHaveLength(0);
  });

  it("reads the result and the review of an attempt", async () => {
    const result = renderHook(() => useAttemptResult("a1"), { wrapper });
    await waitFor(() => expect(result.result.current.isSuccess).toBe(true));

    const review = renderHook(() => useAttemptReview("a1"), { wrapper });
    await waitFor(() => expect(review.result.current.isSuccess).toBe(true));

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/quiz-attempts/a1/result",
      "/quiz-attempts/a1/review",
    ]);
  });
});

describe("the quiz mutations", () => {
  it("creates, updates, publishes and archives a quiz", async () => {
    const create = renderHook(() => useCreateQuiz(), { wrapper });
    await act(async () => {
      await create.result.current.mutateAsync({ title: "Q" } as never);
    });

    const update = renderHook(() => useUpdateQuiz(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({
        quizId: "q1",
        data: { title: "Q2" } as never,
      });
    });

    const publish = renderHook(() => usePublishQuiz(), { wrapper });
    await act(async () => {
      await publish.result.current.mutateAsync("q1");
    });

    const archive = renderHook(() => useArchiveQuiz(), { wrapper });
    await act(async () => {
      await archive.result.current.mutateAsync("q1");
    });

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /quizzes",
      "patch /quizzes/q1",
      "post /quizzes/q1/publish",
      "post /quizzes/q1/archive",
    ]);
  });

  it("saves, updates, deletes, duplicates and reorders the questions", async () => {
    const save = renderHook(() => useSaveQuestion(), { wrapper });
    await act(async () => {
      await save.result.current.mutateAsync({
        quizId: "q1",
        data: { question: "Q" } as never,
      });
    });

    const update = renderHook(() => useUpdateQuestion(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({
        quizId: "q1",
        questionId: "question-1",
        data: { question: "Q2" } as never,
      });
    });

    const remove = renderHook(() => useDeleteQuestion(), { wrapper });
    await act(async () => {
      await remove.result.current.mutateAsync({
        quizId: "q1",
        questionId: "question-1",
      });
    });

    const duplicate = renderHook(() => useDuplicateQuestion(), { wrapper });
    await act(async () => {
      await duplicate.result.current.mutateAsync({
        quizId: "q1",
        questionId: "question-1",
      });
    });

    const reorder = renderHook(() => useReorderQuestions(), { wrapper });
    await act(async () => {
      await reorder.result.current.mutateAsync({
        quizId: "q1",
        data: { question_ids: ["a"] } as never,
      });
    });

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /quizzes/q1/questions",
      "patch /quiz-questions/question-1",
      "delete /quiz-questions/question-1",
      "post /quiz-questions/question-1/duplicate",
      "put /quizzes/q1/questions/reorder",
    ]);
  });
});

describe("the other modules", () => {
  it("reads the monthly points", async () => {
    const { result } = renderHook(() => useMonthlyPoints(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onlyCall(recorder.calls).url).toBe("/points/me/monthly");
  });

  it("reads the list of the members", async () => {
    const { result } = renderHook(() => useUsers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onlyCall(recorder.calls).url).toBe("/users");
  });
});
