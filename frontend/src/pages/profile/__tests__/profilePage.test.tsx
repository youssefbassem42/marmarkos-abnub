/**
 * The page of the profile of the member.
 *
 * It is the page every member opens to change his details, his
 * password and his attendance PIN. It was rendered by nobody: a field
 * that lost its label, a form that sent the wrong body or a card of the
 * attendance that crashed on an empty answer would have reached the
 * members.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
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

  it("offers a way back to the landing page", () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    renderPage(<ProfilePage />, {
      answers: { "/attendance/me": ATTENDANCE },
    });

    const back = screen.getByRole("link", { name: "رجوع" });
    expect(back).toHaveAttribute("href", "/");
  });

  it("refuses a password that does not match the confirmation", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    const harness = renderPage(<ProfilePage />, {
      answers: { "/attendance/me": ATTENDANCE },
    });

    await waitFor(() =>
      expect(screen.getByLabelText(/كلمة المرور الحالية/)).toBeVisible(),
    );

    fireEvent.change(screen.getByLabelText(/كلمة المرور الحالية/), {
      target: { value: "OldPass!2026" },
    });
    fireEvent.change(screen.getByLabelText("كلمة المرور الجديدة"), {
      target: { value: "NewPass!2026" },
    });
    fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور الجديدة"), {
      target: { value: "OtherPass!2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /تحديث كلمة المرور/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/متطابقتين|match/i),
    );
    // Nothing was sent to the server.
    expect(
      harness.calls.filter((call) => call.url.includes("/users/me/password")),
    ).toHaveLength(0);
  });

  it("refuses a weak password", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    const harness = renderPage(<ProfilePage />, {
      answers: { "/attendance/me": ATTENDANCE },
    });

    await waitFor(() =>
      expect(screen.getByLabelText(/كلمة المرور الحالية/)).toBeVisible(),
    );

    fireEvent.change(screen.getByLabelText(/كلمة المرور الحالية/), {
      target: { value: "OldPass!2026" },
    });
    fireEvent.change(screen.getByLabelText("كلمة المرور الجديدة"), {
      target: { value: "weak" },
    });
    fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور الجديدة"), {
      target: { value: "weak" },
    });
    fireEvent.click(screen.getByRole("button", { name: /تحديث كلمة المرور/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /أحرف كبيرة|رمز خاص|weak/i,
      ),
    );
    expect(
      harness.calls.filter((call) => call.url.includes("/users/me/password")),
    ).toHaveLength(0);
  });

  it("changes the password when the member fills the three fields", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    const harness = renderPage(<ProfilePage />, {
      answers: { "/attendance/me": ATTENDANCE },
    });

    await waitFor(() =>
      expect(screen.getByLabelText(/كلمة المرور الحالية/)).toBeVisible(),
    );

    fireEvent.change(screen.getByLabelText(/كلمة المرور الحالية/), {
      target: { value: "OldPass!2026" },
    });
    fireEvent.change(screen.getByLabelText("كلمة المرور الجديدة"), {
      target: { value: "NewPass!2026" },
    });
    fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور الجديدة"), {
      target: { value: "NewPass!2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /تحديث كلمة المرور/i }));

    await waitFor(() =>
      expect(
        harness.calls.filter((call) => call.url.includes("/users/me/password")),
      ).toHaveLength(1),
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
