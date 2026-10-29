import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { AdminNotificationsPage } from "@/modules/notifications/pages/AdminNotificationsPage";

describe("the administration of the notifications", () => {
  it("offers a way back to the dashboard of the administration", () => {
    renderPage(<AdminNotificationsPage />, {
      admin: true,
      route: "/admin/notifications",
      answers: {
        "/notifications/summary": {
          unread_count: 0,
          tab_counts: {
            all: 0,
            unread: 0,
            announcements: 0,
            reminders: 0,
            system: 0,
          },
        },
        "/notifications": {
          items: [],
          total: 0,
          page: 1,
          size: 20,
          pages: 0,
          has_next: false,
        },
      },
    });

    const back = screen.getByRole("link", { name: "رجوع" });
    expect(back).toBeVisible();
    expect(back).toHaveAttribute("href", "/admin/dashboard");
  });
});
