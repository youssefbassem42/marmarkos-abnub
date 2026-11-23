import { expect, test } from "@playwright/test";

/**
 * The member journey of the notifications.
 *
 * The member signs in, opens his notifications and finds the one that
 * the platform sent him. The bell of the bar of the platform shows that
 * there is something to read.
 */

const MEMBER = {
  email: "e2e-member@example.com",
  password: "E2eMember!2026",
};

const NOTIFICATION_TITLE = "إشعار الاختبار";

test.describe("the notifications", () => {
  test("a member sees the notifications of the platform", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#email").fill(MEMBER.email);
    await page.locator("#password").fill(MEMBER.password);
    await page
      .getByRole("button", { name: /تسجيل الدخول|دخول|sign in/i })
      .click();
    await page.waitForURL(/\/profile|\/$/, { timeout: 20_000 });

    // The bell of the bar of the platform opens the list.
    const bell = page.getByRole("link", { name: "الإشعارات" }).first();
    await expect(bell).toBeVisible({ timeout: 20_000 });
    await bell.click();
    await expect(page).toHaveURL(/\/notifications/, { timeout: 20_000 });

    // The list shows the notification of the seed of the run.
    await expect(
      page.getByText(NOTIFICATION_TITLE, { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
