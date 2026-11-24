/**
 * The QR code of the member on the page of the profile.
 *
 * The member saves the code once and shows it to the servant without
 * opening the platform: the code therefore does **not** change from one
 * visit to the next, and only the explicit button replaces it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderPage } from "@/test/pageHarness";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { clearAuth, saveAuth } from "@/lib/auth";
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

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

describe("the QR code of the member", () => {
  afterEach(() => {
    clearAuth();
  });

  it("reads the code without changing it", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    const calls = renderPage(<ProfilePage />, {
      answers: { "/users/me/qr": SVG },
    });

    await waitFor(() => {
      expect(
        calls.calls.some((call) => call.url.includes("/users/me/qr")),
      ).toBe(true);
    });

    // The page opens the code with a GET: it never replaces it.
    const qrCalls = calls.calls.filter((call) =>
      call.url.includes("/users/me/qr"),
    );
    expect(qrCalls.every((call) => call.method === "get")).toBe(true);
  });

  it("offers the member to save the code as an image", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    renderPage(<ProfilePage />, {
      answers: { "/users/me/qr": SVG },
    });

    expect(
      await screen.findByRole("button", { name: /حفظ الرمز كصورة/ }),
    ).toBeInTheDocument();
  });

  it("asks the member before changing the code", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    const user = userEvent.setup();
    const calls = renderPage(<ProfilePage />, {
      answers: {
        "/users/me/qr": SVG,
        "POST /users/me/qr/regenerate": SVG,
      },
    });

    await user.click(
      await screen.findByRole("button", { name: /تغيير رمز QR/ }),
    );

    // The confirmation explains that the saved copies stop working.
    expect(await screen.findByText("تغيير رمز الحضور")).toBeInTheDocument();
    expect(
      screen.getByText(/ستُرفض النسخ التي حفظتها سابقًا/),
    ).toBeInTheDocument();

    // Nothing changed yet: the member has not confirmed.
    expect(
      calls.calls.some((call) => call.url.includes("/users/me/qr/regenerate")),
    ).toBe(false);

    // The confirmation of the dialog carries the same label: it is the
    // **last** button of that name (the one of the dialog) that
    // replaces the code.
    const buttons = screen.getAllByRole("button", { name: /تغيير رمز QR/ });
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(
        calls.calls.some(
          (call) =>
            call.method === "post" &&
            call.url.includes("/users/me/qr/regenerate"),
        ),
      ).toBe(true);
    });
  });

  it("does not change the code when the member cancels", async () => {
    saveAuth({ accessToken: "token", user: MEMBER }, false);
    const user = userEvent.setup();
    const calls = renderPage(<ProfilePage />, {
      answers: { "/users/me/qr": SVG },
    });

    await user.click(
      await screen.findByRole("button", { name: /تغيير رمز QR/ }),
    );
    await user.click(await screen.findByRole("button", { name: /إلغاء/ }));

    await waitFor(() => {
      expect(
        calls.calls.some((call) =>
          call.url.includes("/users/me/qr/regenerate"),
        ),
      ).toBe(false);
    });
  });
});
