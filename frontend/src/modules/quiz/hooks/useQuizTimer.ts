import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/datetime";

interface UseQuizTimerOptions {
  remainingSeconds: number;
  serverTime: string;
  onExpire: () => void;
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
  onExpire,
}: UseQuizTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    computeRemaining(remainingSeconds, serverTime),
  );
  const expireFiredRef = useRef(false);

  const isExpired = secondsLeft <= 0;
  const isWarning = secondsLeft > 0 && secondsLeft <= WARNING_THRESHOLD;

  // Reset on prop change (e.g. re-sync from server)
  useEffect(() => {
    setSecondsLeft(computeRemaining(remainingSeconds, serverTime));
    expireFiredRef.current = false;
  }, [remainingSeconds, serverTime]);

  // Fire onExpire once
  useEffect(() => {
    if (isExpired && !expireFiredRef.current) {
      expireFiredRef.current = true;
      onExpire();
    }
  }, [isExpired, onExpire]);

  // Main countdown
  useEffect(() => {
    if (isExpired) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isExpired]);

  // Re-sync on visibility change
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
