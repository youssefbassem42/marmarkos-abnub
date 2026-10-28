import { expect, test } from "@playwright/test";

/**
 * The golden path #2: taking a quiz.
 *
 * The member opens the feed of the published verses, starts the quiz of
 * the verse, answers the questions and submits the attempt. The test
 * proves the whole chain: the attempt is created, the answers are saved,
 * the submission is graded and the member sees the result.
 */

const MEMBER = {
  email: "e2e-member@example.com",
  password: "E2eMember!2026",
};

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("#email").fill(MEMBER.email);
  await page.locator("#password").fill(MEMBER.password);
  await page
    .getByRole("button", { name: /تسجيل الدخول|دخول|sign in/i })
    .click();
  await page.waitForURL(/\/profile|\/$/, { timeout: 20_000 });
}

test.describe("taking a quiz", () => {
  test("a member answers the quiz of a verse and sees the result", async ({
    page,
  }) => {
    // The errors of the browser are the first evidence when a page stays
    // empty: without them the failure reads like a timeout.
    page.on("pageerror", (error) => {
      console.error("[page error]", error.message);
    });
    page.on("console", (message) => {
      console.error(
        `[console:${message.type()}]`,
        message.text().slice(0, 400),
      );
    });
    page.on("response", (response) => {
      if (response.url().includes("/api/")) {
        console.error(`[http ${response.status()}]`, response.url());
      }
    });

    await signIn(page);

    // The feed of the published verses holds the verse of the E2E.
    await page.goto("/bible-verses");

    const verse = page.getByRole("heading", { name: /آية الاختبار/ }).first();
    await expect(verse).toBeVisible({ timeout: 30_000 });

    // The card of the verse links to its page ("read more").
    await page
      .getByRole("link", { name: /اقرأ المزيد|read more/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/bible-verses\/.+/, { timeout: 20_000 });

    // The page of the verse holds the card of the quiz.
    // The quiz stays locked until the member marks the verse as read
    // (the business rule of the module).
    const markAsRead = page
      .getByRole("button", { name: /تحديد كمقروء|mark.*read/i })
      .first();
    await expect(markAsRead).toBeVisible({ timeout: 20_000 });
    await markAsRead.click();

    const start = page
      .getByRole("link", { name: /ابدأ الاختبار|start/i })
      .first();
    await expect(start).toBeVisible({ timeout: 30_000 });
    await start.click();

    // The attempt page shows the questions of the quiz.
    await expect(page).toHaveURL(/\/quizzes\/.+\/take/, { timeout: 20_000 });

    const options = page.getByRole("radio");
    // The questions arrive from the API: wait for the first option.
    await expect(options.first()).toBeVisible({ timeout: 30_000 });
    // The page is mounted again when the lazy route resolves, so the
    // options are counted when they are all there.
    await expect.poll(() => options.count()).toBeGreaterThan(0);

    // Answer every question: the page shows one question at a time and
    // the member walks through them.
    const total = Number(
      (await page.locator("text=/السؤال \\d+ من \\d+/").first().innerText())
        .split("من")[1]
        ?.trim(),
    );
    expect(total).toBeGreaterThan(0);

    for (let index = 0; index < total; index += 1) {
      await page.getByRole("radio").first().click();
      if (index < total - 1) {
        await page.getByRole("button", { name: /التالي|next/i }).click();
        await expect(
          page.getByText(new RegExp(`السؤال ${index + 2} من`)).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    }

    await page
      .getByRole("button", { name: /إنهاء|تسليم|finish|submit/i })
      .click();

    // The result of the attempt.
    await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
    await expect(page.getByText(/نتيجتك|نتيجة|result/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // The button that sends the member back to the verse of the quiz
    // leads to the **verse** (the page used to build the address with
    // the id of the quiz: the page did not exist).
    const backToVerse = page.getByRole("link", { name: /العودة إلى/ }).first();
    await expect(backToVerse).toBeVisible({ timeout: 20_000 });
    await backToVerse.click();
    await expect(page).toHaveURL(/\/bible-verses\/.+/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /آية الاختبار/ }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
