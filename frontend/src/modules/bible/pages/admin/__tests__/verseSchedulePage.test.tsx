/**
 * The schedule of a verse.
 *
 * The publication of the verses of the week: the servant chooses the
 * day and the hour, and the scheduler publishes the verse when the
 * moment comes. A verse that is already scheduled shows the warning
 * and the two ways out (reschedule or cancel); a published verse is
 * never scheduled again.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import VerseSchedulePage from "@/modules/bible/pages/admin/VerseSchedulePage";

const VERSE = {
  id: "verse-1",
  title: "آية الاختبار",
  subtitle: null,
  verse_reference: "١ يوئيل ٣:١",
  book: "يوئيل",
  chapter: 3,
  verse_start: 1,
  verse_end: null,
  status: "DRAFT" as const,
  published_at: null,
  week_start_date: null,
  created_by_user: null,
  created_at: "2026-10-01T00:00:00Z",
  text: "اقرؤوا لي يا سيدي...",
  reflection: null,
  image: null,
  translation: null,
  opens: 0,
  is_read: false,
  quiz_summary: null,
  schedule: null,
};

const SCHEDULE = {
  id: "schedule-1",
  verse_id: "verse-1",
  scheduled_at: "2026-12-01T18:00:00Z",
  status: "SCHEDULED" as const,
  published_at: null,
  created_by_user: "admin-1",
  created_at: "2026-10-20T00:00:00Z",
};

describe("the schedule of a verse", () => {
  it("shows the verse and waits for the day and the hour", async () => {
    renderPage(<VerseSchedulePage />, {
      admin: true,
      route: "/admin/bible-verses/verse-1/schedule",
      path: "/admin/bible-verses/:verseId/schedule",
      answers: { "/bible-verses/verse-1": VERSE },
    });

    await waitFor(
      () => expect(screen.getByText("آية الاختبار")).toBeInTheDocument(),
      { timeout: 5_000 },
    );

    // The button is disabled until the day and the hour are chosen.
    const submit = screen.getByRole("button", { name: /جدولة|احجز|schedule/i });
    expect(submit).toBeDisabled();

    const date = document.querySelector('input[type="date"]');
    const time = document.querySelector('input[type="time"]');
    expect(date).not.toBeNull();
    expect(time).not.toBeNull();
  });

  it("warns when the verse is already scheduled, and offers the two ways out", async () => {
    renderPage(<VerseSchedulePage />, {
      admin: true,
      route: "/admin/bible-verses/verse-1/schedule",
      path: "/admin/bible-verses/:verseId/schedule",
      answers: {
        "/bible-verses/verse-1": { ...VERSE, schedule: SCHEDULE },
      },
    });

    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /إعادة الجدولة|reschedule/i }),
        ).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    expect(
      screen.getByRole("button", { name: /إلغاء|إلغاء الجدولة|cancel/i }),
    ).toBeInTheDocument();
    // The form is not shown when the verse is already scheduled.
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it("does not schedule a verse that is already published", async () => {
    renderPage(<VerseSchedulePage />, {
      admin: true,
      route: "/admin/bible-verses/verse-1/schedule",
      path: "/admin/bible-verses/:verseId/schedule",
      answers: {
        "/bible-verses/verse-1": { ...VERSE, status: "PUBLISHED" },
      },
    });

    await waitFor(
      () => expect(screen.getByText(/منشورة|published/i)).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });
});
