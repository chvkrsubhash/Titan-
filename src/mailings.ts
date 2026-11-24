import type { JSONContent } from "@tiptap/core";
export function recipients(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && ch === ",") {
      row.push(value.trim());
      value = "";
    } else if (!quoted && ch === "\n") {
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += ch;
  }
  if (quoted) throw Error("Close the quoted CSV field.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift() || [];
  if (
    !headers.length ||
    headers.some((h) => !h || /[{}]/.test(h)) ||
    new Set(headers).size !== headers.length
  )
    throw Error("Enter unique, nonempty column names.");
  if (!rows.length || rows.some((r) => r.length !== headers.length))
    throw Error("Each recipient needs one value per column.");
  return rows.map(
    (r) =>
      Object.fromEntries(headers.map((h, i) => [h, r[i]])) as Record<
        string,
        string
      >,
  );
}
export function mergeRecord(
  node: JSONContent,
  record: Record<string, string>,
): JSONContent {
  if (node.type === "text") {
    const text = (node.text || "").replace(
      /\{\{([^{}]+)\}\}/g,
      (_, field: string) => {
        if (field.startsWith("IF:")) {
          const [column, expected, yes, no] = field.slice(3).split("|");
          if (!Object.hasOwn(record, column) || no === undefined)
            throw Error("Invalid merge rule: " + field);
          return record[column] === expected ? yes : no;
        }
        if (!Object.hasOwn(record, field))
          throw Error("Missing recipient column: " + field);
        return record[field];
      },
    );
    return { ...node, text };
  }
  return node.content
    ? {
        ...node,
        content: node.content
          .map((child) => mergeRecord(child, record))
          .filter((child) => child.type !== "text" || child.text),
      }
    : { ...node };
}
