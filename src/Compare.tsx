import { useState } from "react";
import type { JSONContent } from "@tiptap/core";
import type { Doc } from "./store";

function blocks(content: JSONContent): string[] {
  function flatten(node: JSONContent): string {
    return (
      node.text ||
      node.content
        ?.map(flatten)
        .join(
          node.type === "paragraph" || node.type === "heading" ? "" : "\n",
        ) ||
      ""
    );
  }
  return (content.content || []).map(flatten);
}
export function Compare({
  current,
  history,
}: {
  current: Doc;
  history: Doc[];
}) {
  const [selected, select] = useState(0);
  if (!history.length) return <p>No earlier revision to compare.</p>;
  const old = blocks(history[selected].content),
    fresh = blocks(current.content);
  // Bound work for very large documents and still show their complete text side by side.
  const counts = (values: string[]) => {
    const out = new Map<string, number>();
    for (const v of values) out.set(v, (out.get(v) || 0) + 1);
    return out;
  };
  const mark = (items: string[], other: string[], className: string) => {
    const remaining = counts(other);
    return items.map((v, i) => {
      const count = remaining.get(v) || 0;
      remaining.set(v, Math.max(count - 1, 0));
      return (
        <p className={count ? "" : className} key={i}>
          {v || "¶"}
        </p>
      );
    });
  };
  return (
    <>
      <label>
        Earlier revision
        <select value={selected} onChange={(e) => select(+e.target.value)}>
          {history.map((v, i) => (
            <option key={v.revision} value={i}>
              Revision {v.revision} · {new Date(v.updated).toLocaleString()}
            </option>
          ))}
        </select>
      </label>
      <div className="comparison">
        <section>
          <b>Earlier text</b>
          {mark(old, fresh, "removed")}
        </section>
        <section>
          <b>Current text</b>
          {mark(fresh, old, "added")}
        </section>
      </div>
    </>
  );
}
