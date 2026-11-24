import { useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import * as I from "lucide-react";
import DOMPurify from "dompurify";
import { importFile, wordExport } from "./More";
import { Tool } from "./App";
import type { Doc } from "./store";
function Group({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="group">
      <div className="groupbody">{children}</div>
      <small>{name}</small>
    </div>
  );
}
function Tile({
  icon: Icon,
  label,
  run,
}: {
  icon: I.LucideIcon;
  label: string;
  run: () => void;
}) {
  return (
    <button
      className="tile"
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      <Icon size={22} strokeWidth={1.5} />
      {label}
    </button>
  );
}
function download(name: string, value: string, mime: string) {
  const url = URL.createObjectURL(new Blob([value], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Props = {
  editor: Editor;
  tab: string;
  command: (s: string) => void;
  doc: Doc;
  update: (c: Partial<Doc>) => void;
  notify: (s: string) => void;
  outline: boolean;
  ruler: boolean;
  zoom: number;
  setZoom: (v: number) => void;
  reading: boolean;
  toggleOutline: () => void;
  toggleRuler: () => void;
};
export function Ribbon({
  editor: e,
  tab,
  command,
  doc,
  update,
  notify,
  ruler,
  outline,
  setZoom,
  reading,
  toggleOutline,
  toggleRuler,
}: Props) {
  useEditorState({
    editor: e,
    selector: ({ transactionNumber }) => transactionNumber,
  });
  const [marks, setMarks] = useState(false);
  const painter = useRef<ReturnType<
      typeof e.state.selection.$from.marks
    > | null>(null),
    file = useRef<HTMLInputElement>(null);
  const t = (
    icon: I.LucideIcon,
    label: string,
    run: () => void,
    active = false,
  ) => <Tool key={label} {...{ icon, label, run, active }} />;
  const tile = (
    icon: I.LucideIcon,
    label: string,
    run = () => command(label),
  ) => <Tile key={label} {...{ icon, label, run }} />;
  const c = () => e.chain().focus(),
    sel = e.state.selection,
    attrs = e.getAttributes("textStyle");
  const blockType = e.isActive("heading") ? "heading" : "paragraph";
  function block(key: string, value: string) {
    c()
      .updateAttributes(blockType, { [key]: value })
      .run();
  }
  function indent(dir: number) {
    if (e.isActive("listItem")) {
      if (dir > 0) c().sinkListItem("listItem").run();
      else c().liftListItem("listItem").run();
      return;
    }
    block(
      "marginLeft",
      Math.max(
        0,
        (parseInt(e.getAttributes(blockType).marginLeft) || 0) + dir * 16,
      ) + "px",
    );
  }
  async function clipboard(op: string) {
    try {
      if (op === "paste" && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes("text/html")) {
            const value = await (await item.getType("text/html")).text();
            e.chain().focus().insertContent(DOMPurify.sanitize(value)).run();
            return;
          }
          if (item.types.includes("text/plain")) {
            e.view.pasteText(await (await item.getType("text/plain")).text());
            return;
          }
        }
        return;
      }
      if (op === "plain" || op === "paste") {
        e.view.pasteText(await navigator.clipboard.readText());
        return;
      }
      e.commands.focus();
      if (!document.execCommand(op))
        notify("Use the keyboard shortcut to access the clipboard.");
    } catch (ex) {
      notify(String(ex));
    }
  }
  function paint() {
    if (!painter.current) {
      painter.current = [...(e.state.storedMarks || sel.$from.marks())];
      notify("Select the target text, then click Format painter again.");
      return;
    }
    const tr = e.state.tr.removeMark(sel.from, sel.to);
    for (const m of painter.current) tr.addMark(sel.from, sel.to, m);
    e.view.dispatch(tr);
    painter.current = null;
  }
  function page(change: Record<string, string>) {
    update({ settings: { ...doc.settings, ...change } });
  }
  const select = (
    label: string,
    value: string,
    items: string[],
    change: (v: string) => void,
  ) => (
    <select
      title={label}
      aria-label={label}
      value={value}
      onChange={(ev) => change(ev.target.value)}
    >
      {Array.from(new Set([value, ...items])).map((i) => (
        <option key={i}>{i}</option>
      ))}
    </select>
  );
  const type = e.isActive("heading", { level: 1 })
    ? "Title"
    : e.isActive("heading", { level: 2 })
      ? "Heading 1"
      : e.isActive("heading", { level: 3 })
        ? "Heading 2"
        : e.isActive("blockquote")
          ? "Quote"
          : "Normal";
  function style(v: string) {
    if (v === "Save custom style") {
      command("Custom style");
      return;
    }
    const marks = doc.settings.styles?.[v];
    if (Array.isArray(marks)) {
      const chain = c().unsetAllMarks();
      for (const mark of marks)
        if (e.schema.marks[mark.type]) chain.setMark(mark.type, mark.attrs);
      chain.run();
      return;
    }
    if (v === "Subtitle") {
      c().setParagraph().setFontSize("15pt").setColor("#5f7165").run();
      return;
    }
    if (v === "Normal") c().clearNodes().run();
    else if (v === "Quote") c().toggleBlockquote().run();
    else
      c()
        .setHeading({
          level:
            v === "Title"
              ? 1
              : v === "Heading 1"
                ? 2
                : v === "Heading 2"
                  ? 3
                  : 4,
        })
        .run();
  }
  function toggleMarks() {
    e.view.dom.classList.toggle("showmarks", !marks);
    setMarks(!marks);
  }
  const locked =
    reading && ["Home", "Insert", "Layout", "References"].includes(tab);
  return (
    <div className={"ribbon " + (locked ? "locked" : "")} inert={locked}>
      {tab === "Home" ? (
        <>
          <Group name="Clipboard">
            {tile(I.Clipboard, "Paste", () => clipboard("paste"))}
            <div className="stack">
              {t(I.Scissors, "Cut", () => clipboard("cut"))}
              {t(I.Copy, "Copy", () => clipboard("copy"))}
            </div>
            <div className="stack">
              {t(I.ClipboardType, "Paste without formatting", () =>
                clipboard("plain"),
              )}
              {t(I.Paintbrush, "Format painter", paint)}
            </div>
          </Group>
          <Group name="Font">
            <div className="two">
              <div>
                {select(
                  "Font family",
                  attrs.fontFamily || "Aptos",
                  [
                    "Aptos",
                    "Arial",
                    "Calibri",
                    "Georgia",
                    "Times New Roman",
                    "Verdana",
                  ],
                  (v) => c().setFontFamily(v).run(),
                )}
                {select(
                  "Font size",
                  String(parseFloat(attrs.fontSize) || 12),
                  [
                    "8",
                    "9",
                    "10",
                    "11",
                    "12",
                    "14",
                    "16",
                    "18",
                    "20",
                    "24",
                    "28",
                    "32",
                    "36",
                    "48",
                    "72",
                  ],
                  (v) =>
                    c()
                      .setFontSize(v + "pt")
                      .run(),
                )}
                {t(I.RemoveFormatting, "Clear formatting", () =>
                  c().unsetAllMarks().run(),
                )}
              </div>
              <div>
                {t(
                  I.Bold,
                  "Bold",
                  () => c().toggleBold().run(),
                  e.isActive("bold"),
                )}
                {t(
                  I.Italic,
                  "Italic",
                  () => c().toggleItalic().run(),
                  e.isActive("italic"),
                )}
                {t(
                  I.Underline,
                  "Underline",
                  () => c().toggleUnderline().run(),
                  e.isActive("underline"),
                )}
                {t(
                  I.Strikethrough,
                  "Strikethrough",
                  () => c().toggleStrike().run(),
                  e.isActive("strike"),
                )}
                <label className="color" title="Text highlight">
                  <I.Highlighter size={16} />
                  <b style={{ background: "#ecd65c" }} />
                  <input
                    type="color"
                    aria-label="Text highlight"
                    defaultValue="#fff191"
                    onChange={(ev) =>
                      c().setHighlight({ color: ev.target.value }).run()
                    }
                  />
                </label>
                <label className="color" title="Font color">
                  <I.Baseline size={17} />
                  <b />
                  <input
                    type="color"
                    aria-label="Font color"
                    defaultValue="#26584b"
                    onChange={(ev) => c().setColor(ev.target.value).run()}
                  />
                </label>
              </div>
            </div>
          </Group>
          <Group name="Paragraph">
            <div className="two">
              <div>
                {t(
                  I.List,
                  "Bulleted list",
                  () => c().toggleBulletList().run(),
                  e.isActive("bulletList"),
                )}
                {t(
                  I.ListOrdered,
                  "Numbered list",
                  () => c().toggleOrderedList().run(),
                  e.isActive("orderedList"),
                )}
                {t(I.IndentDecrease, "Decrease indent", () => indent(-1))}
                {t(I.IndentIncrease, "Increase indent", () => indent(1))}
                {t(I.Pilcrow, "Formatting marks", toggleMarks, marks)}
              </div>
              <div>
                {(["left", "center", "right", "justify"] as const).map((a, i) =>
                  t(
                    [I.AlignLeft, I.AlignCenter, I.AlignRight, I.AlignJustify][
                      i
                    ],
                    "Align " + a,
                    () => c().setTextAlign(a).run(),
                    (e.getAttributes(blockType).textAlign || "left") === a,
                  ),
                )}
                {t(I.WrapText, "Cycle line spacing", () =>
                  c()
                    .setLineHeight(
                      attrs.lineHeight === "1.5"
                        ? "2"
                        : attrs.lineHeight === "2"
                          ? "1"
                          : "1.5",
                    )
                    .run(),
                )}
              </div>
            </div>
          </Group>
          <Group name="Styles">
            <div className="stylegallery">
              {["Normal", "Title", "Heading 1"].map((v) => (
                <button
                  className={type === v ? "selstyle" : ""}
                  key={v}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => style(v)}
                >
                  <span className={"preview p" + v.split(" ")[0]}>Aa</span>
                  {v}
                </button>
              ))}
              <select
                aria-label="More styles"
                value=""
                onChange={(ev) => style(ev.target.value)}
              >
                <option value="">⌄</option>
                {[
                  "Normal",
                  "Title",
                  "Subtitle",
                  "Heading 1",
                  "Heading 2",
                  "Heading 3",
                  "Quote",
                  ...(doc.live ? [] : ["Save custom style"]),
                  ...Object.keys(doc.settings.styles || {}),
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          </Group>
          <Group name="Editing">
            {tile(I.Search, "Find", () => command("Find and replace"))}
          </Group>
        </>
      ) : tab === "File" ? (
        <>
          <Group name="Documents">
            {tile(I.FilePlus2, "New document")}
            {tile(I.FolderOpen, "Documents")}
            {tile(I.Pencil, "Rename")}
            {tile(I.Save, "Save")}
            {tile(I.CopyPlus, "Save as")}
            {tile(I.FolderInput, "Move to folder")}
          </Group>
          <Group name="Import and export">
            {tile(I.FileInput, "Import file", () => file.current?.click())}
            {tile(I.FileOutput, "Export TXT", () =>
              download(doc.title + ".txt", e.getText(), "text/plain"),
            )}
            {tile(I.Code, "Export HTML", () =>
              download(
                doc.title + ".html",
                '<!doctype html><meta charset="utf-8">' + e.getHTML(),
                "text/html",
              ),
            )}
            {tile(I.FileOutput, "Export DOCX", () =>
              wordExport(doc).catch((ex) => notify(String(ex))),
            )}
            {tile(I.FileDown, "Export PDF", () =>
              wordExport(doc, "pdf").catch((ex) => notify(String(ex))),
            )}
            {tile(I.Printer, "Print")}
            <input
              hidden
              type="file"
              ref={file}
              accept=".docx,.html,.htm,.txt"
              onChange={async (ev) => {
                const f = ev.target.files?.[0];
                if (!f) return;
                try {
                  await importFile(f, e);
                } catch (ex) {
                  notify(String(ex));
                }
                ev.target.value = "";
              }}
            />
          </Group>
        </>
      ) : tab === "Insert" ? (
        <>
          <Group name="Objects">
            {tile(I.Table, "Table")}
            {tile(I.Image, "Image")}
            {tile(I.Square, "Text box", () =>
              c()
                .insertContent({
                  type: "textBox",
                  content: [{ type: "paragraph" }],
                })
                .run(),
            )}
            {tile(I.Sigma, "Equation")}
          </Group>
          {e.isActive("table") && (
            <Group name="Table editing">
              {tile(I.Plus, "Add row", () => c().addRowAfter().run())}
              {tile(I.Plus, "Add column", () => c().addColumnAfter().run())}
              {tile(I.Minus, "Delete row", () => c().deleteRow().run())}
              {tile(I.Minus, "Delete column", () => c().deleteColumn().run())}
              {tile(I.Merge, "Merge / split", () => c().mergeOrSplit().run())}
              {tile(I.Trash, "Delete table", () => c().deleteTable().run())}
              <input
                type="color"
                aria-label="Cell color"
                onChange={(ev) =>
                  c().setCellAttribute("backgroundColor", ev.target.value).run()
                }
              />
              {select(
                "Cell border",
                "Border",
                ["Border", "solid", "dashed", "dotted", "none"],
                (v) => c().setCellAttribute("borderStyle", v).run(),
              )}
            </Group>
          )}
          <Group name="Insert into document">
            {tile(I.File, "Blank page", () =>
              c().insertContent([{type:"manualBreak"},{type:"paragraph"},{type:"manualBreak"}]).run()
            )}
            {tile(I.FilePlus2, "Page break", () =>
              c().insertContent({ type: "manualBreak" }).run(),
            )}
            {tile(I.Link, "Link")}
            {tile(I.Minus, "Horizontal line", () =>
              c().setHorizontalRule().run(),
            )}
            {tile(I.CalendarDays, "Date", () =>
              c().insertContent(new Date().toLocaleDateString()).run(),
            )}
            {tile(I.Clock, "Time", () =>
              c().insertContent(new Date().toLocaleTimeString()).run(),
            )}
            {select(
              "Insert symbol",
              "Symbol",
              ["Symbol", "©", "®", "§", "±", "→", "π", "∞", "°"],
              (v) => c().insertContent(v).run(),
            )}
            {tile(I.Bookmark, "Bookmark")}
            {tile(I.PanelTop, "Header and footer")}
          </Group>
        </>
      ) : tab === "Layout" ? (
        <>
          <Group name="Page setup">
            {tile(I.Settings2, "Page settings")}
            {select(
              "Paper size",
              doc.settings.size || "A4",
              ["A4", "Letter", "Legal"],
              (v) =>
                page({
                  size: v,
                  width: v === "A4" ? "210mm" : "8.5in",
                  height:
                    v === "A4" ? "297mm" : v === "Legal" ? "14in" : "11in",
                }),
            )}
            {tile(I.RectangleHorizontal, "Rotate page", () =>
              page({
                width: doc.settings.height || "297mm",
                height: doc.settings.width || "210mm",
              }),
            )}
            {select(
              "Margins",
              doc.settings.margin || "22mm",
              ["12mm", "18mm", "22mm", "25.4mm", "32mm"],
              (v) => page({ margin: v }),
            )}
          </Group>
          <Group name="Paragraph">
            {select(
              "Left indentation", e.getAttributes(blockType).marginLeft || "0px",
              ["0px","16px","32px","48px","64px"], v=>block("marginLeft",v)
            )}
            {select("Right indentation", e.getAttributes(blockType).marginRight || "0px",
              ["0px","16px","32px","48px","64px"], v=>block("marginRight",v))}
            {select("Space before",e.getAttributes(blockType).marginTop || "0pt",
              ["0pt","6pt","12pt","18pt","24pt"],v=>block("marginTop",v))}
            {select("Line spacing",attrs.lineHeight || "1.65",
              ["1","1.15","1.5","1.65","2"],v=>c().setLineHeight(v).run())}
            {select(
              "Space after paragraph",
              "Space after",
              ["Space after", "0pt", "6pt", "12pt", "18pt"],
              (v) => block("marginBottom", v),
            )}
            {t(I.PaintBucket, "Toggle shading", () =>
              block(
                "backgroundColor",
                e.getAttributes(blockType).backgroundColor ? "" : "#e2eeea",
              ),
            )}
            {t(I.PanelBottom, "Toggle bottom border", () =>
              block(
                "borderBottom",
                e.getAttributes(blockType).borderBottom
                  ? ""
                  : "1px solid #81958e",
              ),
            )}
          </Group>
          <Group name="Text">
            {t(I.AArrowUp, "Increase font size", () =>
              c()
                .setFontSize(
                  Math.min(144, (parseFloat(attrs.fontSize) || 12) + 1) + "pt",
                )
                .run(),
            )}
            {t(I.AArrowDown, "Decrease font size", () =>
              c()
                .setFontSize(
                  Math.max(6, (parseFloat(attrs.fontSize) || 12) - 1) + "pt",
                )
                .run(),
            )}
            {select(
              "Change case",
              "Change case",
              ["Change case", "Uppercase", "Lowercase", "Title case"],
              (v) => {
                const ranges: { from: number; to: number; value: string }[] =
                  [];
                e.state.doc.nodesBetween(sel.from, sel.to, (node, pos) => {
                  if (!node.isText) return;
                  const from = Math.max(sel.from, pos),
                    to = Math.min(sel.to, pos + node.nodeSize);
                  if (to <= from) return;
                  const text = node.text!.slice(from - pos, to - pos);
                  ranges.push({
                    from,
                    to,
                    value:
                      v === "Uppercase"
                        ? text.toUpperCase()
                        : v === "Lowercase"
                          ? text.toLowerCase()
                          : text.replace(/\b\w/g, (ch) => ch.toUpperCase()),
                  });
                });
                const tr = e.state.tr;
                for (const r of ranges.reverse())
                  tr.insertText(r.value, r.from, r.to);
                e.view.dispatch(tr);
              },
            )}
            {t(I.Superscript, "Superscript", () =>
              c().toggleSuperscript().run(),
            )}
            {t(I.Subscript, "Subscript", () => c().toggleSubscript().run())}
          </Group>
        </>
      ) : tab === "References" ? (
        <Group name="References">
          {tile(I.Link2, "Cross-reference")}
          {tile(I.BookOpen, "Endnote")}
          {tile(I.Quote, "Citation")}
          {tile(I.Type, "Caption")}
          {tile(I.ListTree, "Heading navigation", toggleOutline)}
          {tile(I.List, "Insert contents", () =>
            c().insertContent({ type: "contentsList" }).run(),
          )}
        </Group>
      ) : tab === "Review" ? (
        <Group name="Review">
          {tile(I.MessageSquare, "Comments")}
          {tile(I.SpellCheck, "Spellcheck", () => {
            e.view.dom.spellcheck = !e.view.dom.spellcheck;
            notify(e.view.dom.spellcheck ? "Spellcheck on" : "Spellcheck off");
          })}
          {tile(I.Search, "Find and replace")}
          {tile(I.Hash, "Document statistics")}
          {tile(I.FilePenLine, "Suggested changes")}
          {tile(I.GitCompare, "Compare revisions")}
          {tile(I.History, "Version history")}
        </Group>
      ) : tab === "View" ? (
        <Group name="Workspace">
          {tile(
            I.PanelLeft,
            outline ? "Hide navigation" : "Show navigation",
            toggleOutline,
          )}
          {tile(I.Ruler, ruler ? "Hide ruler" : "Show ruler", toggleRuler)}
          {tile(I.Pilcrow, "Formatting marks", toggleMarks)}
          {tile(I.Scan, "Fit page", () => {
            const frame=document.querySelector<HTMLElement>(".viewport");
            const sheet=document.querySelector<HTMLElement>(".sheetwrap");
            if(frame && sheet){
              const probe=document.createElement("div");
              probe.style.height=doc.settings.height || "297mm";
              probe.style.position="absolute";
              probe.style.visibility="hidden";
              document.body.append(probe);
              const scale=Math.min((frame.clientHeight-50)/probe.offsetHeight,(frame.clientWidth-64)/sheet.offsetWidth);
              probe.remove();
              setZoom(Math.max(25,Math.min(150,Math.floor(scale*100))));
            }
          })}
          {tile(I.Minimize, "Fit width", () =>
            setZoom(
              Math.max(
                40,
                Math.min(
                  150,
                  Math.floor(
                    (((document.querySelector(".viewport")?.clientWidth ||
                      900) -
                      64) /
                      (document.querySelector<HTMLElement>(".sheetwrap")
                        ?.offsetWidth || 794)) *
                      100,
                  ),
                ),
              ),
            ),
          )}
          {tile(I.Maximize, "Full screen", () => {
            (document.fullscreenElement
              ? document.exitFullscreen()
              : document.documentElement.requestFullscreen()
            ).catch((ex) => notify(String(ex)));
          })}
        </Group>
      ) : (
        <Group name="Help">{tile(I.Keyboard, "Keyboard shortcuts")}</Group>
      )}
    </div>
  );
}
