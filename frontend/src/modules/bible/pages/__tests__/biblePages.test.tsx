/**
 * The pages of the verses - the feed of the member.
 *
 * This is where a member starts: the feed of the published verses, the
 * verse itself, the quiz that goes with it. The end-to-end tests walk
 * this path; these tests pin the details of it.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import {
  VERSE_CARD as VERSE_CARD_FIXTURE,
  VERSE_DETAIL as VERSE_DETAIL_FIXTURE,
} from "@/test/fixtures/bible";
import BibleVersesPage from "@/modules/bible/pages/BibleVersesPage";
import VerseDetailPage from "@/modules/bible/pages/VerseDetailPage";

const VERSE_CARD = {
  ...VERSE_CARD_FIXTURE,
  excerpt: "اقرؤوا لي يا سيدي...",
};

const FEED = {
  items: [VERSE_CARD],
  total: 1,
  page: 1,
  size: 20,
  pages: 1,
  has_next: false,
};

const DETAIL = {
  ...VERSE_DETAIL_FIXTURE,
  text: "اقرؤوا لي يا سيدي...",
  reflection: "تأمل في الآية",
  image: null,
  translation: "الترجمة",
  verse_end: null,
  created_by_user: null,
};

describe("the feed of the verses", () => {
  it("shows the published verses", async () => {
    renderPage(<BibleVersesPage />, {
      answers: {
        "/bible-verses/published": FEED,
        "/bible-verses/current": VERSE_CARD,
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText("آية الاختبار").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });

  it("says that there is nothing to read", async () => {
    renderPage(<BibleVersesPage />, {
      answers: {
        "/bible-verses/published": { ...FEED, items: [], total: 0 },
        "/bible-verses/current": null,
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

describe("the page of a verse", () => {
  it("shows the verse and its reflection", async () => {
    renderPage(<VerseDetailPage />, {
      path: "/bible-verses/:verseId",
      route: "/bible-verses/verse-1",
      answers: {
        "/bible-verses/verse-1": DETAIL,
        "/bible-verses/verse-1/open": { status: 204 },
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText("آية الاختبار").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
    expect(screen.getAllByText(/اقرؤوا لي/).length).toBeGreaterThan(0);
  });

  it("keeps the quiz locked until the verse is read", async () => {
    renderPage(<VerseDetailPage />, {
      path: "/bible-verses/:verseId",
      route: "/bible-verses/verse-1",
      answers: {
        "/bible-verses/verse-1": DETAIL,
        "/bible-verses/verse-1/open": { status: 204 },
      },
    });

    // The rule of the module: the quiz opens after the reading.
    await waitFor(
      () => expect(screen.getByRole("button", { name: /مقفل/ })).toBeDisabled(),
      { timeout: 5_000 },
    );
    expect(
      screen.queryByRole("link", { name: "ابدأ الاختبار" }),
    ).not.toBeInTheDocument();
  });

  it("offers the quiz once the verse is read", async () => {
    renderPage(<VerseDetailPage />, {
      path: "/bible-verses/:verseId",
      route: "/bible-verses/verse-1",
      answers: {
        "/bible-verses/verse-1": { ...DETAIL, is_read: true },
        "/bible-verses/verse-1/open": { status: 204 },
      },
    });

    await waitFor(
      () =>
        expect(
          screen.getByRole("link", { name: /ابدأ الاختبار/ }),
        ).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });
});
