import { LoadingScreen } from "./LoadingScreen";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import Caret from "@tiptap/extension-collaboration-caret";
import {
  ySyncPluginKey,
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from "@tiptap/y-tiptap";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import * as I from "lucide-react";
import { extensions } from "./extensions";
import { richExtensions, px, escapeText } from "./advanced";
import { api, type Doc } from "./store";
import { Modal, Tool } from "./App";
import { Ribbon } from "./Ribbon";
import { wordExport } from "./More";

export function encode(update: Uint8Array) {
  let out = "";
  for (const b of update) out += String.fromCharCode(b);
  return btoa(out);
}
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
interface Comment {
  id: string;
  text: string;
  author: string;
  quote: string;
  start: string;
  end: string;
  resolved: boolean;
}
export default function Live({
  doc,
  account,
  exit,
}: {
  doc: Doc;
  account: string;
  exit: () => void;
}) {
  const owner = doc.role === "owner" || doc.owner === account,
    canEdit = owner || doc.role === "editor";
  const ydoc = useMemo(() => new Y.Doc(), []),
    awareness = useMemo(() => new Awareness(ydoc), [ydoc]),
    socket = useRef<WebSocket | null>(null);
  const [finding, find] = useState(false),
    [query, search] = useState("");
  const [online, setOnline] = useState(false),
    [status, setStatus] = useState("Connecting…"),
    [error, err] = useState(""),
    [tab, setTab] = useState("Home"),
    [share, showShare] = useState(false),
    [showComments, show] = useState(false),
    [comments, setComments] = useState<Comment[]>([]),
    [text, setText] = useState(""),
    [users, setUsers] = useState(1),
    [access, setAccess] = useState<{ email: string; role: string }[]>([]);
  const key = "live-draft:" + account + ":" + doc.id;
  const queue = useRef<string[]>(
    JSON.parse(sessionStorage.getItem(key) || "[]"),
  );
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }),
        ...extensions.slice(1),
        ...richExtensions,
        Collaboration.configure({ document: ydoc }),
        Caret.configure({
          provider: { awareness },
          user: { name: account, color: "#508565" },
        }),
      ],
      editable: false,
      editorProps: {
        attributes: { "aria-label": "Shared document", role: "textbox" },
      },
    },
    [],
  );
  const prefix = "/documents/" + doc.id;
  useEffect(() => {
    if (!editor) return;
    const s = doc.settings,
      m = px(s.margin || "22mm");
    editor
      .chain()
      .updatePageWidth(px(s.width || "210mm"))
      .updatePageHeight(px(s.height || "297mm"))
      .updateMargins({ left: m, right: m, top: m * 0.65, bottom: m * 0.65 })
      .updateHeaderContent(escapeText(s.header || ""), "")
      .updateFooterContent(
        escapeText(s.footer || ""),
        s.pageNumbers === false ? "" : "{page}",
      )
      .run();
  }, [editor, doc.settings]);
  useEffect(() => {
    if (!editor) return;
    let disposed = false,
      retry: ReturnType<typeof setTimeout>,
      ready = false;
    function send(kind: number, bytes: Uint8Array) {
      if (socket.current?.readyState === WebSocket.OPEN) {
        const frame = new Uint8Array(bytes.length + 1);
        frame[0] = kind;
        frame.set(bytes, 1);
        socket.current.send(frame);
      }
    }
    function local(update: Uint8Array, origin: unknown) {
      if (origin === "network" || !canEdit) return;
      queue.current.push(encode(update));
      try {
        sessionStorage.setItem(key, JSON.stringify(queue.current));
      } catch {
        err("Recovery storage full. Keep this tab open until saved.");
      }
      setStatus("Saving…");
      if (ready) send(1, update);
    }
    function awarenessChanged(
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) {
      setUsers(awareness.getStates().size);
      if (ready && origin !== "network")
        send(
          2,
          encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed]),
        );
    }
    function connect() {
      ready = false;
      const ws = new WebSocket(
        (location.protocol === "https:" ? "wss://" : "ws://") +
          location.host +
          "/api/live/" +
          doc.id,
      );
      socket.current = ws;
      ws.binaryType = "arraybuffer";
      ws.onmessage = (event) => {
        if (disposed) return;
        const frame = new Uint8Array(event.data),
          data = frame.subarray(1);
        if (frame[0] === 0) {
          Y.applyUpdate(ydoc, data, "network");
          ready = true;
          setOnline(true);
          editor!.setEditable(canEdit);
          if (canEdit) {
            for (const item of queue.current) {
              const bytes = decode(item);
              Y.applyUpdate(ydoc, bytes, "network");
              send(1, bytes);
            }
          }
          send(2, encodeAwarenessUpdate(awareness, [ydoc.clientID]));
          setStatus(queue.current.length ? "Saving…" : "Saved");
        }
        if (frame[0] === 1) Y.applyUpdate(ydoc, data, "network");
        if (frame[0] === 2) applyAwarenessUpdate(awareness, data, "network");
        if (frame[0] === 3) {
          queue.current.shift();
          sessionStorage.setItem(key, JSON.stringify(queue.current));
          setStatus(queue.current.length ? "Saving…" : "Saved");
        }
      };
      ws.onclose = (ev) => {
        ready = false;
        if (disposed) return;
        setOnline(false);
        editor!.setEditable(false);
        if (ev.code === 1008) {
          setStatus("Access changed");
          err("Reopen this document to check your access.");
        } else {
          setStatus("Reconnecting…");
          retry = setTimeout(connect, 1800);
        }
      };
    }
    const unload = (ev: BeforeUnloadEvent) => {
      if (queue.current.length) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    ydoc.on("update", local);
    awareness.on("update", awarenessChanged);
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      window.removeEventListener("beforeunload", unload);
      ydoc.off("update", local);
      awareness.off("update", awarenessChanged);
      socket.current?.close();
      awareness.destroy();
      ydoc.destroy();
    };
  }, [editor]);
  useEffect(() => {
    if (!showComments) return;
    let stopped = false;
    async function refresh() {
      try {
        const items = await api(prefix + "/comments");
        if (!stopped) setComments(items);
      } catch (ex) {
        if (!stopped) err(String(ex));
      }
    }
    void refresh();
    const t = setInterval(refresh, 3000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [showComments, prefix]);
  async function loadAccess() {
    try {
      setAccess(await api(prefix + "/access"));
      showShare(true);
    } catch (ex) {
      err(String(ex));
    }
  }
  if (!editor) return <LoadingScreen label="Opening document…" />;
  async function addComment() {
    if (!editor || !text.trim()) return;
    const selection = editor.state.selection,
      binding = ySyncPluginKey.getState(editor.state)?.binding;
    if (!binding || selection.empty) {
      err("Select document text to anchor your comment.");
      return;
    }
    const position = (p: number) =>
      encode(
        Y.encodeRelativePosition(
          absolutePositionToRelativePosition(
            p,
            ydoc.getXmlFragment("default"),
            binding.mapping,
          ),
        ),
      );
    try {
      const record = await api(prefix + "/comments", "POST", {
        text,
        quote: editor.state.doc
          .textBetween(selection.from, selection.to)
          .slice(0, 2000),
        start: position(selection.from),
        end: position(selection.to),
      });
      setComments([...comments, record]);
      setText("");
    } catch (ex) {
      err(String(ex));
    }
  }
  function locate(comment: Comment) {
    const binding = ySyncPluginKey.getState(editor!.state)?.binding;
    if (!binding) return;
    const pos = (value: string) =>
      relativePositionToAbsolutePosition(
        ydoc,
        ydoc.getXmlFragment("default"),
        Y.decodeRelativePosition(decode(value)),
        binding.mapping,
      );
    const from = pos(comment.start),
      to = pos(comment.end);
    if (from !== null && to !== null)
      editor!
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .scrollIntoView()
        .run();
  }
  return (
    <div className="app">
      <header className="top">
        <img className="titan-logo" src="/titan-icon.png" alt="Titan, a product of AkashaVyom Labs" />
        <span className="rule" />
        <button onClick={exit}>Documents</button>
        <I.ChevronRight size={14} />
        <b>{doc.title}</b>
        <span className="save">{status}</span>
        <div className="push" />
        <span>{users} online</span>
        <button className="commentsbtn" onClick={() => show(!showComments)}>
          <I.MessageSquare size={15} />
          Comments
        </button>
        {owner && (
          <button className="primary" onClick={loadAccess}>
            <I.Share2 size={15} />
            Share
          </button>
        )}
      </header>
      <nav className="tabs">
        {["Home", "Export"].map((n) => (
          <button
            key={n}
            className={tab === n ? "current" : ""}
            onClick={() => setTab(n)}
          >
            {n}
          </button>
        ))}
        <span className="mode">{doc.role || "owner"}</span>
      </nav>
      {tab === "Home" ? (
        <Ribbon
          editor={editor}
          tab="Home"
          command={() => find(true)}
          doc={doc}
          update={() => {}}
          notify={err}
          outline={false}
          ruler={false}
          zoom={100}
          setZoom={() => {}}
          reading={!canEdit || !online}
          toggleOutline={() => {}}
          toggleRuler={() => {}}
        />
      ) : (
        <div className="ribbon">
          <button onClick={() => window.print()}>Print or save PDF</button>
          <button
            onClick={() =>
              wordExport({ ...doc, content: editor.getJSON() }).catch((ex) =>
                err(String(ex)),
              )
            }
          >
            Download DOCX
          </button>
        </div>
      )}
      <section className="desk">
        <div className="viewport">
          <div className="stage">
            <article
              className="paper sheetwrap"
              style={{
                width: doc.settings.width || "210mm",
                background: doc.settings.background || "white",
              }}
            >
              <EditorContent editor={editor} />
            </article>
          </div>
        </div>
        {showComments && (
          <aside className="comments">
            <div className="sidehead">
              Comments
              <Tool icon={I.X} label="Close" run={() => show(false)} />
            </div>
            {doc.role !== "viewer" && (
              <>
                <label>
                  Comment on selection
                  <textarea
                    value={text}
                    onChange={(ev) => setText(ev.target.value)}
                  />
                </label>
                <button className="primary" onClick={addComment}>
                  Add comment
                </button>
              </>
            )}
            {comments
              .filter((c) => !c.resolved)
              .map((c) => (
                <section key={c.id}>
                  <b>{c.author}</b>
                  <button onClick={() => locate(c)}>{c.quote}</button>
                  <p>{c.text}</p>
                  {doc.role !== "viewer" && (
                    <button
                      onClick={async () => {
                        try {
                          await api(prefix + "/comments/" + c.id, "PATCH");
                          setComments(comments.filter((v) => v.id !== c.id));
                        } catch (ex) {
                          err(String(ex));
                        }
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </section>
              ))}
          </aside>
        )}
      </section>
      {finding && (
        <Modal title="Find" close={() => find(false)}>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              let result: { from: number; to: number } | undefined;
              editor.state.doc.descendants((n, p) => {
                const i =
                  n.text?.toLowerCase().indexOf(query.toLowerCase()) ?? -1;
                if (!result && i >= 0)
                  result = { from: p + i, to: p + i + query.length };
              });
              if (result) {
                editor.chain().setTextSelection(result).scrollIntoView().run();
                find(false);
              } else err("No matches found.");
            }}
          >
            <label>
              Find text
              <input
                required
                value={query}
                onChange={(ev) => search(ev.target.value)}
              />
            </label>
            <button className="primary">Find</button>
          </form>
        </Modal>
      )}
      {share && (
        <Modal title="Share document" close={() => showShare(false)}>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              try {
                await api(
                  prefix + "/access",
                  "POST",
                  Object.fromEntries(new FormData(ev.currentTarget)),
                );
                await loadAccess();
              } catch (ex) {
                err(String(ex));
              }
            }}
          >
            <label>
              Account email
              <input name="email" type="email" required />
            </label>
            <label>
              Permission
              <select name="role">
                <option>editor</option>
                <option>commenter</option>
                <option>viewer</option>
              </select>
            </label>
            <button className="primary">Grant access</button>
          </form>
          {access.map((a) => (
            <div className="version" key={a.email}>
              {a.email} · {a.role}
              <button
                onClick={async () => {
                  try {
                    await api(
                      prefix + "/access/" + encodeURIComponent(a.email),
                      "DELETE",
                    );
                    await loadAccess();
                  } catch (ex) {
                    err(String(ex));
                  }
                }}
              >
                Revoke
              </button>
            </div>
          ))}
          <label>
            Document link
            <input
              readOnly
              value={location.origin + "/?doc=" + doc.id}
              onFocus={(ev) => ev.target.select()}
            />
          </label>
        </Modal>
      )}
      {error && (
        <div role="alert" className="notice">
          {error}
          <Tool icon={I.X} label="Dismiss" run={() => err("")} />
        </div>
      )}
    </div>
  );
}


