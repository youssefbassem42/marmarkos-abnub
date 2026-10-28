/**
 * The analytics client (`/quiz-analytics/*`).
 *
 * The month is always sent in the canonical `YYYY-MM` shape: it is the
 * only shape the server accepts (the legacy `?year=&month=` pair was
 * removed in Phase 3.1 - it was never published).
 */

import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiClient } from "@/lib/api";
import { analyticsApi, currentMonth } from "../index";

interface Recorded {
  url: string;
  params?: unknown;
  responseType?: string;
}

const originalAdapter = apiClient.defaults.adapter;
const calls: Recorded[] = [];

beforeEach(() => {
  calls.length = 0;
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    calls.push({
      url: config.url ?? "",
      params: config.params,
      responseType: config.responseType,
    });
    return {
      data: {
        items: [],
        total: 0,
        page: 1,
        size: 20,
        pages: 0,
        has_next: false,
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    } as AxiosResponse;
  };
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe("analyticsApi", () => {
  it("asks the monthly endpoint with the canonical month", async () => {
    await analyticsApi.getMonthly("2026-09");

    expect(calls[0]?.url).toBe("/quiz-analytics/monthly");
    expect(calls[0]?.params).toEqual({ month: "2026-09" });
  });

  it("never sends the deprecated year parameter", async () => {
    await analyticsApi.getMonthly("2026-09");
    await analyticsApi.getMonthlyUsers("2026-09", { page: 2, size: 20 });
    await analyticsApi.getUserMonth("user-1", "2026-09");
    await analyticsApi.exportMonthly("2026-09");

    for (const call of calls) {
      const params = (call.params ?? {}) as Record<string, unknown>;
      expect(params).not.toHaveProperty("year");
      expect(params.month).toBe("2026-09");
    }
  });

  it("merges the filters into the users request", async () => {
    await analyticsApi.getMonthlyUsers("2026-09", { q: "محمود", page: 3 });

    expect(calls[0]?.url).toBe("/quiz-analytics/monthly/users");
    expect(calls[0]?.params).toEqual({
      month: "2026-09",
      q: "محمود",
      page: 3,
    });
  });

  it("asks for the user detail of one month", async () => {
    await analyticsApi.getUserMonth(
      "11111111-1111-1111-1111-111111111111",
      "2026-09",
    );

    expect(calls[0]?.url).toBe(
      "/quiz-analytics/users/11111111-1111-1111-1111-111111111111",
    );
    expect(calls[0]?.params).toEqual({ month: "2026-09" });
  });

  it("downloads the export as a blob", async () => {
    await analyticsApi.exportMonthly("2026-09");

    expect(calls[0]?.url).toBe("/quiz-analytics/monthly/export");
    expect(calls[0]?.responseType).toBe("blob");
  });

  it("formats the current month as YYYY-MM", () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
