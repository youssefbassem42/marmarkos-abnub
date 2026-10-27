/**
 * The date/time helpers and the download helper.
 *
 * They are the small pieces every screen leans on: a wrong clock or a
 * wrong file name is visible to the members.
 */

import { describe, expect, it, vi } from "vitest";

import { downloadBlob } from "@/lib/download";
import {
  formatClock,
  formatMonthYear,
  formatRelativeDate,
  formatTimeAgo,
  formatWeekRange,
} from "@/lib/datetime";

describe("formatClock", () => {
  it("formats the seconds as MM:SS", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(9)).toBe("00:09");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(600)).toBe("10:00");
  });
});

describe("formatRelativeDate", () => {
  it("says 'just now' under a minute", () => {
    const now = new Date().toISOString();

    expect(formatRelativeDate(now)).toBe("just now");
    expect(formatRelativeDate(now, "ar")).toBe("الآن");
  });

  it("counts the minutes, the hours and the days", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString();

    expect(formatRelativeDate(twoHoursAgo)).toContain("2 hours ago");
    expect(formatRelativeDate(threeDaysAgo)).toContain("3 days ago");
  });

  it("counts the months and the years", () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
    const twoYearsAgo = new Date(
      Date.now() - 2 * 365 * 86400 * 1000,
    ).toISOString();

    expect(formatRelativeDate(twoMonthsAgo)).toContain("2 months ago");
    expect(formatRelativeDate(twoYearsAgo)).toContain("2 years ago");
  });

  it("is the same as formatTimeAgo", () => {
    const date = new Date(Date.now() - 3600 * 1000).toISOString();

    expect(formatTimeAgo(date)).toBe(formatRelativeDate(date));
  });
});

describe("formatWeekRange", () => {
  it("names the week and its two ends", () => {
    const range = formatWeekRange("2026-09-21", "en");

    expect(range).toContain("This Week");
    expect(range).toContain("–");
  });

  it("has an Arabic label", () => {
    expect(formatWeekRange("2026-09-21", "ar")).toContain("هذا الأسبوع");
  });
});

describe("formatMonthYear", () => {
  it("names the month and the year", () => {
    expect(formatMonthYear("2026-09-01", "en")).toContain("2026");
    expect(formatMonthYear("2026-09-01", "en")).toContain("September");
  });
});

describe("downloadBlob", () => {
  it("clicks an anchor with the file name and releases the URL", () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadBlob(new Blob(["a,b,c"], { type: "text/csv" }), "members.csv");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    // The anchor must not stay in the document.
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });
});
