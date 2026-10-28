/**
 * The page of the profile of the member.
 *
 * It is the page every member opens to change his details, his
 * password and his attendance PIN. It was rendered by nobody: a field
 * that lost its label, a form that sent the wrong body or a card of the
 * attendance that crashed on an empty answer would have reached the
 * members.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { saveAuth } from "@/lib/auth";
import type { RegisteredUser } from "@/lib/api";

const MEMBER: RegisteredUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "member@example.com",
  first_name: "محمود",
  last_name: "عبد الله",
  phone: "+201000000000",
  date_of_birth: "2000-01-01",
  address: "أبنوب",
  avatar: null,
  role: "MEMBER",
  status: "ACTIVE",
  public_id: "M-0001",
  created_at: "2026-01-01T00:00:00Z",
  has_password: true,
  email_verified: true,
};

const ATTENDANCE = {
  year: 2026,
  month: 10,
  total_meetings: 4,
  meetings_held: 3,
  attended_count: 2,
  attendance_rate: 67,
  records: [],
};

describe("the page of the profile", () => {
  it("shows the details of the member", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    renderPage(<ProfilePage />, {
      answers: { "/attendance/me": ATTENDANCE },
    });

    await waitFor(() =>
      expect(screen.getByDisplayValue("محمود")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("+201000000000")).toBeInTheDocument();
  });

  it("shows the attendance of the month", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    renderPage(<ProfilePage />, {
      answers: { "/attendance/me": ATTENDANCE },
    });

    await waitFor(() =>
      expect(screen.getAllByText(/حضور/).length).toBeGreaterThan(0),
    );
  });

  it("asks for the current password before changing it", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    renderPage(<ProfilePage />, {
      answers: { "/attendance/me": ATTENDANCE },
    });

    await waitFor(() =>
      expect(screen.getByLabelText(/كلمة المرور الحالية/)).toBeVisible(),
    );
    expect(screen.getByLabelText("كلمة المرور الجديدة")).toBeVisible();
    expect(screen.getByLabelText("تأكيد كلمة المرور الجديدة")).toBeVisible();
  });
});
