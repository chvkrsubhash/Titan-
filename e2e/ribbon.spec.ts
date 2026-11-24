import { test, expect } from "@playwright/test";
test.use({ channel: "msedge" });
test("design persists and a mail merge previews and produces personalized letters", async ({
  page,
}) => {
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
  const doc = page.getByRole("textbox", { name: "Document content" });
  await expect(doc).toBeVisible();
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await page.getByLabel("Document theme").selectOption("Modern");
  await expect(page.locator(".paper")).toHaveCSS("--doc-heading", "Arial");
  await doc.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText("Dear {{Name}}");
  await page.getByRole("button", { name: "Mailings", exact: true }).click();
  await page.getByRole("button", { name: "Recipients", exact: true }).click();
  await page
    .getByLabel("Recipient CSV with column headings")
    .fill("Name\nAsha\nVikram");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("button", { name: "Preview results" }).click();
  await expect(page.locator("pre")).toHaveText("Dear Asha");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("pre")).toHaveText("Dear Vikram");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Finish merge" }).click();
  await page
    .getByRole("button", { name: "Merge into current document" })
    .click();
  await expect(doc).toContainText("Dear Asha");
  await expect(doc).toContainText("Dear Vikram");
  await expect(page.locator(".save")).toHaveText("Saved");
  await page.reload();
  await expect(doc).toContainText("Dear Vikram");
});
