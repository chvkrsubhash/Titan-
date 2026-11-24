import { test, expect } from "@playwright/test";
test.use({ channel: "msedge" });
test("import a generated Word file, add a PNG, and reopen document data", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.FULL_STACK_URL,
    "Requires the document export service",
  );
  const url = process.env.FULL_STACK_URL!;
  const response = await request.post(url + "/api/export/docx", {
    headers: { "X-Workspace": "editor" },
    data: {
      id: "roundtrip",
      revision: 0,
      title: "Import test",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Imported heading" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Formatted import",
                marks: [{ type: "bold" }],
              },
            ],
          },
        ],
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto(url);
  const editor = page.getByRole("textbox", { name: "Document content" });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: await response.body(),
    });
  await expect(
    editor.locator("strong").filter({ hasText: "Formatted import" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await page.getByLabel("Image file").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 8;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#27694b";
        ctx.fillRect(0, 0, 8, 8);
        return canvas.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    ),
  });
  await page.getByLabel("Alternative text").fill("Imported PNG");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(editor.getByAltText("Imported PNG")).toHaveCount(1);
  await expect(page.locator(".save")).toHaveText("Saved");
  await page.reload();
  await expect(editor).toContainText("Imported heading");
  await expect(editor.getByAltText("Imported PNG")).toHaveCount(1);
});
