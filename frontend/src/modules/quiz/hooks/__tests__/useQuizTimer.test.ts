/**
 * The countdown of a quiz.
 *
 * The server owns the budget; the browser counts it down. The clock of
 * the member's device must never be compared with the clock of the
 * server: a laptop whose clock is a few minutes off expired the quiz
 * the moment it opened, the panel of the time being up appeared by
 * itself, and the member submitted an attempt with every answer empty.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuizTimer } from "../useQuizTimer";

describe("the countdown of a quiz", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T17:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts the budget of the server down, second by second", () => {
    const { result } = renderHook(() => useQuizTimer({ remainingSeconds: 90 }));

    expect(result.current.secondsLeft).toBe(90);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.formatted).toBe("01:30");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.secondsLeft).toBe(87);
    expect(result.current.formatted).toBe("01:27");
  });

  it("does not expire when the clock of the device is ahead of the server", () => {
    // The device is one hour ahead (a wrong clock, a machine that was
    // not synchronised). The old version compared the two clocks and
    // expired the quiz the moment it opened.
    vi.setSystemTime(new Date("2026-10-28T18:00:00Z"));

    const { result } = renderHook(() =>
      useQuizTimer({ remainingSeconds: 600 }),
    );

    expect(result.current.secondsLeft).toBe(600);
    expect(result.current.isExpired).toBe(false);
  });

  it("does not expire when the clock of the device is behind the server", () => {
    vi.setSystemTime(new Date("2026-10-28T16:00:00Z"));

    const { result } = renderHook(() =>
      useQuizTimer({ remainingSeconds: 600 }),
    );

    expect(result.current.secondsLeft).toBe(600);
    expect(result.current.isExpired).toBe(false);
  });

  it("expires when the budget of the server is over", () => {
    const { result } = renderHook(() => useQuizTimer({ remainingSeconds: 0 }));

    expect(result.current.isExpired).toBe(true);
    expect(result.current.formatted).toBe("00:00");
  });

  it("re-anchors on every answer of the server", () => {
    const { result, rerender } = renderHook(
      ({ remainingSeconds }: { remainingSeconds: number }) =>
        useQuizTimer({ remainingSeconds }),
      { initialProps: { remainingSeconds: 90 } },
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.secondsLeft).toBe(85);

    // The heartbeat of the server: the budget is 80 now.
    rerender({ remainingSeconds: 80 });
    expect(result.current.secondsLeft).toBe(80);
  });

  it("warns in the last thirty seconds", () => {
    const { result } = renderHook(() => useQuizTimer({ remainingSeconds: 20 }));

    expect(result.current.isWarning).toBe(true);
    expect(result.current.isExpired).toBe(false);
  });
});
