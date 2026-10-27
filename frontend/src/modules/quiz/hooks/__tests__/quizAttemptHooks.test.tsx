/**
 * The hooks of the quiz attempt.
 *
 * They are the thin layer between the screens and the client: what
 * matters is that they call the right endpoint, that the mutations do
 * not retry (a double submission would cost the member the attempt)
 * and that the cache is invalidated where it has to be.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { quizKeys } from "@/modules/quiz/api/queryKeys";
import {
  onlyCall,
  recordApiCalls,
  type RecordingAdapter,
} from "@/test/recordingAdapter";

import { useSaveAnswer } from "../useSaveAnswer";
import { useStartAttempt } from "../useStartAttempt";
import { useSubmitAttempt } from "../useSubmitAttempt";

let recorder: RecordingAdapter;
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  recorder = recordApiCalls({ attempt_id: "a1" });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  recorder.restore();
});

describe("useStartAttempt", () => {
  it("starts the attempt of a quiz", async () => {
    const { result } = renderHook(() => useStartAttempt(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("q1");
    });

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/quiz-attempts");
  });
});

describe("useSaveAnswer", () => {
  it("saves the selected option", async () => {
    const { result } = renderHook(() => useSaveAnswer(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        attemptId: "a1",
        questionId: "question-1",
        selectedOptionId: "option-2",
      });
    });

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("put");
    expect(call.url).toBe("/quiz-attempts/a1/answers/question-1");
  });

  it("never retries: a repeated answer would be a second submission", async () => {
    recorder.restore();
    const failing = recordApiCalls({ detail: { message: "boom" } }, 500);
    const { result } = renderHook(() => useSaveAnswer(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({
          attemptId: "a1",
          questionId: "question-1",
          selectedOptionId: "option-2",
        })
        .catch(() => undefined);
    });

    // One call, not two: the mutation does not retry.
    expect(failing.calls).toHaveLength(1);
    failing.restore();
  });
});

describe("useSubmitAttempt", () => {
  it("submits the attempt", async () => {
    const { result } = renderHook(() => useSubmitAttempt(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("a1");
    });

    expect(onlyCall(recorder.calls).url).toBe("/quiz-attempts/a1/submit");
  });

  it("invalidates the attempt in the cache when it succeeds", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSubmitAttempt(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("a1");
    });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: quizKeys.attempt("a1"),
      }),
    );
    invalidate.mockRestore();
  });
});
