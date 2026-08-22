import { attendanceApi } from "../api";
import type { AttendanceStatusValue } from "../types";

const MAX_PAGE_SIZE = 100;

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Client-side CSV export of the full filtered set (not just one page):
 * iterates history pages at the backend max size. Emits UTF-8 with a
 * BOM so Arabic opens correctly in Excel. No new dependency.
 */
export async function buildAttendanceCsv(options: {
  headers: string[];
  formatRow: (record: {
    meeting_date: string;
    user_name: string;
    check_in_at: string;
    status: AttendanceStatusValue | string;
    recorded_by_name: string;
  }) => string[];
  filters?: Record<string, string | number | undefined>;
}): Promise<Blob> {
  const rows: string[] = [options.headers.map(escapeCell).join(",")];

  let page = 1;
  for (;;) {
    const response = await attendanceApi.getAttendanceHistory({
      ...options.filters,
      page,
      size: MAX_PAGE_SIZE,
    });

    for (const record of response.attendance_records) {
      rows.push(options.formatRow(record).map(escapeCell).join(","));
    }

    if (page >= response.pages || response.attendance_records.length === 0)
      break;
    page += 1;
  }

  // BOM first so Excel detects UTF-8.
  return new Blob([`\uFEFF${rows.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
}

/** Trigger a browser download for a generated CSV blob. */
export function downloadCsv(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
