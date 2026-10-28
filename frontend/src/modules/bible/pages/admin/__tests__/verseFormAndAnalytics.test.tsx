/**
 * The form of a verse and the analytics of the verses.
 *
 * The two biggest pages of the administration of the verses: the form
 * the servant fills every week, and the page that says how many
 * members read it.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import VerseFormPage from "@/modules/bible/pages/admin/VerseFormPage";
import VerseAnalyticsPage from "@/modules/bible/pages/admin/VerseAnalyticsPage";

const VERSE = {
  id: "verse-1",
  title: "آية الاختبار",
  subtitle: null,
  verse_reference: "١ يوئيل ٣:١",
  book: "يوئيل",
  chapter: 3,
  verse_start: 1,
  verse_end: null,
  status: "PUBLISHED" as const,
  published_at: "2026-10-20T00:00:00Z",
  week_start_date: "2026-10-19",
  created_by_user: null,
  created_at: "2026-10-01T00:00:00Z",
  text: "اقرؤوا لي يا سيدي...",
  reflection: "تأمل في الآية",
  image: null,
  translation: "الترجمة",
  opens: 12,
  is_read: true,
  quiz_summary: null,
  schedule: null,
};

describe("the form of a verse", () => {
  it("shows the fields of the verse that is edited", async () => {
    renderPage(<VerseFormPage />, {
      admin: true,
      route: "/admin/verses/verse-1/edit",
      path: "/admin/verses/:verseId/edit",
      answers: { "/bible-verses/verse-1": VERSE },
    });

    await waitFor(
      () =>
        expect(screen.getByDisplayValue("آية الاختبار")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    expect(
      screen.getByDisplayValue("اقرؤوا لي يا سيدي..."),
    ).toBeInTheDocument();
  });

  it("saves the verse as a draft", async () => {
    const harness = renderPage(<VerseFormPage />, {
      admin: true,
      route: "/admin/verses/verse-1/edit",
      path: "/admin/verses/:verseId/edit",
      answers: { "/bible-verses/verse-1": VERSE },
    });

    await waitFor(
      () =>
        expect(screen.getByDisplayValue("آية الاختبار")).toBeInTheDocument(),
      { timeout: 5_000 },
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: /حفظ كمسودة|save/i })[0],
    );

    await waitFor(() =>
      expect(
        harness.calls.filter((call) => call.method === "patch"),
      ).toHaveLength(1),
    );
  });

  it("refuses to save a verse without a title", async () => {
    const harness = renderPage(<VerseFormPage />, {
      admin: true,
      route: "/admin/verses/verse-1/edit",
      path: "/admin/verses/:verseId/edit",
      answers: { "/bible-verses/verse-1": VERSE },
    });

    await waitFor(
      () =>
        expect(screen.getByDisplayValue("آية الاختبار")).toBeInTheDocument(),
      { timeout: 5_000 },
    );

    fireEvent.change(screen.getByDisplayValue("آية الاختبار"), {
      target: { value: "" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /حفظ كمسودة|save/i })[0],
    );

    await waitFor(() =>
      expect(screen.getByText(/العنوان مطلوب/)).toBeInTheDocument(),
    );
    // Nothing was sent.
    expect(
      harness.calls.filter((call) => call.method === "patch"),
    ).toHaveLength(0);
  });
});

describe("the analytics of the verses", () => {
  it("shows the overview of the engagement", async () => {
    renderPage(<VerseAnalyticsPage />, {
      admin: true,
      answers: {
        "/bible-verses/analytics/quick-stats": {
          this_week: 4,
          this_month: 12,
          avg_reads: 30,
          top_verse_reference: "١ يوئيل ٣:١",
        },
        "/bible-verses/analytics/overview": {
          total_posts: 12,
          published: 10,
          total_opens: 300,
          total_reads: 240,
          read_rate: 80,
        },
      },
    });

    // The numbers are written with the digits of the locale.
    const format = new Intl.NumberFormat("ar-EG");
    await waitFor(
      () => expect(screen.getByText(format.format(300))).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    expect(screen.getByText(format.format(240))).toBeInTheDocument();
  });
});
