/**
 * The points of the member and his notifications.
 *
 * Two screens of the personal area of the member: the points he earned
 * and the messages the platform sent him.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import PointsPage from "@/modules/points/pages/PointsPage";
import { NotificationsPage } from "@/modules/notifications/pages/NotificationsPage";

const POINTS = {
  total_points: 120,
  this_month_points: 40,
  this_week_points: 15,
};

const MONTHLY = {
  month: "2026-10",
  points: 40,
  month_label: "أكتوبر ٢٠٢٦",
};

const NOTIFICATION = {
  id: "n1",
  type: "ANNOUNCEMENT" as const,
  title_ar: "اختبار جديد",
  title_en: "A new quiz",
  message_ar: "الاختبار متاح الآن",
  message_en: "The quiz is available now",
  data: null,
  is_read: false,
  is_broadcast: false,
  created_at: "2026-10-22T10:00:00Z",
};

describe("the points of the member", () => {
  it("shows the points of the member", async () => {
    renderPage(<PointsPage />, {
      answers: {
        "/points/me/monthly": [MONTHLY],
        "/points/me": POINTS,
      },
    });

    await waitFor(() => expect(screen.getByText("120")).toBeInTheDocument(), {
      timeout: 5_000,
    });
    expect(screen.getByText("40")).toBeInTheDocument();
  });
});

describe("the notifications of the member", () => {
  it("shows the notifications", async () => {
    renderPage(<NotificationsPage />, {
      answers: {
        "/notifications/summary": { unread_count: 1, total_count: 1 },
        "/notifications": {
          items: [NOTIFICATION],
          total: 1,
          page: 1,
          size: 20,
          pages: 1,
          has_next: false,
        },
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText("اختبار جديد").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });

  it("says that there is no notification", async () => {
    renderPage(<NotificationsPage />, {
      answers: {
        "/notifications/summary": { unread_count: 0, total_count: 0 },
        "/notifications": {
          items: [],
          total: 0,
          page: 1,
          size: 20,
          pages: 1,
          has_next: false,
        },
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText(/لا توجد|لا يوجد|/).length).toBeGreaterThan(
          0,
        ),
      { timeout: 5_000 },
    );
  });
});
