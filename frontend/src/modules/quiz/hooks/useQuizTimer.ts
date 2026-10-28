import { useEffect, useState } from "react";
import { formatClock } from "@/lib/datetime";

interface UseQuizTimerOptions {
  /**
   * The remaining budget of the attempt **as the server saw it when it
   * answered** (the heartbeat, the resume or the save).
   */
  remainingSeconds: number;
}

const WARNING_THRESHOLD = 30;

/**
 * The countdown of a quiz.
 *
 * The server owns the budget; the browser only counts it down. The
 * countdown is therefore anchored on the answer of the server **when it
 * arrives** — the clock of the member's device is never compared with
 * the clock of the server.
 *
 * The old version did compare them (`Date.now() - server_time`): a
 * laptop whose clock is a few minutes off (or a browser that has been
 * asleep) made the quiz expire **the moment it opened**, the panel of
 * the time being up appeared by itself, and the member submitted an
 * attempt with every answer empty.
 */
export function useQuizTimer({ remainingSeconds }: UseQuizTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds);

  const isExpired = secondsLeft <= 0;
  const isWarning = secondsLeft > 0 && secondsLeft <= WARNING_THRESHOLD;

  // Every answer of the server re-anchors the countdown (the heartbeat
  // every 15 seconds, and every answer the member gives).
  useEffect(() => {
    setSecondsLeft(remainingSeconds);
  }, [remainingSeconds]);

  // The countdown runs on the browser's own timer, and only while the
  // tab is visible: the server does not charge the time the member is
  // away either (the clock is paused).
  useEffect(() => {
    if (isExpired) return;

    const tick = () => {
      if (document.visibilityState === "visible") {
        setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isExpired]);

  return {
    secondsLeft,
    isWarning,
    isExpired,
    formatted: formatClock(Math.max(0, secondsLeft)),
  };
}
