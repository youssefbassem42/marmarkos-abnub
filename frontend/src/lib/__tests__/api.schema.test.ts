/**
 * The check of the answers at the edge of the API.
 *
 * The frontend used to trust the answers of the server: a field that
 * was renamed or removed reached the page as `undefined`, and the page
 * read `data.total_present.toFixed(1)` - a `TypeError` that crashed
 * the whole screen.
 *
 * A schema turns that crash into a message: the answer is checked at
 * the edge, and an answer that does not have the expected shape becomes
 * an `ApiError` - the page shows its error state instead of a white
 * screen.
 */

import { afterEach, describe, expect, it } from "vitest";

import { ApiError, apiClient, apiGet } from "@/lib/api";
import { meetingStatisticsSchema } from "@/lib/schemas/attendance";
import {
  recordApiCallsFor,
  type RecordingAdapter,
} from "@/test/recordingAdapter";
import { MEETING_STATISTICS } from "@/test/fixtures/attendance";

let recorder: RecordingAdapter | undefined;

afterEach(() => {
  recorder?.restore();
  recorder = undefined;
});

describe("the check of the answers", () => {
  it("accepts an answer that has the expected shape", async () => {
    recorder = recordApiCallsFor({
      "/attendance/statistics/meeting": MEETING_STATISTICS,
    });

    const answer = await apiGet(
      "/attendance/statistics/meeting",
      meetingStatisticsSchema,
    );

    expect(answer.summary.total_present).toBe(30);
  });

  it("turns an answer that does not have the expected shape into an error", async () => {
    recorder = recordApiCallsFor({
      "/attendance/statistics/meeting": { meeting_date: "2026-10-22" },
    });

    await expect(
      apiGet("/attendance/statistics/meeting", meetingStatisticsSchema),
    ).rejects.toThrowError(ApiError);

    // The message says what is wrong - the page (or the log) can say it.
    await expect(
      apiGet("/attendance/statistics/meeting", meetingStatisticsSchema),
    ).rejects.toThrowError(/summary/);
  });

  it("leaves the endpoint without a schema alone", async () => {
    recorder = recordApiCallsFor({ "*": { anything: true } });

    const response = await apiClient.get("/anything");

    expect(response.data).toEqual({ anything: true });
  });

  it("keeps the fields the schema does not know about", async () => {
    recorder = recordApiCallsFor({
      "/attendance/statistics/meeting": {
        ...MEETING_STATISTICS,
        a_new_field: "from the next version of the server",
      },
    });

    const answer = (await apiGet(
      "/attendance/statistics/meeting",
      meetingStatisticsSchema,
    )) as Record<string, unknown>;

    expect(answer.a_new_field).toBe("from the next version of the server");
  });
});
