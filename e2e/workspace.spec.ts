import { test, expect } from "@playwright/test";
test.use({ channel: "msedge" });
test("edit, format, undo, reload, and insert a table", async ({ page }) => {
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
  const editor = page.getByRole("textbox", { name: "Document content" });
  await expect(editor).toBeVisible();
  await expect(page.locator(".paper")).toHaveCSS("background-color","rgb(255, 255, 255)");
  await page.screenshot({path:test.info().outputPath("workspace.png")});
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Verified text");
  await page.keyboard.press("Shift+Home");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(
    editor.locator("strong").filter({ hasText: "Verified text" }),
  ).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(
    editor.locator("strong").filter({ hasText: "Verified text" }),
  ).toHaveCount(0);
  await page.keyboard.press("Control+y");
  await expect(
    editor.locator("strong").filter({ hasText: "Verified text" }),
  ).toBeVisible();
  await expect(page.locator(".save")).toHaveText("Saved");
  await page.reload();
  await expect(editor).toContainText("Verified text");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByLabel("Rows", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(editor.locator("tr")).toHaveCount(40);
  await expect
    .poll(() => page.locator(".rm-page-break").count())
    .toBeGreaterThan(1);
  await expect
    .poll(() => page.locator(".rm-page-break").count())
    .toBeLessThan(12);
});
test("a stale tab can preserve its changes as a separate document", async ({
  page,
  context,
}) => {
  const url = process.env.TEST_URL || "http://127.0.0.1:5173";
  await page.goto(url);
  const area = page.getByRole("textbox", { name: "Document content" });
  await expect(area).toBeVisible();
  const other = await context.newPage();
  await other.goto(url);
  const stale = other.getByRole("textbox", { name: "Document content" });
  await expect(stale).toBeVisible();
  await area.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText(" First tab edit");
  await expect(page.locator(".save")).toHaveText("Saved");
  await stale.click();
  await other.keyboard.press("Control+End");
  await other.keyboard.insertText(" Second tab edit");
  await expect(other.getByRole("alert")).toContainText("newer revision");
  await other.getByRole("button", { name: "Save a copy" }).click();
  await expect(other.locator(".docname")).toContainText("recovered");
  await expect(stale).toContainText("Second tab edit");
  await page.reload();
  await expect(area).toContainText("First tab edit");
  await expect(area).not.toContainText("Second tab edit");
});

test("a proposed edit changes the canonical document only after acceptance",async({page})=>{
  await page.goto(process.env.TEST_URL||"http://127.0.0.1:5173");
  const original=page.getByRole("textbox",{name:"Document content"});
  await expect(original).toBeVisible();
  await page.getByRole("button",{name:"Review",exact:true}).click();
  await page.getByRole("button",{name:"Suggested changes",exact:true}).click();
  await page.getByRole("button",{name:"Suggest an edit"}).click();
  const proposal=page.getByRole("textbox",{name:"Proposed document text"});
  await proposal.click();await page.keyboard.press("Control+End");await page.keyboard.insertText(" Proposed addition");
  await page.getByRole("button",{name:"Submit proposed changes"}).click();
  await expect(page.locator('[aria-label="Document content"]')).not.toContainText("Proposed addition");
  await page.getByRole("button",{name:"Accept",exact:true}).click();
  await page.getByRole("button",{name:"Close dialog"}).click();
  await expect(original).toContainText("Proposed addition");
  await expect(page.locator(".save")).toHaveText("Saved");
  await page.reload();await expect(original).toContainText("Proposed addition");
});

