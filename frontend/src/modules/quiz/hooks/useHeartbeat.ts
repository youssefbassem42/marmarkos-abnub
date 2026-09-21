import { useEffect, useRef } from "react";
import { quizApi } from "../api";
import type { AttemptHeartbeatResponse } from "../types";

interface UseHeartbeatOptions {
  attemptId: string;
  /** Send heartbeats only while the attempt is still in progress */
  enabled: boolean;
  /** Called with the server-anchored budget after each successful heartbeat */
  onAnchor: (body: AttemptHeartbeatResponse) => void;
  intervalMs?: number;
}

/**
 * V2 active-time heartbeat: sends a POST to the server on mount and every
 * interval while the tab is visible, re-anchoring the remaining budget. The
 * server only charges gaps inside its liveness window, so a hidden tab
 * (page visibility = pause) costs no time; the next heartbeat when the user
 * returns simply resumes. Failures are swallowed — the save path re-anchors
 * too, and the server is authoritative.
 */
export function useHeartbeat({
  attemptId,
  enabled,
  onAnchor,
  intervalMs = 15000,
}: UseHeartbeatOptions) {
  const onAnchorRef = useRef(onAnchor);
  onAnchorRef.current = onAnchor;

  useEffect(() => {
    if (!enabled || !attemptId) return;

    const beat = async () => {
      try {
        const body = await quizApi.heartbeatAttempt(attemptId);
        onAnchorRef.current(body);
      } catch {
        // Swallow; the timer resyncs from resume/save responses instead.
      }
    };

    let cancelled = false;
    void beat();

    const id = setInterval(() => {
      if (cancelled) return;
      if (document.visibilityState === "visible") void beat();
    }, intervalMs);

    const onVisible = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [attemptId, enabled, intervalMs]);
}
