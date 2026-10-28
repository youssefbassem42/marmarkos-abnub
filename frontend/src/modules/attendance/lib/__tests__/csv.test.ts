/**
 * The export of the attendance in CSV.
 *
 * The export walks **every** page of the filtered set (not only the
 * page on the screen) and writes UTF-8 with a BOM, so Arabic opens
 * correctly in Excel. The escaping of the cells is the part that bites:
 * a name with a comma or a quote must not break the columns.
 */

import { describe, expect, it, vi } from "vitest";

import { buildAttendanceCsv } from "@/modules/attendance/lib/csv";
import { recordApiCalls, type RecordingAdapter } from "@/test/recordingAdapter";

let recorder: RecordingAdapter | undefined;

afterEach(() => {
  recorder?.restore();
  recorder = undefined;
});

/** Read the bytes of a blob (jsdom has no `blob.text()`). */
async function blobBytes(blob: Blob): Promise<Uint8Array> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buffer);
}

/** The text of a blob, without the BOM. */
async function blobText(blob: Blob): Promise<string> {
  const bytes = await blobBytes(blob);
  return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
}

const RECORD = {
  meeting_date: "2026-10-22",
  user_name: "محمود",
  check_in_at: "2026-10-22T19:03:00Z",
  status: "PRESENT",
  recorded_by_name: "الخادم",
};

describe("the export of the attendance", () => {
  it("writes the header and the records", async () => {
    recorder = recordApiCalls({
      attendance_records: [RECORD],
      total_count: 1,
      page: 1,
      size: 100,
      pages: 1,
      has_next: false,
    });
    recorder.install();

    const blob = await buildAttendanceCsv({
      headers: ["التاريخ", "الاسم"],
      formatRow: (record) => [record.meeting_date, record.user_name],
    });

    const text = await blobText(blob);
    expect(text).toContain("التاريخ,الاسم");
    expect(text).toContain("2026-10-22,محمود");
  });

  it("starts with the BOM, so Excel reads the Arabic", async () => {
    recorder = recordApiCalls({
      attendance_records: [RECORD],
      total_count: 1,
      page: 1,
      size: 100,
      pages: 1,
      has_next: false,
    });
    recorder.install();

    const blob = await buildAttendanceCsv({
      headers: ["الاسم"],
      formatRow: (record) => [record.user_name],
    });

    const bytes = await blobBytes(blob);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("escapes the commas and the quotes of a cell", async () => {
    recorder = recordApiCalls({
      attendance_records: [RECORD],
      total_count: 1,
      page: 1,
      size: 100,
      pages: 1,
      has_next: false,
    });
    recorder.install();

    const blob = await buildAttendanceCsv({
      headers: ["الاسم"],
      formatRow: () => ['محمود, عبد الله "الخادم"'],
    });

    const text = await blobText(blob);
    expect(text).toContain('"محمود, عبد الله ""الخادم"""');
  });

  it("walks every page of the filtered set", async () => {
    recorder = recordApiCalls({
      attendance_records: [RECORD],
      total_count: 2,
      page: 1,
      size: 100,
      pages: 2,
      has_next: true,
    });
    recorder.install();

    await buildAttendanceCsv({
      headers: ["الاسم"],
      formatRow: (record) => [record.user_name],
    });

    const pages = recorder.calls
      .map((call) => (call.params as { page?: number } | undefined)?.page)
      .filter((page): page is number => typeof page === "number");
    expect(pages).toEqual([1, 2]);
  });

  it("stops when the server has no more pages", async () => {
    recorder = recordApiCalls({
      attendance_records: [RECORD],
      total_count: 1,
      page: 1,
      size: 100,
      pages: 1,
      has_next: false,
    });
    recorder.install();

    await buildAttendanceCsv({
      headers: ["الاسم"],
      formatRow: (record) => [record.user_name],
    });

    expect(recorder.calls).toHaveLength(1);
  });
});
