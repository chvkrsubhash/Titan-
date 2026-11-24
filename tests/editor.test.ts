// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, expect, test, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { extensions } from "../src/extensions";
import { localDocs, newDoc, persist, versions } from "../src/store";
let editor: Editor;
afterEach(() => {
  editor?.destroy();
  localStorage.clear();
  vi.unstubAllGlobals();
});
test("formatting applies only to selection and supports undo/redo", () => {
  editor = new Editor({ extensions, content: "<p>Alpha beta</p>" });
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.toggleBold();
  expect(editor.getHTML()).toContain("<strong>Alpha</strong> beta");
  editor.commands.undo();
  expect(editor.getHTML()).not.toContain("<strong>");
  editor.commands.redo();
  expect(editor.getHTML()).toContain("<strong>Alpha</strong>");
});
test("structured document round trips through storage and rejects a stale revision", async () => {
  const first = await persist(newDoc("Project proposal"), "");
  const renamed = await persist({ ...first, title: "Updated" }, "");
  expect((await localDocs())[0]).toEqual(renamed);
  await expect(persist({ ...first, title: "Stale" }, "")).rejects.toThrow(
    "newer revision",
  );
  expect((await versions(first, ""))[0]).toEqual(first);
});
test("long paragraphs, headings, and mixed formatting survive editor reload", () => {
  editor = new Editor({
    extensions,
    content:
      "<h1>Report</h1><p><em>Introduction</em> " +
      "Long paragraph. ".repeat(4000) +
      "</p>",
  });
  const snapshot = editor.getJSON();
  editor.commands.setContent(snapshot);
  expect(editor.getJSON()).toEqual(snapshot);
});
