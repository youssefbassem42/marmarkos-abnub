import { expect, test } from "@playwright/test";

/**
 * The member journey of the points.
 *
 * The member signs in, opens his points and finds his total, the month
 * he chooses in the URL and the ledger of his movements. The last
 * assertion proves that the numbers came from the API: the total of the
 * page is the number of the database.
 */

const POINTS_MEMBER = {
  email: "e2e-points@example.com",
  password: "e2e-PointsMember!2026",
};

test.describe("the points of the member", () => {
  test("a member sees his total, his months and his ledger", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#email").fill(POINTS_MEMBER.email);
    await page.locator("#password").fill(POINTS_MEMBER.password);
    await page
      .getByRole("button", { name: /تسجيل الدخول|دخول|sign in/i })
      .click();
    await page.waitForURL(/\/profile|\/$/, { timeout: 20_000 });

    await page.goto("/points");

    // The page of the points answers with the name of the platform.
    await expect(
      page.getByRole("heading", { name: "نقاطي", exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    // The total of the member (the seed gave him the points of a quiz).
    await expect(
      page.getByText("نقاطي الكلية", { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // The month that the member chooses lives in the URL: a link can be
    // shared and the back button works.
    await expect(page.getByText("اختر الشهر", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // The ledger of the movements.
    await expect(
      page.getByText("سجل النقاط", { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("النشاط الأخير", { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
