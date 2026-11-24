import { useState } from "react";
import { type Editor } from "@tiptap/react";
import * as I from "lucide-react";
import type { Doc } from "./store";
import { Modal, Tool } from "./App";
import DOMPurify from "dompurify";

export async function importFile(file: File, editor: Editor) {
  if (file.size > 4_000_000) throw Error("Import limit is 4 MB.");
  if (/\.docx$/i.test(file.name)) {
    const mammoth = await import("mammoth");
    const res = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    editor.chain().focus().insertContent(DOMPurify.sanitize(res.value)).run();
  } else if (/\.html?$/i.test(file.name))
    editor
      .chain()
      .focus()
      .insertContent(DOMPurify.sanitize(await file.text()))
      .run();
  else if (/\.txt$/i.test(file.name)) editor.view.pasteText(await file.text());
  else throw Error("Choose a DOCX, HTML or TXT file.");
}
export async function wordExport(doc: Doc, format: "docx" | "pdf" = "docx") {
  const res = await fetch("/api/export/" + format, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Workspace": "editor" },
    body: JSON.stringify(doc),
  });
  if (
    !res.ok ||
    !res.headers
      .get("Content-Type")
      ?.includes(format === "docx" ? "wordprocessingml" : "application/pdf")
  )
    throw Error(
      format === "docx"
        ? "Word export requires the FastAPI document service."
        : "PDF download requires a signed-in account and the print service. Browser Print also supports Save as PDF.",
    );
  const url = URL.createObjectURL(await res.blob()),
    a = document.createElement("a");
  a.href = url;
  a.download = doc.title + "." + format;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Props = {
  name: string;
  e: Editor;
  doc: Doc;
  update: (c: Partial<Doc>) => void;
  close: () => void;
  notify: (s: string) => void;
};
export const extraDialogs = [
  "Table",
  "Image",
  "Page settings",
  "Header and footer",
  "Bookmark",
  "Footnote",
  "Endnote",
  "Caption",
  "Citation",
  "Cross-reference",
  "Custom style",
  "Equation",
];
export function More({ name, e, doc, update, close, notify }: Props) {
  const [busy, setBusy] = useState(false);
  const s = doc.settings,
    img = e.getAttributes("image"),
    inImage = e.isActive("image");
  const field = (
    name: string,
    label: string,
    value: string | number = "",
    type = "text",
  ) => (
    <label>
      {label}
      <input name={name} type={type} defaultValue={value} maxLength={1000} />
    </label>
  );
  const numeric = (
    name: string,
    label: string,
    value: number,
    min: number,
    max: number,
  ) => (
    <label>
      {label}
      <input
        required
        type="number"
        name={name}
        defaultValue={value}
        min={min}
        max={max}
        step="any"
      />
    </label>
  );
  const bookmarks: string[] = [];
  e.state.doc.descendants((n) => {
    if (n.type.name === "bookmark") bookmarks.push(n.attrs.id);
  });
  async function submit(data: FormData) {
    const val = (k: string) => String(data.get(k) || "").trim(),
      c = e.chain().focus();
    if (name === "Table")
      c.insertTable({
        rows: Number(val("rows")),
        cols: Number(val("cols")),
        withHeaderRow: true,
      }).run();
    if (name === "Image") {
      const file = data.get("image") as File;
      let src = img.src;
      if (file?.size) {
        if (
          file.size > 1_500_000 ||
          !["image/png", "image/jpeg", "image/webp"].includes(file.type)
        )
          throw Error("Choose a PNG, JPEG or WebP under 1.5 MB.");
        await createImageBitmap(file).then((b) => b.close());
        src = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
      }
      if (!src) throw Error("Choose an image.");
      const attrs = {
        src,
        alt: val("alt"),
        width: Number(val("width")),
        float: val("align"),
      };
      if (inImage) c.updateAttributes("image", attrs).run();
      else c.insertContent({ type: "image", attrs }).run();
    }
    if (name === "Page settings")
      update({
        settings: {
          ...s,
          width: val("width") + "mm",
          height: val("height") + "mm",
          margin: val("margin") + "mm",
          background: val("background"),
          headerSpace: Number(val("headerSpace")),
          footerSpace: Number(val("footerSpace")),
          pageBorder: val("border"),
        },
      });
    if (name === "Header and footer")
      update({
        settings: {
          ...s,
          header: val("header"),
          footer: val("footer"),
          pageNumbers: data.has("numbers"),
        },
      });
    if (name === "Custom style") {
      const label = val("label");
      if (!label) throw Error("Enter a style name.");
      update({
        settings: {
          ...s,
          styles: {
            ...s.styles,
            [label]: (
              e.state.storedMarks || e.state.selection.$from.marks()
            ).map((m) => m.toJSON()),
          },
        },
      });
    }
    if (name === "Bookmark") {
      const id = val("label").replace(/[^a-zA-Z0-9_-]/g, "-");
      if (!id || bookmarks.includes(id))
        throw Error("Enter a unique bookmark.");
      c.insertContent({ type: "bookmark", attrs: { id } }).run();
    }
    if (name === "Cross-reference") {
      const id = val("target");
      if (!id) throw Error("Insert a bookmark first.");
      c.insertContent({
        type: "text",
        text: val("label") || id,
        marks: [{ type: "link", attrs: { href: "#" + id } }],
      }).run();
    }
    if (name === "Caption")
      c.insertContent({
        type: "paragraph",
        content: [
          { type: "text", text: val("label"), marks: [{ type: "italic" }] },
        ],
      }).run();
    if (["Footnote", "Endnote", "Citation"].includes(name)) {
      const text = val("label");
      if (!text) throw Error("Enter the reference text.");
      const num = (s.referenceCount || 0) + 1,
        id = "ref-" + crypto.randomUUID();
      c.insertContent({
        type: "text",
        text: "[" + num + "]",
        marks: [{ type: "link", attrs: { href: "#" + id } }],
      }).run();
      e.commands.insertContentAt(e.state.doc.content.size, {
        type: "paragraph",
        content: [
          { type: "bookmark", attrs: { id } },
          { type: "text", text: "[" + num + "] " + text },
        ],
      });
      update({ settings: { ...s, referenceCount: num } });
    }
    if (name === "Equation") {
      const value = val("label");
      if (!value) throw Error("Enter an equation.");
      const katex = await import("katex");
      katex.renderToString(value, { throwOnError: true, trust: false });
      c.insertContent({ type: "mathBlock", attrs: { latex: value } }).run();
    }
    close();
  }
  return (
    <Modal title={name} close={close}>
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          try {
            await submit(new FormData(ev.currentTarget));
          } catch (ex) {
            notify(String(ex));
          } finally {
            setBusy(false);
          }
        }}
      >
        {name === "Table" ? (
          <>
            {numeric("rows", "Rows", 3, 1, 100)}
            {numeric("cols", "Columns", 3, 1, 20)}
          </>
        ) : name === "Image" ? (
          <>
            <label>
              Image file
              <input
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required={!inImage}
              />
            </label>
            {field("alt", "Alternative text", img.alt || "")}
            {numeric("width", "Width in pixels", img.width || 360, 20, 1200)}
            <label>
              Text wrapping
              <select name="align" defaultValue={img.float || "none"}>
                <option>none</option>
                <option>left</option>
                <option>right</option>
              </select>
            </label>
          </>
        ) : name === "Header and footer" ? (
          <>
            {field("header", "Header", s.header || "")}
            {field("footer", "Footer", s.footer || "")}
            <label>
              <span>
                <input
                  name="numbers"
                  type="checkbox"
                  defaultChecked={s.pageNumbers !== false}
                />{" "}
                Show page numbers
              </span>
            </label>
          </>
        ) : name === "Page settings" ? (
          <>
            {numeric(
              "width",
              "Page width (mm)",
              Math.round(
                parseFloat(s.width || "210") *
                  (s.width?.endsWith("in") ? 25.4 : 1),
              ),
              110,
              550,
            )}
            {numeric(
              "height",
              "Page height (mm)",
              Math.round(
                parseFloat(s.height || "297") *
                  (s.height?.endsWith("in") ? 25.4 : 1),
              ),
              110,
              650,
            )}
            {numeric(
              "margin",
              "Margins (mm)",
              parseFloat(s.margin || "22"),
              5,
              45,
            )}
            {numeric(
              "headerSpace",
              "Header distance from page edge (mm)",
              s.headerSpace ?? 12,
              1,
              40,
            )}
            {numeric(
              "footerSpace",
              "Footer distance from page edge (mm)",
              s.footerSpace ?? 12,
              1,
              40,
            )}
            <label>
              Page border
              <select name="border" defaultValue={s.pageBorder || "none"}>
                <option>none</option>
                <option>solid</option>
                <option>dashed</option>
              </select>
            </label>
            {field(
              "background",
              "Page color",
              s.background || "#ffffff",
              "color",
            )}
          </>
        ) : (
          <>
            {name === "Cross-reference" && (
              <label>
                Bookmark
                <select name="target">
                  {bookmarks.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
            )}
            {field(
              "label",
              name === "Equation"
                ? "LaTeX equation"
                : name === "Citation"
                  ? "Bibliographic reference"
                  : name === "Custom style"
                    ? "Save current text formatting as"
                    : "Text",
              name === "Equation" ? "E=mc^2" : "",
            )}
          </>
        )}
        <button disabled={busy} className="primary">
          Apply
        </button>
      </form>
    </Modal>
  );
}
export function Comments({
  e,
  doc,
  update,
  close,
  author,
}: {
  e: Editor;
  doc: Doc;
  update: (v: Partial<Doc>) => void;
  close: () => void;
  author: string;
}) {
  const [text, setText] = useState(""),
    [resolved, show] = useState(false);
  const comments: {
    id: string;
    text: string;
    quote: string;
    resolved: boolean;
    author: string;
  }[] = doc.settings.comments || [];
  function save(items: typeof comments) {
    update({ settings: { ...doc.settings, comments: items } });
  }
  return (
    <aside className="comments">
      <div className="sidehead">
        <span>
          <I.MessageSquare size={16} />
          Comments
        </span>
        <Tool icon={I.X} label="Close comments" run={close} />
      </div>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          const sel = e.state.selection;
          if (sel.empty || !text.trim()) return;
          const id = crypto.randomUUID(),
            quote = e.state.doc.textBetween(sel.from, sel.to);
          e.chain().focus().setMark("commentAnchor", { thread: id }).run();
          save([
            ...comments,
            {
              id,
              text: text.trim(),
              quote,
              resolved: false,
              author: author || "You",
            },
          ]);
          setText("");
        }}
      >
        <label>
          Comment on selection
          <textarea
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            maxLength={2000}
          />
        </label>
        <button
          className="primary"
          disabled={!text.trim() || e.state.selection.empty}
        >
          Add comment
        </button>
      </form>
      <label>
        <input
          type="checkbox"
          checked={resolved}
          onChange={(ev) => show(ev.target.checked)}
        />{" "}
        Include resolved
      </label>
      {comments
        .filter((x) => resolved || !x.resolved)
        .map((x) => (
          <section key={x.id}>
            <b>{x.author}</b>
            <blockquote>
              <button
                title="Select commented text"
                onClick={() => {
                  let from = Infinity,
                    to = 0;
                  e.state.doc.descendants((node, pos) => {
                    if (
                      node.marks.some(
                        (m) =>
                          m.type.name === "commentAnchor" &&
                          m.attrs.thread === x.id,
                      )
                    ) {
                      from = Math.min(from, pos);
                      to = Math.max(to, pos + node.nodeSize);
                    }
                  });
                  if (to > from)
                    e.chain()
                      .focus()
                      .setTextSelection({ from, to })
                      .scrollIntoView()
                      .run();
                }}
              >
                {x.quote}
              </button>
            </blockquote>
            <p>{x.text}</p>
            <button
              onClick={() =>
                save(
                  comments.map((v) =>
                    v.id === x.id ? { ...v, resolved: !v.resolved } : v,
                  ),
                )
              }
            >
              {x.resolved ? "Reopen" : "Resolve"}
            </button>
          </section>
        ))}
    </aside>
  );
}
