/**
 * The filters of the history of the attendance.
 *
 * The servant filters the history by date, by status and by member.
 * The list of the members is fetched on demand (the combobox opens
 * it), and a filter is only sent when it carries a value.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  HistoryFilters,
  type HistoryFilterValues,
} from "@/modules/attendance/components/HistoryFilters";
import { recordApiCalls } from "@/test/recordingAdapter";
import { makeQueryClient } from "@/test/pageHarness";
import { saveAuth } from "@/lib/auth";

/** The component needs a query client (it fetches the members). */
function renderFilters(
  values: HistoryFilterValues,
  onChange: (values: HistoryFilterValues) => void,
) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <HistoryFilters values={values} onChange={onChange} />
    </QueryClientProvider>,
  );
}

describe("the filters of the history", () => {
  it("shows the dates and the status", () => {
    renderFilters({}, () => undefined);

    expect(screen.getByLabelText(/من|from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/إلى|to/i)).toBeInTheDocument();
  });

  it("applies the dates the servant chooses, on the Thursday of the week", () => {
    const onChange = vi.fn();
    renderFilters({}, onChange);

    // A Wednesday: the meetings are on Thursday, so the filter snaps
    // to the Thursday of that week.
    fireEvent.change(screen.getByLabelText(/من|from/i), {
      target: { value: "2026-10-07" },
    });
    fireEvent.click(screen.getByRole("button", { name: /تطبيق|apply/i }));

    // The meetings are on Thursday: the Wednesday of the week of the
    // meeting snaps to the Thursday of that week.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-10-01" }),
    );
  });

  it("opens the list of the members when the combobox is clicked", async () => {
    saveAuth(
      {
        accessToken: "token",
        user: {
          id: "u1",
          email: "admin@example.com",
          first_name: "خادم",
          last_name: "",
          phone: null,
          date_of_birth: null,
          address: null,
          avatar: null,
          role: "ADMIN",
          status: "ACTIVE",
          public_id: "A-1",
          created_at: "2026-01-01T00:00:00Z",
          has_password: true,
          email_verified: true,
        },
      },
      false,
    );

    const recorder = recordApiCalls({
      data: [
        {
          id: "u1",
          first_name: "محمود",
          last_name: "عبد الله",
          email: "mahmoud@example.com",
        },
      ],
    });
    recorder.install();

    renderFilters({}, () => undefined);

    // The member picker (the status is a select too).
    fireEvent.click(screen.getByRole("combobox", { name: /العضو|member/i }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText(/العضو|member/i)).toBeInTheDocument(),
    );
  });
});
