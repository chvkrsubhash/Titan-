import { test, expect } from "@playwright/test";
test.use({ channel: "msedge" });
test("two accounts converge after concurrent edits, reload, and revocation", async ({
  browser,
}) => {
  test.skip(
    !process.env.FULL_STACK_URL,
    "Requires running FastAPI and MongoDB",
  );
  test.setTimeout(90000);
  const url = process.env.FULL_STACK_URL!,
    id = crypto.randomUUID(),
    password = "Test-account-" + id;
  const a = await browser.newContext(),
    b = await browser.newContext();
  try {
    const owner = "owner-" + id + "@example.test",
      editor = "editor-" + id + "@example.test";
    for (const [ctx, email] of [
      [a, owner],
      [b, editor],
    ] as const) {
      const res = await ctx.request.post(url + "/api/auth/register", {
        headers: { "X-Workspace": "editor" },
        data: { email, password },
      });
      expect(res.status(), await res.text()).toBe(200);
    }
    const doc = {
      id,
      title: "Shared integration test",
      revision: 0,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Shared draft" }],
          },
        ],
      },
    };
    expect(
      (
        await a.request.post(url + "/api/documents", {
          headers: { "X-Workspace": "editor" },
          data: doc,
        })
      ).status(),
    ).toBe(201);
    const alice = await a.newPage(),
      bob = await b.newPage();
    await alice.goto(url + "/?doc=" + id);
    await alice.getByRole("button", { name: "Share", exact: true }).click();
    await alice.getByRole("button", { name: "Enable live editing" }).click();
    const ae = alice.getByRole("textbox", { name: "Shared document" });
    await expect(ae).toContainText("Shared draft");
    await alice.getByRole("button", { name: "Share", exact: true }).click();
    await alice.getByLabel("Account email").fill(editor);
    await alice.getByRole("button", { name: "Grant access" }).click();
    await expect(alice.getByRole("button", { name: "Revoke" })).toBeVisible();
    await alice.getByRole("button", { name: "Close dialog" }).click();
    await bob.goto(url + "/?doc=" + id);
    const be = bob.getByRole("textbox", { name: "Shared document" });
    await expect(be).toContainText("Shared draft");
    await Promise.all(
      [
        [alice, ae, " Alpha"],
        [bob, be, " Beta"],
      ].map(async (item) => {
        const [page, area, word] = item as [typeof alice, typeof ae, string];
        await area.click();
        await page.keyboard.press("Control+End");
        await page.keyboard.insertText(word);
      }),
    );
    for (const area of [ae, be]) {
      await expect(area).toContainText("Alpha");
      await expect(area).toContainText("Beta");
    }
    await expect(alice.locator(".save")).toHaveText("Saved");
    await expect(bob.locator(".save")).toHaveText("Saved");
    await bob.reload();
    await expect(be).toContainText("Alpha");
    await expect(be).toContainText("Beta");
    expect(
      (
        await a.request.delete(
          url +
            "/api/documents/" +
            id +
            "/access/" +
            encodeURIComponent(editor),
          { headers: { "X-Workspace": "editor" } },
        )
      ).ok(),
    ).toBeTruthy();
    expect(
      (await (await b.request.get(url + "/api/documents")).json()).find(
        (d: { id: string }) => d.id === id,
      ),
    ).toBeUndefined();
  } finally {
    await a.close();
    await b.close();
  }
});
