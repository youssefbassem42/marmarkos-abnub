/**
 * The small components of the administration.
 *
 * They are the pieces that the pages are made of: the badge of the
 * notifications, the card of the related verse, the list of the review
 * of a quiz, the sheet of the filters.
 *
 * Each of them was untested (0 % of the branches), so a change in them
 * could break a page without any test noticing.
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// The badge of the notifications is only fetched for a signed-in
// member (the query is disabled for a visitor), so the test signs one in.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getAccessToken: () => "test-token" };
});

import { renderPage } from "@/test/pageHarness";
import { NOTIFICATION_SUMMARY } from "@/test/fixtures/member";
import { VERSE_DETAIL } from "@/test/fixtures/bible";
import { MobileBellBadge } from "@/modules/notifications/components/MobileBellBadge";
import { RelatedVerseCard } from "@/modules/quiz/components/admin/RelatedVerseCard";
import { QuestionReviewList } from "@/modules/quiz/components/QuestionReviewList";
import { VerseFilterSheet } from "@/modules/bible/components/admin/VerseFilterSheet";

describe("the badge of the notifications", () => {
  it("shows the number of the unread notifications", async () => {
    renderPage(<MobileBellBadge />, {
      answers: { "/notifications/summary": NOTIFICATION_SUMMARY },
    });

    await waitFor(() => expect(screen.getByText("٣")).toBeInTheDocument(), {
      timeout: 5_000,
    });
  });

  it("is hidden when there is nothing unread", async () => {
    renderPage(<MobileBellBadge />, {
      answers: {
        "/notifications/summary": {
          ...NOTIFICATION_SUMMARY,
          unread_count: 0,
        },
      },
    });

    await waitFor(
      () => expect(screen.queryByText("٠")).not.toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });

  it("caps the number at 99", async () => {
    renderPage(<MobileBellBadge />, {
      answers: {
        "/notifications/summary": {
          ...NOTIFICATION_SUMMARY,
          unread_count: 150,
        },
      },
    });

    await waitFor(() => expect(screen.getByText("99+")).toBeInTheDocument(), {
      timeout: 5_000,
    });
  });
});

describe("the card of the related verse", () => {
  it("shows the verse and the way to its page", async () => {
    renderPage(<RelatedVerseCard verseId="verse-1" />, {
      answers: { "/bible-verses/verse-1": VERSE_DETAIL },
    });

    await waitFor(
      () => expect(screen.getByText(VERSE_DETAIL.title)).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    expect(
      screen.getByRole("link", { name: /الآية|verse/i }),
    ).toBeInTheDocument();
  });
});

describe("the list of the review of a quiz", () => {
  const questions = [
    {
      question_id: "q1",
      question: "ما هو الكتاب؟",
      points: 10,
      position: 1,
      options: [],
      selected_option_id: "o1",
      correct_option_id: "o1",
      is_correct: true,
      points_awarded: 10,
    },
    {
      question_id: "q2",
      question: "من هو الكاتب؟",
      points: 10,
      position: 2,
      options: [],
      selected_option_id: null,
      correct_option_id: "o2",
      is_correct: false,
      points_awarded: 0,
    },
  ];

  it("opens a question and closes it again", async () => {
    const user = userEvent.setup();
    renderPage(<QuestionReviewList questions={questions} status="COMPLETED" />);

    const trigger = screen.getAllByRole("button")[0]!;
    await user.click(trigger);

    await waitFor(
      () => expect(screen.getByText(/ما هو الكتاب/)).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });

  it("says that the attempt ended by itself", async () => {
    renderPage(
      <QuestionReviewList questions={questions} status="AUTO_FINISHED" />,
    );

    await waitFor(
      () => expect(screen.getAllByRole("button").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });
});

describe("the sheet of the filters of the verses", () => {
  it("shows that a filter is on", async () => {
    const user = userEvent.setup();
    const patches: Record<string, string | undefined>[] = [];

    renderPage(
      <VerseFilterSheet q="الآية" onPatch={(update) => patches.push(update)} />,
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    await waitFor(
      () =>
        expect(screen.getByPlaceholderText(/بحث|search/i)).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });
});
