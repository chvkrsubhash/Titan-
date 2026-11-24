import { LoadingScreen } from "./LoadingScreen";
import {
  lazy,
  Suspense,
  useState,
  useRef,
  useEffect,
  useCallback,
  Component,
  type ReactNode,
} from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as I from "lucide-react";
import { extensions } from "./extensions";
import {
  api,
  listDocs,
  newDoc,
  persist,
  templates,
  versions,
  type Doc,
} from "./store";
import { richExtensions, px, escapeText } from "./advanced";
import { More, Comments, extraDialogs } from "./More";
import { Compare } from "./Compare";
import { Suggestions } from "./Suggestions";
import { Ribbon } from "./Ribbon";
import "./style.css";

const Live = lazy(() => import("./Live"));

export function Tool({
  icon: Icon,
  label,
  run,
  active = false,
  disabled = false,
}: {
  icon: I.LucideIcon;
  label: string;
  run: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={"icon " + (active ? "active" : "")}
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      <Icon size={17} strokeWidth={1.65} />
    </button>
  );
}
function Logo() {
  return (
    <img className="titan-logo" src="/titan-icon.png" alt="Titan, a product of AkashaVyom Labs" />
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal" aria-describedby={undefined}>
          <div className="modalhead">
            <Dialog.Title>{title}</Dialog.Title>
            <Tool icon={I.X} label="Close dialog" run={close} />
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export class Boundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main>
        <h1>Workspace could not open</h1>
        <p>Your saved documents are still in storage.</p>
        <button onClick={() => location.reload()}>Reload workspace</button>
      </main>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  const [account, setAccount] = useState(""),
    [docs, setDocs] = useState<Doc[]>([]),
    [opened, open] = useState<Doc | null>(null),
    [ready, setReady] = useState(false),
    [auth, setAuth] = useState(false),
    [register, reg] = useState(false),
    [error, err] = useState(""),
    [filter, setFilter] = useState("My documents"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("updated"),
    [grid, setGrid] = useState(false);
  const [cloudTemplates, setCloudTemplates] = useState<
    { title: string; content: Doc["content"] }[]
  >([]);
  const [folder, selectFolder] = useState(""),
    [defaultZoom, saveZoom] = useState(
      Number(localStorage.getItem("avl.zoom") || 85),
    );
  const boot = useCallback(async (email: string, initial = false) => {
    let items = await listDocs(email);
    if (initial && !email && !items.length) {
      items = [await persist(newDoc("Project proposal"), "")];
    }
    setDocs(items);
    setAccount(email);
    if (!email && new URLSearchParams(location.search).has("doc") && !items.some(d=>d.id===new URLSearchParams(location.search).get("doc") && !d.deleted))
      setAuth(true);
    const requested = new URLSearchParams(location.search).get("doc");
    const last = requested || sessionStorage.getItem("last:" + email);
    const doc = requested
      ? items.find((d) => d.id === requested && !d.deleted)
      : initial
        ? items.find((d) => d.id === last && !d.deleted) ||
          items.find((d) => !d.deleted)
        : undefined;
    if (requested && email && !doc)
      err("This account has no access to the requested document.");
    if (doc) sessionStorage.setItem("last:" + email, doc.id);
    open(doc || null);
    setReady(true);
  }, []);
  useEffect(() => {
    (async () => {
      let email = "";
      try {
        email = (await api("/me")).email;
      } catch {}
      await boot(email, true);
    })().catch((e) => err(e.message));
  }, [boot]);
  const pick = (d: Doc) => {
    open(d);
    sessionStorage.setItem("last:" + account, d.id);
  };
  useEffect(() => {
    if (!account) {
      setCloudTemplates([]);
      return;
    }
    let active = true;
    api("/templates")
      .then((items) => {
        if (active) setCloudTemplates(items);
      })
      .catch((e) => err(String(e)));
    return () => {
      active = false;
    };
  }, [account]);
  const create = async (t: string) => {
    try {
      const draft = newDoc(t),
        template = cloudTemplates.find((v) => v.title === t);
      if (template) draft.content = template.content;
      const d = await persist(draft, account);
      pick(d);
    } catch (e) {
      err(String(e));
    }
  };
  const dashboard = async () => {
    try {
      window.history.replaceState(null, "", location.pathname);
      setDocs(await listDocs(account));
      open(null);
    } catch (e) {
      err(String(e));
    }
  };
  const actions = async (d: Doc, change: Partial<Doc>) => {
    try {
      await persist({ ...d, ...change }, account);
      await dashboard();
    } catch (e) {
      err(String(e));
    }
  };
  const visible = docs
    .filter(
      (d) =>
        d.deleted === (filter === "Trash") &&
        (!folder || d.folder === folder) &&
        (filter !== "Shared with me" || (!!d.owner && d.owner !== account)) &&
        (filter !== "Favorites" || d.favorite) &&
        d.title.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : b.updated.localeCompare(a.updated),
    );
  return (
    <>
      {error && (
        <div role="alert" className="alert">
          {error}
          <button onClick={() => err("")}>Dismiss</button>
        </div>
      )}
      {!ready ? (
        <LoadingScreen />
      ) : opened?.live ? (
        <Suspense fallback={<LoadingScreen label="Opening shared document…" />}>
          <Live
            key={opened.id}
            doc={opened}
            account={account}
            exit={dashboard}
          />
        </Suspense>
      ) : opened ? (
        <Workspace
          key={account + opened.id}
          initial={opened}
          account={account}
          dashboard={dashboard}
          pick={pick}
          profile={(d) => {
            open(d);
            setAuth(true);
          }}
        />
      ) : (
        <div className="library">
          <header>
            <Logo />
            <button onClick={() => setAuth(true)}>
              {account || "Sign in"}
            </button>
          </header>
          <div className="librarybody">
            <aside>
              <small>WORKSPACE</small>
              {[
                "Home",
                "My documents",
                "Recent",
                "Favorites",
                "Shared with me",
                "Templates",
                "Trash",
                "Settings",
              ].map((n, i) => {
                const Icon = [
                  I.House,
                  I.Files,
                  I.Clock3,
                  I.Star,
                  I.Users,
                  I.LayoutTemplate,
                  I.Trash2,
                  I.Settings,
                ][i];
                return (
                  <button
                    key={n}
                    className={filter === n ? "selected" : ""}
                    onClick={() => {
                      setFilter(n);
                      selectFolder("");
                    }}
                  >
                    <Icon size={17} />
                    {n}
                  </button>
                );
              })}
            </aside>
            <main>
              <div className="libtitle">
                <h1>{filter}</h1>
                <button
                  className="primary"
                  onClick={() => create("Blank document")}
                >
                  <I.Plus size={16} />
                  New document
                </button>
              </div>
              {filter === "Home" && (
                <div className="cards">
                  {[
                    "Blank document",
                    "Project proposal",
                    "Meeting minutes",
                  ].map((t) => (
                    <button key={t} onClick={() => create(t)}>
                      <I.FilePlus2 />
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {filter === "Settings" ? (
                <label className="setting">
                  Default editor zoom
                  <select
                    value={defaultZoom}
                    onChange={(ev) => {
                      saveZoom(+ev.target.value);
                      localStorage.setItem("avl.zoom", ev.target.value);
                    }}
                  >
                    {[60, 75, 85, 100, 125, 150].map((n) => (
                      <option value={n} key={n}>
                        {n}%
                      </option>
                    ))}
                  </select>
                </label>
              ) : filter === "Templates" ? (
                <div className="cards">
                  {Object.keys(templates).map((t) => (
                    <button key={t} onClick={() => create(t)}>
                      <I.FileText />
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="filters">
                    <I.Search size={16} />
                    <input
                      placeholder="Search documents"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <select
                      aria-label="Filter by folder"
                      value={folder}
                      onChange={(ev) => selectFolder(ev.target.value)}
                    >
                      <option value="">All folders</option>
                      {Array.from(
                        new Set(docs.map((d) => d.folder).filter(Boolean)),
                      ).map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Sort documents"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="updated">Last edited</option>
                      <option value="title">Name</option>
                    </select>
                    <Tool
                      icon={grid ? I.List : I.LayoutGrid}
                      label="Switch view"
                      run={() => setGrid(!grid)}
                    />
                  </div>
                  <div className={grid ? "cards" : "rows"}>
                    {visible.map((d) => (
                      <div key={d.id} className="docrow">
                        <I.FileText size={23} />
                        <button disabled={d.deleted} onClick={() => pick(d)}>
                          <b>{d.title}</b>
                          <small>
                            {d.folder || "My documents"} ·{" "}
                            {d.owner || account || "On this device"} ·{" "}
                            {new Date(d.updated).toLocaleDateString()}
                          </small>
                        </button>
                        {(!d.owner || d.owner === account) && (
                          <>
                            <Tool
                              icon={I.Star}
                              label="Favorite"
                              active={d.favorite}
                              run={() => actions(d, { favorite: !d.favorite })}
                            />
                            <Tool
                              icon={d.deleted ? I.RotateCcw : I.Trash2}
                              label={d.deleted ? "Restore" : "Move to trash"}
                              run={() => actions(d, { deleted: !d.deleted })}
                            />
                          </>
                        )}
                      </div>
                    ))}
                    {!visible.length && <p>No documents here.</p>}
                  </div>
                </>
              )}
            </main>
          </div>
        </div>
      )}
      {auth && (
        <Modal
          title={account ? "Account" : register ? "Create account" : "Sign in"}
          close={() => setAuth(false)}
        >
          {account ? (
            <>
              <p>{account}</p>
              <button
                onClick={async () => {
                  try {
                    await api("/session", "DELETE");
                    await boot("");
                    setAuth(false);
                  } catch (e) {
                    err(String(e));
                  }
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                try {
                  const u = await api(
                    "/auth/" + (register ? "register" : "login"),
                    "POST",
                    Object.fromEntries(data),
                  );
                  if (
                    opened &&
                    !account &&
                    !new URLSearchParams(location.search).has("doc")
                  ) {
                    const copy = await persist(
                      {
                        ...opened,
                        id: crypto.randomUUID(),
                        revision: 0,
                        created: new Date().toISOString(),
                      },
                      u.email,
                    );
                    setAccount(u.email);
                    setDocs(await listDocs(u.email));
                    pick(copy);
                  } else await boot(u.email);
                  setAuth(false);
                } catch (ex) {
                  err(String(ex));
                }
              }}
            >
              {opened &&
                !account &&
                !new URLSearchParams(location.search).has("doc") && (
                  <p>Signing in copies “{opened.title}” into your account.</p>
                )}
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={10}
                  required
                  autoComplete={register ? "new-password" : "current-password"}
                />
              </label>
              <button className="primary">
                {register ? "Create account" : "Sign in"}
              </button>
              <button type="button" onClick={() => reg(!register)}>
                {register ? "Use existing account" : "Create account"}
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

function Workspace({
  initial,
  account,
  dashboard,
  pick,
  profile,
}: {
  initial: Doc;
  account: string;
  dashboard: () => void;
  pick: (d: Doc) => void;
  profile: (doc: Doc) => void;
}) {
  const [doc, setDoc] = useState(initial),
    current = useRef(initial),
    dirty = useRef(false),
    attempt = useRef(0),
    pending = useRef<Promise<boolean> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState("Saved"),
    [tab, setTab] = useState("Home"),
    [outline, setOutline] = useState(true),
    [ruler, setRuler] = useState(true),
    [reading, setReading] = useState(false),
    [zoom, setZoom] = useState(Number(localStorage.getItem("avl.zoom") || 85)),
    [modal, dialog] = useState(""),
    [message, notify] = useState(""),
    [history, setHistory] = useState<Doc[]>([]),
    [search, setSearch] = useState(""),
    [matches, setMatches] = useState(0),
    [highlight, setHighlight] = useState(0);
  const [comments, setComments] = useState(false),
    [pg, setPg] = useState([1, 1]);
  const frame = useRef<HTMLDivElement>(null),
    draftKey = "draft:" + account + ":" + doc.id;
  const [recovery, setRecovery] = useState<Doc | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey) || "null");
    } catch {
      return null;
    }
  });
  const flush = useCallback(async (): Promise<boolean> => {
    if (pending.current) return pending.current;
    pending.current = (async () => {
      try {
        while (dirty.current) {
          const snap = current.current;
          setStatus("Saving…");
          const saved = await persist(snap, account);
          dirty.current = current.current !== snap;
          current.current = {
            ...current.current,
            revision: saved.revision,
            updated: saved.updated,
          };
          setDoc(current.current);
        }
        sessionStorage.removeItem(draftKey);
        setStatus("Saved");
        attempt.current = 0;
        return true;
      } catch (e) {
        setStatus("Unsaved");
        notify(String(e));
        if (!String(e).includes("revision") && attempt.current < 3) {
          attempt.current++;
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, 1000 * 2 ** attempt.current);
        }
        return false;
      }
    })();
    try {
      return await pending.current;
    } finally {
      pending.current = null;
    }
  }, [account, draftKey]);
  function update(change: Partial<Doc>) {
    const next = { ...current.current, ...change };
    current.current = next;
    dirty.current = true;
    attempt.current = 0;
    setDoc(next);
    setStatus("Unsaved");
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      notify("Session recovery storage is full. Save before closing.");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 650);
  }
  const editor = useEditor(
    {
      extensions: [...extensions, ...richExtensions],
      content: initial.content,
      editorProps: {
        attributes: {
          "aria-label": "Document content",
          spellcheck: "true",
          role: "textbox",
          "aria-multiline": "true",
        },
      },
      onUpdate: ({ editor: e }) => update({ content: e.getJSON() }),
    },
    [],
  );
  useEffect(() => {
    function unload(e: BeforeUnloadEvent) {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("beforeunload", unload);
      clearTimeout(timer.current);
    };
  }, []);
  async function leave(fn: () => void) {
    if (await flush()) fn();
  }
  async function duplicate(title: string) {
    try {
      const copy = await persist(
        {
          ...current.current,
          id: crypto.randomUUID(),
          title,
          revision: 0,
          created: new Date().toISOString(),
        },
        account,
      );
      if (dirty.current) {
        sessionStorage.removeItem(draftKey);
        dirty.current = false;
      }
      pick(copy);
    } catch (e) {
      notify(String(e));
    }
  }
  const newDocument = () =>
    leave(async () => {
      try {
        pick(await persist(newDoc(), account));
      } catch (e) {
        notify(String(e));
      }
    });
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (["s", "n", "f", "h", "p"].includes(k)) {
        e.preventDefault();
        if (k === "s") void flush();
        if (k === "n") newDocument();
        if (k === "p") window.print();
        if (k === "f" || k === "h") dialog("Find and replace");
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });
  useEffect(() => {
    if (!editor) return;
    const s = doc.settings,
      m = px(s.margin || "22mm");
    editor
      .chain()
      .updatePageWidth(px(s.width || "210mm"))
      .updatePageHeight(px(s.height || "297mm"))
      .updateMargins({
        left: m,
        right: m,
        top: s.headerSpace ? px(s.headerSpace + "mm") : m * 0.65,
        bottom: s.footerSpace ? px(s.footerSpace + "mm") : m * 0.65,
      })
      .updateContentMargins({ top: m * 0.35, bottom: m * 0.35 })
      .updateHeaderContent(escapeText(s.header || ""), "")
      .updateFooterContent(
        escapeText(s.footer || ""),
        s.pageNumbers === false ? "" : "{page}",
      )
      .run();
  }, [editor, doc.settings]);
  useEffect(() => {
    if (!editor || !frame.current) return;
    const view = frame.current;
    const read = () => {
      const pages = Array.from(
        editor.view.dom.querySelectorAll(".rm-page-footer"),
      );
      const top = view.getBoundingClientRect().top;
      const i = pages.findIndex((p) => p.getBoundingClientRect().bottom > top);
      const next = [
        i < 0 ? Math.max(pages.length, 1) : i + 1,
        Math.max(1, pages.length),
      ];
      setPg((prev) =>
        prev[0] === next[0] && prev[1] === next[1] ? prev : next,
      );
    };
    const obs = new MutationObserver(read);
    obs.observe(editor.view.dom, { childList: true, subtree: true });
    view.addEventListener("scroll", read);
    read();
    return () => {
      obs.disconnect();
      view.removeEventListener("scroll", read);
    };
  }, [editor]);
  useEffect(() => {
    if (!editor) return;
    let raf = 0;
    const adjust = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const root = editor.view.dom,
          scale = root.getBoundingClientRect().width / root.offsetWidth;
        const footers = Array.from(root.querySelectorAll(".rm-page-footer"));
        for (const br of root.querySelectorAll<HTMLElement>(".manualbreak")) {
          const top = br.getBoundingClientRect().top;
          const foot = footers.find(
            (el) => el.getBoundingClientRect().top >= top,
          );
          if (foot && scale > 0) {
            const height = Math.max(
              1,
              Math.ceil((foot.getBoundingClientRect().top - top) / scale),
            );
            if (Math.abs(br.offsetHeight - height) > 1)
              br.style.height = height + "px";
          }
        }
      });
    };
    editor.on("update", adjust);
    const obs = new ResizeObserver(adjust);
    obs.observe(editor.view.dom);
    adjust();
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      editor.off("update", adjust);
    };
  }, [editor, zoom, doc.settings]);
  if (!editor) return <LoadingScreen label="Opening document…" />;
  const heads: { text: string; pos: number; level: number }[] = [];
  editor.state.doc.descendants((n, pos) => {
    if (n.type.name === "heading")
      heads.push({ text: n.textContent, pos, level: n.attrs.level });
  });
  const words = editor.getText().trim().split(/\s+/).filter(Boolean).length;
  const command = (name: string) => {
    if (name === "Comments") {
      setComments(!comments);
      return;
    }
    if (name === "Documents") return void leave(dashboard);
    if (name === "New document") return newDocument();
    if (name === "Save") return void flush();
    if (name === "Print") return window.print();
    if (["Version history", "Compare revisions"].includes(name))
      versions(current.current, account)
        .then(setHistory)
        .catch((e) => notify(String(e)));
    dialog(name);
  };
  async function shareDocument() {
    if (!editor) return;
    if (!account) {
      if (await flush()) {
        dialog("");
        profile(current.current);
      }
      return;
    }
    if (!(await flush())) return;
    try {
      const [{ prosemirrorJSONToYDoc }, Y, { encode }] = await Promise.all([
        import("@tiptap/y-tiptap"),
        import("yjs"),
        import("./Live"),
      ]);
      const seed = prosemirrorJSONToYDoc(
        editor.schema,
        editor.getJSON(),
        "default",
      );
      await api("/documents/" + doc.id + "/live", "POST", {
        revision: current.current.revision,
        initial: encode(Y.encodeStateAsUpdate(seed)),
      });
      seed.destroy();
      pick({ ...current.current, live: true, role: "owner", owner: account });
    } catch (ex) {
      notify(String(ex));
    }
  }
  const title = doc.title;
  const profileName = account ? account.slice(0, 2).toUpperCase() : "AV";
  return (
    <div className={"app " + (reading ? "reading" : "")}>
      <header className="top">
        <Logo />
        <span className="rule" />
        <button className="crumb" onClick={() => leave(dashboard)}>
          Documents
        </button>
        <I.ChevronRight size={13} />
        <button
          className="docname"
          title="Rename document"
          onClick={() => dialog("Rename")}
        >
          {title}
        </button>
        <span
          className="save"
          title={account ? "Cloud document" : "Stored on this device"}
        >
          <I.Cloud size={17} />
          {status}
        </span>
        <div className="push" />
        <Tool
          icon={I.Undo2}
          label="Undo"
          disabled={!editor.can().undo()}
          run={() => editor.chain().focus().undo().run()}
        />
        <Tool
          icon={I.Redo2}
          label="Redo"
          disabled={!editor.can().redo()}
          run={() => editor.chain().focus().redo().run()}
        />
        <span className="rule" />
        <button className="commentsbtn" onClick={() => setComments(!comments)}>
          <I.MessageSquareText size={15} />
          Comments
        </button>
        <button
          className="primary librarybtn"
          onClick={() => dialog("Share document")}
        >
          <I.Share2 size={15} />
          Share
        </button>
        <button
          className="avatar"
          title="Account"
          onClick={() => leave(() => profile(current.current))}
        >
          {profileName}
        </button>
      </header>
      <nav className="tabs">
        {[
          "File",
          "Home",
          "Insert",
          "Design",
          "Layout",
          "References",
          "Mailings",
          "Review",
          "View",
          "Help",
        ].map((n) => (
          <button
            key={n}
            onClick={() => setTab(n)}
            className={n === tab ? "current" : ""}
          >
            {n}
          </button>
        ))}
        <button
          className="mode"
          onClick={() => {
            editor.setEditable(reading);
            setReading(!reading);
          }}
        >
          {reading ? <I.BookOpen size={14} /> : <I.Pencil size={14} />}{" "}
          {reading ? "Reading" : "Editing"} <I.ChevronDown size={12} />
        </button>
      </nav>
      <Ribbon
        {...{
          editor,
          tab,
          command,
          doc,
          update,
          notify,
          outline,
          ruler,
          zoom,
          setZoom,
          reading,
        }}
        toggleOutline={() => setOutline(!outline)}
        toggleRuler={() => setRuler(!ruler)}
      />
      <section className="desk">
        {outline && (
          <aside className="outline">
            <div className="sidehead">
              <span>
                <I.PanelLeft size={16} />
                Navigation
              </span>
              <Tool
                icon={I.PanelLeftClose}
                label="Hide navigation"
                run={() => setOutline(false)}
              />
            </div>
            <div className="outlabel">DOCUMENT OUTLINE</div>
            {heads.map((h, i) => (
              <button
                key={h.pos}
                className={"headinglink " + (highlight === i ? "chosen" : "")}
                onClick={() => {
                  setHighlight(i);
                  editor
                    .chain()
                    .focus()
                    .setTextSelection(h.pos + 1)
                    .scrollIntoView()
                    .run();
                }}
              >
                {h.level === 1 ? (
                  <I.FileText size={15} />
                ) : (
                  <span className="twig" />
                )}
                <span>{h.text}</span>
              </button>
            ))}
            {!heads.length && (
              <small>Add headings to navigate your document.</small>
            )}
            <div className="asidebottom">
              <I.HardDrive size={15} />
              {account ? "Account workspace" : "Local workspace"}
            </div>
          </aside>
        )}
        <div className="viewport" ref={frame}>
          <div
            className="stage"
            style={{ width: "max-content", minWidth: "100%" }}
          >
            <div
              className="sheetwrap"
              style={{ zoom: zoom / 100, width: doc.settings.width || "210mm" }}
            >
              {ruler && (
                <div className="ruler">
                  {Array.from({ length: Math.floor(px(doc.settings.width || "210mm") / px("10mm")) + 1 }, (_, i) => (
                    <span key={i} style={{position: "absolute", left: i + "cm"}}>{i}</span>
                  ))}
                </div>
              )}
              <article
                className="paper"
                style={{
                  minHeight: doc.settings.height || "297mm",
                  padding: 0,
                  background: doc.settings.background || "white",
                  outline:
                    doc.settings.pageBorder &&
                    doc.settings.pageBorder !== "none"
                      ? "1px " + doc.settings.pageBorder + " #819488"
                      : undefined,
                }}
              >
                <EditorContent editor={editor} />
              </article>
            </div>
          </div>
        </div>
        {comments && (
          <Comments
            e={editor}
            doc={doc}
            update={update}
            close={() => setComments(false)}
            author={account}
          />
        )}
      </section>
      <footer>
        <button onClick={() => setOutline(!outline)}>
          <I.PanelLeft size={14} />
        </button>
        <span>
          Page {pg[0]} of {pg[1]}
        </span>
        <i />
        <span>{words} words</span>
        <i />
        <span>{editor.getText().length} characters</span>
        <i />
        <span>English</span>
        <div className="push" />
        <I.FileText size={14} />
        <span>Print layout</span>
        <i />
        <Tool
          icon={I.Minus}
          label="Zoom out"
          run={() => setZoom(Math.max(25, zoom - 5))}
        />
        <input
          aria-label="Zoom"
          type="range"
          min="25"
          max="150"
          value={zoom}
          onChange={(e) => setZoom(+e.target.value)}
        />
        <Tool
          icon={I.Plus}
          label="Zoom in"
          run={() => setZoom(Math.min(150, zoom + 5))}
        />
        <span>{zoom}%</span>
      </footer>
      {message && (
        <div className="notice" role="alert">
          {message}
          {status === "Unsaved" && (
            <>
              <button onClick={flush}>Retry save</button>
              <button onClick={() => duplicate(title + " (recovered)")}>
                Save a copy
              </button>
            </>
          )}
          <Tool icon={I.X} label="Dismiss" run={() => notify("")} />
        </div>
      )}
      {recovery && (
        <Modal title="Recover previous edits?" close={() => setRecovery(null)}>
          <p>A draft from this tab is available for “{recovery.title}”.</p>
          <button
            className="primary"
            onClick={async () => {
              try {
                pick(
                  await persist(
                    {
                      ...recovery,
                      id: crypto.randomUUID(),
                      title: recovery.title + " (recovered)",
                      revision: 0,
                    },
                    account,
                  ),
                );
                sessionStorage.removeItem(draftKey);
              } catch (e) {
                notify(String(e));
              }
            }}
          >
            Open as a copy
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem(draftKey);
              setRecovery(null);
            }}
          >
            Discard draft
          </button>
        </Modal>
      )}
      {modal === "Suggested changes" ? (
        <Suggestions editor={editor} doc={doc} update={update} author={account} close={()=>dialog("")}/>
      ) : extraDialogs.includes(modal) ? (
        <More
          name={modal}
          e={editor}
          doc={doc}
          update={update}
          close={() => dialog("")}
          notify={notify}
        />
      ) : (
        modal && (
          <Modal title={modal} close={() => dialog("")}>
            {modal === "Share document" ? (
              <>
                <p>
                  {account
                    ? "Open this document for live editing. You can grant access to registered colleagues and copy its link."
                    : "Sign in to copy this document into your account workspace, then choose Share to invite colleagues."}
                </p>
                <button className="primary" onClick={shareDocument}>
                  {account ? "Enable live editing" : "Sign in"}
                </button>
              </>
            ) : ["Rename", "Save as", "Move to folder", "Link"].includes(
                modal,
              ) ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = String(
                    new FormData(e.currentTarget).get("value") || "",
                  ).trim();
                  if (!value) return;
                  if (modal === "Save as") void duplicate(value);
                  else if (modal === "Rename") update({ title: value });
                  else if (modal === "Move to folder")
                    update({ folder: value });
                  else {
                    if (!/^https?:\/\//i.test(value)) {
                      notify("Enter an http or https URL.");
                      return;
                    }
                    editor.chain().focus().setLink({ href: value }).run();
                  }
                  dialog("");
                }}
              >
                <label>
                  {modal === "Link"
                    ? "Web address"
                    : modal === "Move to folder"
                      ? "Folder name"
                      : "Document title"}
                  <input
                    name="value"
                    required
                    maxLength={modal === "Link" ? 2048 : 160}
                    defaultValue={
                      modal === "Rename"
                        ? title
                        : modal === "Save as"
                          ? title + " (copy)"
                          : modal === "Move to folder"
                            ? doc.folder
                            : ""
                    }
                  />
                </label>
                <button className="primary">Apply</button>
              </form>
            ) : modal === "Compare revisions" ? (
              <Compare current={doc} history={history} />
            ) : modal === "Version history" ? (
              <div>
                {history.length ? (
                  history.map((v) => (
                    <button
                      className="version"
                      key={v.revision}
                      onClick={() => {
                        editor.commands.setContent(v.content);
                        update({ title: v.title, settings: v.settings });
                        dialog("");
                      }}
                    >
                      Restore revision {v.revision} ·{" "}
                      {new Date(v.updated).toLocaleString()}
                    </button>
                  ))
                ) : (
                  <p>No previous saves.</p>
                )}
              </div>
            ) : modal === "Find and replace" ? (
              <Find
                editor={editor}
                search={search}
                setSearch={setSearch}
                matches={matches}
                setMatches={setMatches}
                reading={reading}
              />
            ) : modal === "Document statistics" ? (
              <p>
                {words} words · {editor.getText().length} characters ·{" "}
                {heads.length} headings
              </p>
            ) : (
              <div className="shortcuts">
                {[
                  ["Save", "Ctrl / ⌘ + S"],
                  ["Find", "Ctrl / ⌘ + F"],
                  ["Bold", "Ctrl / ⌘ + B"],
                  ["Undo", "Ctrl / ⌘ + Z"],
                  ["Print", "Ctrl / ⌘ + P"],
                ].map(([a, b]) => (
                  <div key={a}>
                    {a}
                    <kbd>{b}</kbd>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )
      )}
      <style>
        {"@page {size:" +
          (doc.settings.width || "210mm") +
          " " +
          (doc.settings.height || "297mm") +
          ";margin:" +
          (doc.settings.margin || "22mm") +
          ";}"}
      </style>
    </div>
  );
}

function Find({
  editor,
  search,
  setSearch,
  matches,
  setMatches,
  reading,
}: {
  editor: Editor;
  search: string;
  setSearch: (s: string) => void;
  matches: number;
  setMatches: (n: number) => void;
  reading: boolean;
}) {
  const [replacement, setReplacement] = useState("");
  function run(mode: string) {
    if (!search) return;
    const found: { from: number; to: number }[] = [];
    editor.state.doc.descendants((n, pos) => {
      if (n.isText && n.text) {
        let p = 0;
        while ((p = n.text.indexOf(search, p)) >= 0) {
          found.push({ from: pos + p, to: pos + p + search.length });
          p += search.length;
        }
      }
    });
    setMatches(found.length);
    if (!found.length) return;
    const item =
      found.find((x) => x.from >= editor.state.selection.to) || found[0];
    if (mode === "find") editor.commands.setTextSelection(item);
    else {
      const tr = editor.state.tr;
      for (const range of (mode === "all" ? found : [item]).reverse())
        tr.insertText(replacement, range.from, range.to);
      editor.view.dispatch(tr);
    }
  }
  return (
    <>
      <label>
        Find
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <label>
        Replace with
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
      </label>
      <p>{matches} matches in last search</p>
      <button onClick={() => run("find")}>Find next</button>
      <button disabled={reading} onClick={() => run("one")}>
        Replace next
      </button>
      <button disabled={reading} onClick={() => run("all")}>
        Replace all
      </button>
    </>
  );
}





