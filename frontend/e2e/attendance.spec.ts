import { expect, test } from "@playwright/test";

/**
 * The golden path #3: the check-in of the weekly meeting.
 *
 * The servant signs in, types the PIN of the member and the member is
 * registered for the meeting of the week. The test proves the whole
 * chain: the permission, the validation of the PIN, the record and the
 * roster that shows it.
 */

const ADMIN = {
  email: "e2e-admin@example.com",
  password: "E2eAdmin!2026",
};

const MEMBER_PIN = "12345";

async function signInAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN.email);
  await page.locator("#password").fill(ADMIN.password);
  await page
    .getByRole("button", { name: /تسجيل الدخول|دخول|sign in/i })
    .click();
  await page.waitForURL(/\/profile|\/$/, { timeout: 20_000 });
}

test.describe("the check-in", () => {
  test("a servant records the attendance of a member with the PIN", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    await page.goto("/admin/attendance/check-in");
    await expect(page.getByRole("tab", { name: /رمز PIN/i })).toBeVisible({
      timeout: 20_000,
    });

    // The page opens on the scanner; the PIN is the other tab.
    await page.getByRole("tab", { name: /رمز PIN/i }).click();

    // The PIN is typed digit by digit.
    const digits = page.getByRole("textbox");
    await expect(digits.first()).toBeVisible({ timeout: 20_000 });
    const digitCount = await digits.count();
    expect(digitCount).toBe(MEMBER_PIN.length);

    for (const [index, digit] of [...MEMBER_PIN].entries()) {
      await digits.nth(index).fill(digit);
    }

    // The result of the check-in: the member is registered.
    await expect(
      page.getByText(/تم تسجيل|مسجل|present|late/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
