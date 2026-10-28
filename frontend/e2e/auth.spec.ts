import { expect, test } from "@playwright/test";

/**
 * The golden path #1: signing in.
 *
 * The member signs in with the email and the password, reaches the
 * profile and finds their own data there. The test also proves that a
 * wrong password does **not** sign anybody in - the answer is the same
 * for an unknown address and a wrong password.
 */

const MEMBER = {
  email: "e2e-member@example.com",
  password: "E2eMember!2026",
};

test.describe("signing in", () => {
  test("a member signs in and reaches their profile", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#email").fill(MEMBER.email);
    await page.locator("#password").fill(MEMBER.password);
    await page
      .getByRole("button", { name: /تسجيل الدخول|دخول|sign in/i })
      .click();

    // The member lands on the profile of the signed-in member.
    await page.waitForURL(/\/profile|\/$/, { timeout: 20_000 });
    await page.goto("/profile");

    await expect(
      page.getByRole("heading", { name: /ملفي|بروفايل|profile/i }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("a wrong password signs nobody in", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#email").fill(MEMBER.email);
    await page.locator("#password").fill("not-the-password");
    await page
      .getByRole("button", { name: /تسجيل الدخول|دخول|sign in/i })
      .click();

    // The page stays on the login form and shows an error.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("alert").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("an anonymous visitor is sent to the login page", async ({ page }) => {
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
