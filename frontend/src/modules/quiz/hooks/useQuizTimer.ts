import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/datetime";

interface UseQuizTimerOptions {
  remainingSeconds: number;
  serverTime: string;
}

const WARNING_THRESHOLD = 30;

function computeRemaining(
  remainingSeconds: number,
  serverTime: string,
): number {
  const serverTs = new Date(serverTime).getTime();
  const elapsed = Math.floor((Date.now() - serverTs) / 1000);
  return Math.max(0, remainingSeconds - elapsed);
}

export function useQuizTimer({
  remainingSeconds,
  serverTime,
}: UseQuizTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    computeRemaining(remainingSeconds, serverTime),
  );

  const isExpired = secondsLeft <= 0;
  const isWarning = secondsLeft > 0 && secondsLeft <= WARNING_THRESHOLD;

  // Reset on prop change (e.g. re-sync from server heartbeat/save)
  useEffect(() => {
    setSecondsLeft(computeRemaining(remainingSeconds, serverTime));
  }, [remainingSeconds, serverTime]);

  // Paused countdown: only runs while the tab is visible. Away time is not
  // charged, which matches the server's active-time budget (V2).
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

  // Re-sync when the tab becomes visible again; server is authoritative.
  const resync = useCallback(() => {
    if (document.visibilityState === "visible") {
      setSecondsLeft(computeRemaining(remainingSeconds, serverTime));
    }
  }, [remainingSeconds, serverTime]);

  useEffect(() => {
    document.addEventListener("visibilitychange", resync);
    return () => document.removeEventListener("visibilitychange", resync);
  }, [resync]);

  return {
    secondsLeft,
    isWarning,
    isExpired,
    formatted: formatClock(Math.max(0, secondsLeft)),
  };
}
