import { expect, test } from "@playwright/test";

/**
 * The writing of the blog, from the blog itself.
 *
 * The blog left the administration panel: the admin writes, publishes
 * and archives from the blog route. This journey proves it in the
 * browser - the form is at `/blog/new`, the publish action is on the
 * list, and the post appears in the list of the members right after.
 */

const ADMIN = {
  email: "e2e-admin@example.com",
  password: "E2eAdmin!2026",
};

const TITLE = "منشور من رحلة الإدارة";
const BODY = "نص المنشور المكتوب من المدونة.";

test.describe("the writing of the blog", () => {
  test("the admin writes and publishes a post from the blog", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#email").fill(ADMIN.email);
    await page.locator("#password").fill(ADMIN.password);
    await page
      .getByRole("button", { name: /تسجيل الدخول|دخول|sign in/i })
      .click();
    await page.waitForURL(/\/profile|\/$/, { timeout: 20_000 });

    // The blog is the place of the writing: the admin finds the action
    // there and never in the administration panel.
    await page.goto("/blog");
    await expect(
      page.getByRole("heading", { name: "المدونة", exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("link", { name: /اكتب منشور/i })
      .first()
      .click();
    await page.waitForURL(/\/blog\/new/, { timeout: 20_000 });

    await page.getByLabel("عنوان المنشور").fill(TITLE);
    await page.getByLabel("مقتطف المنشور").fill("مقتطف المنشور.");
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.fill(BODY);

    // The draft is saved by the editor itself: the pause passes and the
    // server keeps the work.
    await expect(page.getByText("تم حفظ المسودة", { exact: true })).toBeVisible(
      { timeout: 30_000 },
    );

    // The publish action is on the form of the blog.
    await page
      .getByRole("button", { name: /نشر الآن|نشر/ })
      .first()
      .click();
    await page.waitForURL(/\/blog/, { timeout: 20_000 });

    // The post is in the list, for everybody.
    await expect(
      page.getByRole("heading", { name: TITLE }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
