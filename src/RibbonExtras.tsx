import { useEffect, useState } from "react";
import { type Editor, type JSONContent } from "@tiptap/react";
import * as I from "lucide-react";
import { MoreRibbonTools } from "./MoreRibbonTools";
import { Modal } from "./App";
import { mergeRecord, recipients } from "./mailings";
import type { Doc } from "./store";

type Props = {
  editor: Editor;
  tab: string;
  doc: Doc;
  update: (v: Partial<Doc>) => void;
  notify: (v: string) => void;
  command: (v: string) => void;
  setZoom: (n: number) => void;
};
const themes = {
  Classic: ["Georgia", "#244e40"],
  Modern: ["Arial", "#254d82"],
  Editorial: ["Georgia", "#723c46"],
} as const;
const textBlock = (text: string): JSONContent => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});
export function RibbonExtras({
  editor: e,
  tab,
  doc,
  update,
  notify,
  command,
  setZoom,
}: Props) {
  const [panel, open] = useState(""),
    [input, type] = useState(""),
    [csv, setCsv] = useState(""),
    [rows, saveRows] = useState<Record<string, string>[]>([]),
    [index, select] = useState(0),
    [field, setField] = useState(""),
    [view, setView] = useState("Print layout"),
    [grid, showGrid] = useState(false),
    [dark, setDark] = useState(false),
    [focus, setFocus] = useState(false),
    [quick, saveQuick] = useState<JSONContent[]>([]),
    [shape, setShape] = useState("Rectangle");
  const [matchFrom, setMatchFrom] = useState(""),
    [matchTo, setMatchTo] = useState(""),
    [equals, setEquals] = useState(""),
    [otherwise, setOtherwise] = useState("");
  const settings = doc.settings;
  const settingsChange = (change: Record<string, unknown>) =>
    update({ settings: { ...settings, ...change } });
  const tile = (
    name: string,
    Icon: I.LucideIcon,
    run = () => {
      type("");
      open(name);
    },
  ) => (
    <button
      className="tile"
      key={name}
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={run}
    >
      <Icon size={21} />
      {name}
    </button>
  );
  const group = (name: string, children: React.ReactNode) => (
    <div className="group">
      <div className="groupbody">{children}</div>
      <small>{name}</small>
    </div>
  );
  const actions = (items: [string, I.LucideIcon, (() => void)?][]) =>
    items.map(([name, Icon, run]) => tile(name, Icon, run));
  useEffect(() => {
    const root = e.view.dom.closest<HTMLElement>(".app");
    if (!root) return;
    root.dataset.workspaceView = view;
    root.classList.toggle("workspace-grid", grid);
    root.classList.toggle("workspace-dark", dark);
    root.classList.toggle("workspace-focus", focus);
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setFocus(false);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
    };
  }, [e, view, grid, dark, focus]);
  useEffect(() => {
    const paper = e.view.dom.closest<HTMLElement>(".paper");
    if (!paper) return;
    paper.dataset.watermark = settings.watermark || "";
    paper.style.setProperty("--doc-heading", settings.headingFont || "Georgia");
    paper.style.setProperty("--doc-accent", settings.accent || "#244e40");
    paper.style.setProperty("--doc-spacing", settings.spacing || "10pt");
  }, [e, settings]);
  const say = () => {
    if (!window.speechSynthesis) {
      notify("Read aloud is unavailable in this browser.");
      return;
    }
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      return;
    }
    const { from, to } = e.state.selection;
    const speech = new SpeechSynthesisUtterance(
      e.state.doc.textBetween(from, to, " ") || e.getText(),
    );
    speech.lang = settings.language || "en";
    speechSynthesis.speak(speech);
  };
  const insert = (content: JSONContent | JSONContent[]) =>
    e.chain().focus().insertContent(content).run();
  async function screenshot() {
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const v = document.createElement("video");
      v.srcObject = stream;
      await v.play();
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(1200, v.videoWidth);
      canvas.height = (canvas.width * v.videoHeight) / v.videoWidth;
      canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
      insert({
        type: "image",
        attrs: {
          src: canvas.toDataURL("image/jpeg", 0.8),
          alt: "Screen capture",
          width: 480,
        },
      });
    } catch (ex) {
      notify(String(ex));
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
    }
  }
  useEffect(() => {
    e.view.dom.lang = settings.language || "en";
  }, [e, settings.language]);
  useEffect(() => {
    if (view === "Print layout") e.commands.enablePagination();
    else e.commands.disablePagination();
  }, [e, view]);
  const errors: string[] = [];
  if (panel === "Accessibility") {
    let level = 0;
    e.state.doc.descendants((n) => {
      if (n.type.name === "image" && !n.attrs.alt)
        errors.push("An image needs alternative text.");
      if (n.type.name === "heading") {
        if (n.attrs.level > level + 1)
          errors.push("Skipped heading level at " + n.textContent);
        level = n.attrs.level;
      }
    });
  }
  function apply() {
    if (panel === "Recipients") {
      const list = recipients(csv);
      saveRows(list);
      select(0);
      setField(Object.keys(list[0])[0]);
    } else if (panel === "Match fields") {
      const before = "{{" + matchFrom + "}}",
        after = "{{" + matchTo + "}}";
      const tr = e.state.tr;
      const hits: { p: number; t: number }[] = [];
      e.state.doc.descendants((node, p) => {
        if (node.text) {
          let at = 0;
          while ((at = node.text.indexOf(before, at)) >= 0) {
            hits.push({ p: p + at, t: p + at + before.length });
            at += before.length;
          }
        }
      });
      for (const h of hits.reverse()) tr.insertText(after, h.p, h.t);
      e.view.dispatch(tr);
    } else if (panel === "Merge rule") {
      insert({
        type: "text",
        text:
          "{{IF:" + field + "|" + equals + "|" + input + "|" + otherwise + "}}",
      });
    } else if (panel === "Watermark") settingsChange({ watermark: input });
    else if (panel === "Cover page") {
      e.commands.insertContentAt(0, [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: input || doc.title }],
        },
        textBlock(""),
        { type: "manualBreak" },
      ]);
    } else if (panel === "Signature line")
      insert([
        textBlock("____________________________"),
        textBlock(input || "Signature"),
      ]);
    else if (panel === "Online video") {
      const url = new URL(input);
      if (url.protocol !== "https:") throw Error("Enter an HTTPS video URL.");
      insert({
        type: "text",
        text: input,
        marks: [{ type: "link", attrs: { href: url.href } }],
      });
    } else if (panel === "Envelopes" || panel === "Labels") {
      insert({ type: "textBox", content: input.split("\n").map(textBlock) });
      if (panel === "Envelopes")
        settingsChange({ width: "241mm", height: "105mm", margin: "15mm" });
    } else if (
      ["Chart", "Shapes", "Diagram", "WordArt", "Icons"].includes(panel)
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 260;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = settings.accent || "#245843";
      ctx.font = "24px Arial";
      if (panel === "Chart") {
        const data = input
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const i = line.lastIndexOf(",");
            return [line.slice(0, i), Number(line.slice(i + 1))] as const;
          });
        if (
          !data.length ||
          data.length > 8 ||
          data.some(([label, v]) => !label || !Number.isFinite(v) || v <= 0)
        )
          throw Error("Enter up to eight rows of label,positive number.");
        const max = Math.max(...data.map((d) => d[1]));
        data.forEach(([label, v], i) => {
          const y = 10 + i * 30;
          ctx.fillText(label, 0, y + 19, 165);
          ctx.fillRect(175, y, (v / max) * 445, 22);
          ctx.fillText(String(v), 185 + (v / max) * 445, y + 19);
        });
      } else if (panel === "Diagram") {
        const nodes = input.split("\n").filter(Boolean);
        if (!nodes.length || nodes.length > 5)
          throw Error("Enter one to five steps.");
        const w = 700 / nodes.length;
        nodes.forEach((s, i) => {
          ctx.strokeRect(5 + i * w, 90, w - 20, 70);
          ctx.fillText(s, 12 + i * w, 131, w - 32);
          if (i < nodes.length - 1) ctx.fillText("→", i * w + w - 14, 130, 21);
        });
      } else if (panel === "Shapes") {
        ctx.beginPath();
        if (shape === "Ellipse")
          ctx.ellipse(360, 130, 250, 105, 0, 0, Math.PI * 2);
        else if (shape === "Triangle") {
          ctx.moveTo(360, 10);
          ctx.lineTo(630, 245);
          ctx.lineTo(90, 245);
          ctx.closePath();
        } else ctx.rect(90, 20, 540, 220);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText(input, 360, 155, 270);
      } else {
        ctx.font =
          panel === "Icons" ? "140px Arial" : "bold italic 64px Georgia";
        ctx.fillText(panel === "Icons" ? shape : input, 20, 160, 675);
      }
      insert({
        type: "image",
        attrs: { src: canvas.toDataURL(), width: 380, alt: input || shape },
      });
    }
    open("");
  }
  const mergePreview = () => {
    try {
      const n = e.schema.nodeFromJSON(mergeRecord(e.getJSON(), rows[index]));
      return n.textBetween(0, n.content.size, "\n");
    } catch {
      return "Check the merge fields and recipient columns.";
    }
  };
  const finish = () => {
    try {
      if (!rows.length) throw Error("Select recipients first.");
      const result: JSONContent[] = [];
      for (const [i, row] of rows.entries()) {
        if (i) result.push({ type: "manualBreak" });
        result.push(...(mergeRecord(e.getJSON(), row).content || []));
      }
      e.chain().focus().setContent({ type: "doc", content: result }).run();
      open("");
    } catch (ex) {
      notify(String(ex));
    }
  };
  return (
    <>
      {tab === "Design" ? (
        <>
          {group(
            "Document formatting",
            <>
              <select
                aria-label="Document theme"
                value={settings.theme || "Classic"}
                onChange={(ev) => {
                  const theme = ev.target.value as keyof typeof themes;
                  settingsChange({
                    theme,
                    headingFont: themes[theme][0],
                    accent: themes[theme][1],
                  });
                }}
              >
                {Object.keys(themes).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <label>
                Colors
                <input
                  type="color"
                  value={settings.accent || "#244e40"}
                  onChange={(ev) => settingsChange({ accent: ev.target.value })}
                />
              </label>
              <select
                aria-label="Heading font"
                value={settings.headingFont || "Georgia"}
                onChange={(ev) =>
                  settingsChange({ headingFont: ev.target.value })
                }
              >
                {["Georgia", "Arial", "Verdana", "Times New Roman"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                aria-label="Paragraph spacing"
                value={settings.spacing || "10pt"}
                onChange={(ev) => settingsChange({ spacing: ev.target.value })}
              >
                {["0pt", "6pt", "10pt", "14pt"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              {tile("Set as default", I.Save, () => {
                localStorage.setItem(
                  "titan.design",
                  JSON.stringify({
                    theme: settings.theme,
                    headingFont: settings.headingFont,
                    accent: settings.accent,
                    spacing: settings.spacing,
                  }),
                );
                notify("Design saved for new documents.");
              })}
            </>,
          )}
          {group(
            "Page background",
            <>
              {tile("Watermark", I.Stamp)}
              {tile("Page color and borders", I.PaintBucket, () =>
                command("Page settings"),
              )}
            </>,
          )}
        </>
      ) : tab === "Mailings" ? (
        <>
          {group(
            "Create",
            actions([
              ["Envelopes", I.Mail],
              ["Labels", I.Tags],
            ]),
          )}
          {group(
            "Mail merge",
            <>
              {tile("Recipients", I.Users)}
              {rows.length > 0 && (
                <>
                  <select
                    aria-label="Merge field"
                    value={field}
                    onChange={(ev) => setField(ev.target.value)}
                  >
                    {Object.keys(rows[0]).map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                  {tile("Insert field", I.Braces, () =>
                    insert({ type: "text", text: "{{" + field + "}}" }),
                  )}
                  {tile("Greeting line", I.Type, () =>
                    insert(textBlock("Dear {{" + field + "}},")),
                  )}
                  {tile("Address block", I.Contact, () =>
                    insert(
                      Object.keys(rows[0]).map((k) =>
                        textBlock("{{" + k + "}}"),
                      ),
                    ),
                  )}
                  {tile("Match fields", I.Link2, () => {
                    setMatchFrom(field);
                    setMatchTo(field);
                    open("Match fields");
                  })}
                  {tile("Merge rule", I.ListTree)}
                  {tile("Preview results", I.Eye)}
                  {tile("Check for errors", I.ListChecks, () => {
                    try {
                      rows.forEach((r) => mergeRecord(e.getJSON(), r));
                      notify("All merge fields match the recipient columns.");
                    } catch (ex) {
                      notify(String(ex));
                    }
                  })}
                  {tile("Finish merge", I.Files)}
                </>
              )}
            </>,
          )}
        </>
      ) : tab === "View" ? (
        group(
          "Reading and windows",
          <>
            <select
              aria-label="Workspace view"
              value={view}
              onChange={(ev) => setView(ev.target.value)}
            >
              {["Print layout", "Web layout", "Outline", "Draft"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            {actions([
              ["Focus", I.Scan, () => setFocus(true)],
              ["Switch modes", I.Moon, () => setDark(!dark)],
              ["Gridlines", I.Grid, () => showGrid(!grid)],
              ["100%", I.ZoomIn, () => setZoom(100)],
              [
                "New window",
                I.AppWindow,
                () =>
                  window.open(
                    location.pathname + "?doc=" + encodeURIComponent(doc.id),
                    "_blank",
                    "noopener",
                  ),
              ],
              ["Properties", I.Info],
            ])}
          </>,
        )
      ) : tab === "Insert" ? (
        group(
          "Illustrations and text",
          actions([
            ["Cover page", I.File],
            [
              "Shapes",
              I.Shapes,
              () => {
                setShape("Rectangle");
                type("");
                open("Shapes");
              },
            ],
            [
              "Icons",
              I.Star,
              () => {
                setShape("★");
                open("Icons");
              },
            ],
            ["Diagram", I.Workflow],
            ["Chart", I.ChartColumn],
            ["Screenshot", I.Camera, screenshot],
            [
              "Video link",
              I.Video,
              () => {
                type("");
                open("Online video");
              },
            ],
            ["WordArt", I.Type],
            ["Quick parts", I.Blocks],
            ["Signature line", I.PenLine],
            ["Comment", I.MessageSquare, () => command("Comments")],
          ]),
        )
      ) : tab === "Review" ? (
        group(
          "Speech and proofing",
          <>
            {tile("Read aloud / stop", I.Volume2, say)}
            {tile("Accessibility", I.Accessibility)}
            <select
              aria-label="Proofing language"
              value={settings.language || "en"}
              onChange={(ev) => settingsChange({ language: ev.target.value })}
            >
              {Object.entries({
                en: "English",
                fr: "Français",
                de: "Deutsch",
                es: "Español",
                hi: "हिन्दी",
              }).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </>,
        )
      ) : tab === "Help" ? (
        group(
          "Help and training",
          actions([
            ["Help", I.CircleHelp],
            ["Training", I.GraduationCap],
            ["What's new", I.Newspaper],
            [
              "Support",
              I.LifeBuoy,
              () =>
                window.open(
                  "https://github.com/chvkrsubhash/Titan-/issues",
                  "_blank",
                  "noopener",
                ),
            ],
            [
              "Feedback",
              I.MessageCircle,
              () =>
                window.open(
                  "https://github.com/chvkrsubhash/Titan-/issues/new",
                  "_blank",
                  "noopener",
                ),
            ],
          ]),
        )
      ) : null}
      {["Insert", "View", "Review"].includes(tab) &&
        group(
          "Tools",
          <MoreRibbonTools
            tab={tab}
            e={e}
            doc={doc}
            update={update}
            notify={notify}
            command={command}
          />,
        )}
      {panel && (
        <Modal title={panel} close={() => open("")}>
          {panel === "Properties" ? (
            <p>
              {doc.title} · Revision {doc.revision}
              <br />
              Created {new Date(doc.created).toLocaleString()}
              <br />
              Updated {new Date(doc.updated).toLocaleString()}
            </p>
          ) : panel === "Accessibility" ? (
            <p>
              {errors.join(" ") ||
                "No missing image descriptions or skipped heading levels found."}
            </p>
          ) : panel === "Quick parts" ? (
            <>
              <button
                onClick={() => {
                  if (e.state.selection.empty) {
                    notify("Select content first.");
                    return;
                  }
                  saveQuick([
                    ...quick,
                    {
                      type: "doc",
                      content: e.state.selection.content().content.toJSON(),
                    },
                  ]);
                  open("");
                }}
              >
                Save current selection
              </button>
              {quick.map((v, i) => (
                <button
                  key={i}
                  onClick={() => {
                    insert(v.content || []);
                    open("");
                  }}
                >
                  Insert selection {i + 1}
                </button>
              ))}
            </>
          ) : panel === "Preview results" ? (
            <>
              <input
                aria-label="Find recipient"
                placeholder="Find recipient"
                onChange={(ev) => {
                  const i = rows.findIndex((r) =>
                    Object.values(r)
                      .join(" ")
                      .toLowerCase()
                      .includes(ev.target.value.toLowerCase()),
                  );
                  if (i >= 0) select(i);
                }}
              />
              <p>
                Recipient {index + 1} of {rows.length}
              </p>
              <pre>{mergePreview()}</pre>
              <button disabled={!index} onClick={() => select(index - 1)}>
                Previous
              </button>
              <button
                disabled={index + 1 >= rows.length}
                onClick={() => select(index + 1)}
              >
                Next
              </button>
            </>
          ) : panel === "Finish merge" ? (
            <>
              <p>
                Replace this document with {rows.length} personalized copies.
                File → Save as preserves a separate template.
              </p>
              <button onClick={finish}>Merge into current document</button>
            </>
          ) : ["Help", "Training", "What's new"].includes(panel) ? (
            <p>
              {panel === "Help"
                ? "Use File for opening, importing, exporting and printing. Use Review to compare revisions and manage suggestions."
                : panel === "Training"
                  ? "To create personalized letters, open Mailings, enter recipients, insert a field into your letter, then preview each recipient before finishing the merge."
                  : "Design themes, recipient-based mail merge, illustrations, read aloud and accessibility checks are available in the ribbon."}
            </p>
          ) : (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                try {
                  apply();
                } catch (ex) {
                  notify(String(ex));
                }
              }}
            >
              {panel === "Match fields" ? (
                <>
                  <label>
                    Current field name
                    <input
                      required
                      value={matchFrom}
                      onChange={(ev) => setMatchFrom(ev.target.value)}
                    />
                  </label>
                  <label>
                    Recipient column
                    <select
                      value={matchTo}
                      onChange={(ev) => setMatchTo(ev.target.value)}
                    >
                      {Object.keys(rows[0]).map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : panel === "Merge rule" ? (
                <>
                  <label>
                    If {field} equals
                    <input
                      required
                      pattern="[^|{}]+"
                      value={equals}
                      onChange={(ev) => setEquals(ev.target.value)}
                    />
                  </label>
                  <label>
                    Insert when true
                    <input
                      required
                      pattern="[^|{}]+"
                      value={input}
                      onChange={(ev) => type(ev.target.value)}
                    />
                  </label>
                  <label>
                    Otherwise insert
                    <input
                      pattern="[^|{}]*"
                      value={otherwise}
                      onChange={(ev) => setOtherwise(ev.target.value)}
                    />
                  </label>
                </>
              ) : panel === "Recipients" ? (
                <>
                  <label>
                    Import CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={async (ev) => {
                        const f = ev.target.files?.[0];
                        if (f && f.size < 1000000) setCsv(await f.text());
                        else notify("Choose a CSV under 1 MB.");
                      }}
                    />
                  </label>
                  <label>
                    Recipient CSV with column headings
                    <textarea
                      required
                      value={csv}
                      onChange={(ev) => setCsv(ev.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  {["Shapes", "Icons"].includes(panel) && (
                    <select
                      aria-label="Choose artwork"
                      value={shape}
                      onChange={(ev) => setShape(ev.target.value)}
                    >
                      {(panel === "Icons"
                        ? ["★", "✓", "●", "→", "◆"]
                        : ["Rectangle", "Ellipse", "Triangle"]
                      ).map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  )}
                  {panel !== "Icons" && (
                    <label>
                      {panel === "Chart"
                        ? "One label,value pair per line"
                        : panel === "Diagram"
                          ? "One step per line"
                          : panel === "Online video"
                            ? "HTTPS video address"
                            : "Text"}
                      <textarea
                        value={input}
                        onChange={(ev) => type(ev.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
              <button className="primary">Apply</button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
