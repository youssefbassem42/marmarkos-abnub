/**
 * The card of the attendance PIN of the member.
 *
 * The member chooses his own PIN (five digits) to check in when the
 * camera of the church does not work. The PIN never comes back from the
 * server: only whether one exists. The PIN is unique in the platform,
 * so the server answers 409 when another member already holds it.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { AttendancePinCard } from "@/pages/profile/AttendancePinCard";

/** Type the five digits of the PIN, one box after the other. */
function typePin(pin: string) {
  const boxes = screen.getAllByRole("textbox");
  expect(boxes).toHaveLength(5);
  pin.split("").forEach((digit, index) => {
    fireEvent.change(boxes[index], { target: { value: digit } });
  });
}

describe("the card of the attendance PIN", () => {
  it("asks for a PIN when the member has none", async () => {
    renderPage(<AttendancePinCard />, {
      answers: { "/users/me/attendance-pin": { set: false } },
    });

    await waitFor(
      () => expect(screen.getAllByRole("textbox")).toHaveLength(5),
      { timeout: 5_000 },
    );
  });

  it("shows the PIN of the member as dots, never as digits", async () => {
    renderPage(<AttendancePinCard />, {
      answers: { "/users/me/attendance-pin": { set: true } },
    });

    await waitFor(() => expect(screen.getByText("•••••")).toBeInTheDocument(), {
      timeout: 5_000,
    });
    // The five boxes are gone: the PIN exists.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("saves the PIN when the five digits are typed", async () => {
    renderPage(<AttendancePinCard />, {
      answers: { "/users/me/attendance-pin": { set: false } },
    });

    await waitFor(
      () => expect(screen.getAllByRole("textbox")).toHaveLength(5),
      { timeout: 5_000 },
    );

    typePin("12345");

    await waitFor(
      () =>
        expect(screen.getByRole("status")).toHaveTextContent(/تم|حُفظ|saved/i),
      { timeout: 5_000 },
    );
  });

  it("says that the PIN is taken when the server answers 409", async () => {
    renderPage(<AttendancePinCard />, {
      answers: {
        "/users/me/attendance-pin": { set: false },
        "PUT /users/me/attendance-pin": {
          status: 409,
          body: { code: "conflict" },
        },
      },
    });

    await waitFor(
      () => expect(screen.getAllByRole("textbox")).toHaveLength(5),
      { timeout: 5_000 },
    );

    typePin("12345");

    await waitFor(
      () => {
        const statuses = screen.queryAllByRole("status");
        expect(statuses).toHaveLength(1);
        expect(statuses[0]).toHaveTextContent(/مستخدم|محجوز|taken/i);
      },
      { timeout: 4_000 },
    );
  });
});
