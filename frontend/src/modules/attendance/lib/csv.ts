import { createCsvBlob, downloadCsv } from "@/lib/csv";
import { attendanceApi } from "../api";
import type { AttendanceStatusValue } from "../types";

const MAX_PAGE_SIZE = 100;

export { downloadCsv };

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
  const rows: string[][] = [];

  let page = 1;
  for (;;) {
    const response = await attendanceApi.getAttendanceHistory({
      ...options.filters,
      page,
      size: MAX_PAGE_SIZE,
    });

    for (const record of response.attendance_records) {
      rows.push(options.formatRow(record));
    }

    if (page >= response.pages || response.attendance_records.length === 0)
      break;
    page += 1;
  }

  return createCsvBlob(options.headers, rows);
}
