import { expect, test } from "vitest";
import { mergeRecord, recipients } from "../src/mailings";
test("CSV handles quoted commas, newlines and escaped quotes", () => {
  expect(
    recipients('Name,Address\r\n"Jamie, Jr.","10 Main\nUnit ""B"""'),
  ).toEqual([{ Name: "Jamie, Jr.", Address: '10 Main\nUnit "B"' }]);
  expect(() => recipients("Name,Name\na,b")).toThrow();
});
test("merge retains formatting, handles empty fields and leaves the template intact", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "{{Name}}", marks: [{ type: "bold" }] },
        ],
      },
    ],
  };
  expect(mergeRecord(doc, { Name: "Jamie" }).content?.[0].content?.[0]).toEqual(
    { type: "text", text: "Jamie", marks: [{ type: "bold" }] },
  );
  expect(mergeRecord(doc, { Name: "" }).content?.[0].content).toEqual([]);
  expect(() => mergeRecord(doc, {})).toThrow("Missing recipient");
  expect(doc.content[0].content[0].text).toBe("{{Name}}");
});
