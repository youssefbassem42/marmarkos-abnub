/**
 * The components of the attendance screen.
 *
 * They are what the person at the door sees while the members scan
 * their code: the badge of a status, the result of a scan, the tiles
 * of the statistics.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { CheckCircle2 } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceStatusBadge } from "@/modules/attendance/components/AttendanceStatusBadge";
import { MeetingStatsCard } from "@/modules/attendance/components/MeetingStatsCard";
import { ScanResultCard } from "@/modules/attendance/components/ScanResultCard";
import { StatTile } from "@/modules/attendance/components/StatTile";
import { recordApiCalls, type RecordingAdapter } from "@/test/recordingAdapter";

let recorder: RecordingAdapter | undefined;

afterEach(() => {
  recorder?.restore();
  recorder = undefined;
});

describe("AttendanceStatusBadge", () => {
  it("names the status instead of only colouring it", () => {
    render(<AttendanceStatusBadge status="PRESENT" />);

    expect(screen.getByText("حاضر")).toBeInTheDocument();
  });

  it("has a badge for every status", () => {
    const statuses = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;

    for (const status of statuses) {
      const { unmount } = render(<AttendanceStatusBadge status={status} />);
      expect(screen.getByText(/حاضر|متأخر|غائب|بعذر/)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("ScanResultCard", () => {
  const record = {
    id: "a1",
    user_id: "u1",
    user_name: "محمود",
    meeting_date: "2026-09-24",
    meeting_index_in_month: 4,
    check_in_at: "2026-09-24T19:03:00Z",
    status: "PRESENT" as const,
    method: "QR_SCAN" as const,
    recorded_by: "u2",
    recorded_by_name: "الخادم",
  };

  it("announces a successful scan as a status", () => {
    render(
      <ScanResultCard
        variant="success"
        title="تم تسجيل الحضور"
        record={record}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("محمود")).toBeInTheDocument();
  });

  it("announces a refused scan as an alert", () => {
    render(<ScanResultCard variant="error" title="كود غير صالح" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("كود غير صالح")).toBeInTheDocument();
  });

  it("offers to scan the next member", () => {
    const onScanNext = vi.fn();
    render(
      <ScanResultCard
        variant="success"
        title="تم تسجيل الحضور"
        record={record}
        onScanNext={onScanNext}
      />,
    );

    const button = screen.getByRole("button");
    button.click();

    expect(onScanNext).toHaveBeenCalledOnce();
  });
});

describe("StatTile", () => {
  it("shows the label and the value", () => {
    render(
      <StatTile
        Icon={CheckCircle2}
        iconClassName="text-mint"
        value={12}
        label="حاضر"
      />,
    );

    expect(screen.getByText("حاضر")).toBeInTheDocument();
    // The number is formatted for the Arabic locale.
    expect(screen.getByText("١٢")).toBeInTheDocument();
  });
});

describe("MeetingStatsCard", () => {
  it("shows the numbers of the meeting", async () => {
    recorder = recordApiCalls({
      meeting_date: "2026-09-24",
      summary: {
        total_present: 10,
        total_late: 2,
        total_absent: 3,
        total_excused: 1,
        total_expected: 16,
        attendance_rate: 75,
        is_final: true,
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MeetingStatsCard />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // The numbers are formatted for the Arabic locale.
    await waitFor(() => expect(screen.getByText("١٠")).toBeInTheDocument());
    expect(screen.getByText("٢")).toBeInTheDocument();

    recorder.restore();
  });
});
