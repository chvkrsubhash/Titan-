import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Modal } from "./App";
import type { Doc } from "./store";
import * as I from "lucide-react";
const macroCommands = [
  "Bold",
  "Italic",
  "Underline",
  "Bullet list",
  "Numbered list",
  "Align left",
  "Align center",
  "Align right",
  "New paragraph",
];
export function MoreRibbonTools({
  tab,
  e,
  doc,
  update,
  notify,
  command,
}: {
  tab: string;
  e: Editor;
  doc: Doc;
  update: (v: Partial<Doc>) => void;
  notify: (m: string) => void;
  command: (m: string) => void;
}) {
  const [panel, open] = useState(""),
    [value, setValue] = useState(""),
    [sync, setSync] = useState(false),
    [side, setSide] = useState(false),
    [split, setSplit] = useState(false),
    [hideInk, hide] = useState(false),
    [target, targetLang] = useState("fr"),
    [result, report] = useState(""),
    [actions, setActions] = useState<string[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false);
  const set = (v: Record<string, unknown>) =>
    update({ settings: { ...doc.settings, ...v } });
  const selection = () =>
    e.state.doc.textBetween(e.state.selection.from, e.state.selection.to, " ");
  function show(n: string) {
    setValue(
      n === "Document notes" ? doc.settings.linkedNotes || "" : selection(),
    );
    report("");
    open(n);
  }
  const button = (
    label: string,
    Icon: I.LucideIcon,
    fn = () => show(label),
  ) => (
    <button
      className="tile"
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={fn}
    >
      <Icon size={20} />
      {label}
    </button>
  );
  useEffect(() => {
    if (!split) return;
    const pane = e.view.dom.closest(".desk"),
      view = pane?.querySelector(".viewport");
    if (!pane || !view) return;
    const mirror = document.createElement("aside");
    mirror.className = "split-reading";
    mirror.setAttribute("aria-label", "Second document view");
    pane.classList.toggle("split-horizontal", !side);
    pane.append(mirror);
    function render() {
      mirror.replaceChildren();
      const content = e.view.dom.cloneNode(true) as HTMLElement;
      content.removeAttribute("contenteditable");
      content.removeAttribute("role");
      content.removeAttribute("aria-label");
      content.removeAttribute("class");
      content.removeAttribute("style");
      content
        .querySelectorAll("[data-rm-pagination],.rm-first-page-header")
        .forEach((el) => el.remove());
      content
        .querySelectorAll("[id]")
        .forEach((el) => el.removeAttribute("id"));
      mirror.append(content);
    }
    render();
    e.on("update", render);
    const scroll = () => {
      if (sync)
        mirror.scrollTop =
          (view!.scrollTop /
            Math.max(1, view!.scrollHeight - view!.clientHeight)) *
          (mirror.scrollHeight - mirror.clientHeight);
    };
    view.addEventListener("scroll", scroll);
    return () => {
      e.off("update", render);
      view.removeEventListener("scroll", scroll);
      mirror.remove();
      pane.classList.remove("split-horizontal");
    };
  }, [e, side, split, sync]);
  useEffect(() => {
    e.view.dom.classList.toggle("hide-ink", hideInk);
  }, [e, hideInk]);
  function runMacro() {
    const chain = e.chain().focus();
    for (const op of actions) {
      if (op === "Bold") chain.toggleBold();
      else if (op === "Italic") chain.toggleItalic();
      else if (op === "Underline") chain.toggleUnderline();
      else if (op === "Bullet list") chain.toggleBulletList();
      else if (op === "Numbered list") chain.toggleOrderedList();
      else if (op === "New paragraph") chain.splitBlock();
      else if (op.startsWith("Align ")) chain.setTextAlign(op.slice(6));
    }
    chain.run();
    open("");
  }
  async function translate() {
    try {
      const impl = (
        window as unknown as {
          Translator?: {
            create: (options: {
              sourceLanguage: string;
              targetLanguage: string;
            }) => Promise<{
              translate: (s: string) => Promise<string>;
              destroy: () => void;
            }>;
          };
        }
      ).Translator;
      if (!impl)
        throw Error("This browser does not provide on-device translation.");
      const translator = await impl.create({
        sourceLanguage: doc.settings.language || "en",
        targetLanguage: target,
      });
      try {
        report(await translator.translate(value));
      } finally {
        translator.destroy();
      }
    } catch (ex) {
      report(String(ex));
    }
  }
  const docs = e.state.doc;
  return (
    <>
      {tab === "View" ? (
        <>
          {button("Split", I.Columns2, () => setSplit(!split))}
          {button("Side by side", I.PanelsTopLeft, () => {
            setSide(!side);
            setSplit(true);
          })}
          {split &&
            button(sync ? "Unlink scrolling" : "Link scrolling", I.Link2, () =>
              setSync(!sync),
            )}
          {button("Reset windows", I.RotateCcw, () => {
            setSync(false);
            setSide(false);
            setSplit(false);
          })}
          {button("Immersive reader", I.BookOpen)}
          {button("Macros", I.ListRestart, () => {
            setActions(doc.settings.macro || []);
            open("Macros");
          })}
        </>
      ) : tab === "Review" ? (
        <>
          {button("Editor", I.SpellCheck)}
          {button("Thesaurus", I.Book)}
          {button("Translate", I.Languages)}
          {button("Protect access", I.LockKeyhole, () =>
            command("Share document"),
          )}
          {button("Document notes", I.NotebookPen)}
          {button(hideInk ? "Show ink" : "Hide ink", I.Pen, () =>
            hide(!hideInk),
          )}
        </>
      ) : tab === "Insert" ? (
        <>
          {button("Ink signature", I.Signature)}
          {button("Drop cap", I.CaseUpper, () => {
            const name = e.isActive("heading") ? "heading" : "paragraph";
            e.chain()
              .focus()
              .updateAttributes(name, {
                dropCap: !e.getAttributes(name).dropCap,
              })
              .run();
          })}
        </>
      ) : null}
      {panel && (
        <Modal title={panel} close={() => open("")}>
          {panel === "Immersive reader" ? (
            <div className="immersive-text">
              {e
                .getText()
                .split("\n")
                .filter(Boolean)
                .map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
            </div>
          ) : panel === "Document notes" ? (
            <>
              <label>
                Notes linked to this document
                <textarea
                  value={value}
                  onChange={(ev) => setValue(ev.target.value)}
                />
              </label>
              <button
                onClick={() => {
                  set({ linkedNotes: value });
                  open("");
                }}
              >
                Save notes
              </button>
            </>
          ) : panel === "Macros" ? (
            <>
              <label>
                Add formatting step
                <select
                  value=""
                  onChange={(ev) => setActions([...actions, ev.target.value])}
                >
                  <option value="">Choose a step</option>
                  {macroCommands.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <ol>
                {actions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
              <button onClick={() => setActions([])}>Clear</button>
              <button
                onClick={() => {
                  set({ macro: actions });
                  notify("Formatting macro saved.");
                }}
              >
                Save macro
              </button>
              <button disabled={!actions.length} onClick={runMacro}>
                Run macro
              </button>
            </>
          ) : panel === "Editor" ? (
            <>
              <p>Repeated words and excess spaces</p>
              {(() => {
                const issues: { pos: number; text: string }[] = [];
                docs.descendants((n, p) => {
                  if (n.text)
                    for (const match of n.text.matchAll(
                      /\b(\w+)\s+\1\b| {2,}/gi,
                    ))
                      issues.push({ pos: p + match.index!, text: match[0] });
                });
                return issues.length ? (
                  issues.map((x, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        open("");
                        e.chain()
                          .focus()
                          .setTextSelection({
                            from: x.pos,
                            to: x.pos + x.text.length,
                          })
                          .scrollIntoView()
                          .run();
                      }}
                    >
                      {x.text.trim() || "Extra spaces"}
                    </button>
                  ))
                ) : (
                  <p>No matching issues found.</p>
                );
              })()}
            </>
          ) : panel === "Thesaurus" ? (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                window.open(
                  "https://www.merriam-webster.com/thesaurus/" +
                    encodeURIComponent(value.trim()),
                  "_blank",
                  "noopener",
                );
              }}
            >
              <label>
                Word to look up
                <textarea
                  required
                  value={value}
                  onChange={(ev) => setValue(ev.target.value)}
                />
              </label>
              <button>Open Merriam-Webster Thesaurus</button>
            </form>
          ) : panel === "Translate" ? (
            <>
              <label>
                Source text
                <textarea
                  value={value}
                  onChange={(ev) => setValue(ev.target.value)}
                />
              </label>
              <label>
                Translate to
                <select
                  value={target}
                  onChange={(ev) => targetLang(ev.target.value)}
                >
                  {["en", "fr", "de", "hi", "es", "it", "ja"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button onClick={translate}>Translate on device</button>
              <p>{result}</p>
            </>
          ) : (
            <>
              <canvas
                aria-label="Draw your signature"
                ref={canvas}
                width={600}
                height={180}
                style={{
                  width: "100%",
                  border: "1px solid #aaa",
                  touchAction: "none",
                }}
                onPointerDown={(ev) => {
                  const c = ev.currentTarget,
                    r = c.getBoundingClientRect(),
                    ctx = c.getContext("2d")!;
                  c.setPointerCapture(ev.pointerId);
                  drawing.current = true;
                  ctx.beginPath();
                  ctx.lineWidth = 3;
                  ctx.moveTo(
                    ((ev.clientX - r.left) * 600) / r.width,
                    ((ev.clientY - r.top) * 180) / r.height,
                  );
                }}
                onPointerMove={(ev) => {
                  if (!drawing.current) return;
                  const c = ev.currentTarget,
                    r = c.getBoundingClientRect(),
                    ctx = c.getContext("2d")!;
                  ctx.lineTo(
                    ((ev.clientX - r.left) * 600) / r.width,
                    ((ev.clientY - r.top) * 180) / r.height,
                  );
                  ctx.stroke();
                }}
                onPointerUp={() => (drawing.current = false)}
              />
              <button
                onClick={() =>
                  canvas.current?.getContext("2d")?.clearRect(0, 0, 600, 180)
                }
              >
                Clear
              </button>
              <button
                onClick={() => {
                  const c = canvas.current;
                  if (c) {
                    e.chain()
                      .focus()
                      .insertContent({
                        type: "image",
                        attrs: {
                          src: c.toDataURL(),
                          width: 300,
                          alt: "Ink signature",
                        },
                      })
                      .run();
                    open("");
                  }
                }}
              >
                Insert signature image
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
