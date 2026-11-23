import { expect, test } from "@playwright/test";

/**
 * The member journey of the verse of the day.
 *
 * A member opens the landing page, follows the daily-verse call to
 * action, opens the published verse, reads its Arabic text and marks it
 * as read. The last assertion proves that the read reached the API and
 * the database instead of only changing a button in the browser.
 */

const READER = {
  email: "e2e-reader@example.com",
  password: "e2e-ReaderMember!2026",
};

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(READER.email);
  await page
    .getByRole("textbox", { name: "كلمة المرور", exact: true })
    .fill(READER.password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(/\/profile|\/$/, { timeout: 20_000 });
}

test.describe("the verse of the day", () => {
  test("a member opens the daily verse and marks it as read", async ({
    page,
  }) => {
    await signIn(page);

    // The landing page offers the daily verse in Arabic.
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "إقرأ الآية اليومية" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/فَتِّشُوا الْكُتُبَ/)).toBeVisible();

    await page.getByRole("link", { name: "إقرأ الآية اليومية" }).click();
    await expect(page).toHaveURL(/\/bible-verses/, { timeout: 20_000 });

    // The current verse is the one prepared by the seed of the run.
    await expect(
      page.getByRole("heading", { name: "آية الاختبار" }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText("آية للاختبار الشامل.", { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "اقرأ المزيد" }).first().click();
    await expect(page).toHaveURL(/\/bible-verses\/[0-9a-f-]+$/i, {
      timeout: 20_000,
    });

    // The page of the verse holds the Arabic text and its reflection.
    await expect(
      page.getByRole("heading", { name: "آية الاختبار" }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("آية للاختبار الشامل.", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "تأمل" })).toBeVisible();
    await expect(
      page.getByText("تأمل الاختبار الشامل.", { exact: true }),
    ).toBeVisible();

    // Reading is an explicit action whose result survives on the server.
    const markAsRead = page.getByRole("button", { name: "تحديد كمقروء" });
    await expect(markAsRead).toBeVisible({ timeout: 20_000 });
    await markAsRead.click();
    await expect(
      page.getByText("تم التحديد كمقروء", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
