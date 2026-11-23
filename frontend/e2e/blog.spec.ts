import { expect, test } from "@playwright/test";

/**
 * The member journey of the blog.
 *
 * The member opens the list of the published posts, opens one of them
 * and writes a comment. The last assertion proves that the comment
 * reached the server: the page shows it after a reload, so it is in the
 * database and not only in the browser.
 */

const MEMBER = {
  email: "e2e-member@example.com",
  password: "E2eMember!2026",
};

const POST_TITLE = "منشور الاختبار";
const COMMENT = "تعليق من رحلة الاختبار";

test.describe("the blog", () => {
  test("a member reads a post and comments on it", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(MEMBER.email);
    await page.locator("#password").fill(MEMBER.password);
    await page
      .getByRole("button", { name: /تسجيل الدخول|دخول|sign in/i })
      .click();
    await page.waitForURL(/\/profile|\/$/, { timeout: 20_000 });

    // The list of the blog shows the published posts.
    await page.goto("/blog");
    await expect(
      page.getByRole("heading", { name: "المدونة", exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    const post = page.getByRole("link", { name: new RegExp(POST_TITLE) }).first();
    await expect(post).toBeVisible({ timeout: 20_000 });
    await post.click();

    // The page of the post shows its body and its comments.
    await expect(
      page.getByRole("heading", { name: POST_TITLE }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("نص منشور الاختبار.", { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await expect(
      page.getByRole("heading", { name: "التعليقات", exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    // The member writes a comment.
    const editor = page.getByLabel("اكتب تعليقك");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.fill(COMMENT);
    await page.getByRole("button", { name: "اكتب تعليقك" }).click();

    // The comment is on the page: the server answered.
    await expect(page.getByText(COMMENT, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });

    // And it is in the database: a reload shows it again.
    await page.reload();
    await expect(page.getByText(COMMENT, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
