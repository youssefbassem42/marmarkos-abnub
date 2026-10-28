/**
 * The attempt of a member is unique (D-4) - the client resumes it.
 *
 * The server answers a second start with `409 attempt_exists` and carries
 * the id of the existing attempt. The E2E of Phase 5.5 found the gap:
 * React remounts the route, the answer of the first start is lost with
 * the unmounted component, the second start answers 409 - and the page
 * stayed on its loading skeleton for ever. The member could not answer
 * the quiz.
 */

import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { attemptIdFromError } from "@/modules/quiz/hooks/useStartAttempt";

describe("attemptIdFromError", () => {
  it("reads the id of the existing attempt from the conflict", () => {
    const error = new ApiError(
      409,
      "You have already started this quiz",
      "attempt_exists",
      { attempt_id: "8f0e1d2c-1111-2222-3333-444455556666" },
    );

    expect(attemptIdFromError(error)).toBe(
      "8f0e1d2c-1111-2222-3333-444455556666",
    );
  });

  it("ignores every other failure", () => {
    const forbidden = new ApiError(403, "Not allowed");
    const serverError = new ApiError(500, "Boom", "internal", {
      attempt_id: "8f0e1d2c-1111-2222-3333-444455556666",
    });

    expect(attemptIdFromError(forbidden)).toBeNull();
    expect(attemptIdFromError(serverError)).toBeNull();
  });

  it("ignores a conflict without an attempt", () => {
    const conflict = new ApiError(409, "Conflict", "attempt_exists", {});

    expect(attemptIdFromError(conflict)).toBeNull();
  });

  it("ignores something that is not an API error", () => {
    expect(attemptIdFromError(new Error("boom"))).toBeNull();
    expect(attemptIdFromError(undefined)).toBeNull();
  });
});
