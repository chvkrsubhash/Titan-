import { useState, useMemo } from "react";

interface HelpTopic {
  id: string;
  title: string;
  category: "Getting Started" | "Ribbon Guide" | "Shortcuts" | "Collaboration & Storage" | "Export & Print";
  content: string;
  keywords: string[];
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started-overview",
    title: "Welcome to Titan Document Processor",
    category: "Getting Started",
    keywords: ["welcome", "overview", "basics", "intro", "tiptap", "word"],
    content: `Titan is an enterprise-grade document processor inspired by Microsoft Word and modern web authoring. It provides a full-featured ribbon interface, paginated continuous canvas, advanced typography, layout controls, revision history, and real-time collaboration.

To start, click **Documents** in the top navigation bar to open your personal library, create a new blank document, or choose from 10+ professional templates.`,
  },
  {
    id: "getting-started-saving",
    title: "Autosave, Drafts and Recovery",
    category: "Getting Started",
    keywords: ["save", "autosave", "recovery", "draft", "offline", "indexeddb"],
    content: `You never have to worry about losing your work in Titan:
• **Continuous Autosave:** A brief pause in typing automatically saves the current document state and records a revision snapshot.
• **Offline Guest Mode:** Before signing in, your documents are securely stored in your browser's local IndexedDB with up to 20 historical snapshots.
• **Conflict Detection & Recovery:** If a tab closes unexpectedly, reopening Titan will display a draft recovery notice allowing you to resume exactly where you left off or save a separate copy.`,
  },
  {
    id: "ribbon-home",
    title: "Home Ribbon Tab",
    category: "Ribbon Guide",
    keywords: ["home", "font", "bold", "italic", "underline", "size", "color", "align", "styles"],
    content: `The Home tab contains everyday text formatting tools:
• **Clipboard:** Cut, Copy, Paste without formatting, and Format Painter to clone styles between paragraphs.
• **Font:** Choose from 30+ Microsoft Word and web fonts, point sizes from 8pt to 72pt, Grow Font / Shrink Font, bold, italic, underline, strikethrough, subscript, superscript, text highlight, and font color.
• **Paragraph:** Bulleted and numbered lists, left/center/right/justified alignment, indent controls, paragraph shading, and border lines.
• **Styles:** Fast heading presets (Heading 1 through 4, Title, Subtitle, Quote, Code).`,
  },
  {
    id: "ribbon-insert",
    title: "Insert Ribbon Tab",
    category: "Ribbon Guide",
    keywords: ["insert", "table", "image", "symbol", "page break", "bookmark", "header", "footer", "date"],
    content: `The Insert tab allows adding structured media and document elements:
• **Pages:** Blank page and Page break (Ctrl + Enter).
• **Tables:** Insert tables, add/delete rows and columns, merge cells, cell background shading, and borders.
• **Illustrations:** Images with resizing, alignment, and captions.
• **Symbols:** Quick symbol palette and the full Word-style "More Symbols" dialog with Currency, Math, Greek letters, Arrows, Typography, Accents, and Shapes.
• **Header & Footer:** Customize header and footer text and page numbers across pages.
• **Bookmarks & Links:** Hyperlinks and named anchor bookmarks.`,
  },
  {
    id: "ribbon-layout",
    title: "Layout Ribbon Tab & Page Setup",
    category: "Ribbon Guide",
    keywords: ["layout", "margins", "orientation", "columns", "size", "page setup", "demo"],
    content: `The Layout tab controls physical page dimensions and structure:
• **Margins:** Choose presets (Normal, Narrow, Moderate, Wide) or set custom Top, Bottom, Left, Right, and Gutter margins.
• **Orientation:** Seamlessly toggle between Portrait (vertical) and Landscape (horizontal).
• **Paper Size:** Standard sizes including Letter, A4, Legal, Executive, A3, A5, and B5.
• **Columns:** Split your document text into 1, 2, 3, or Left/Right columns with adjustable column spacing and divider lines.
• **Page Setup Dialog:** Opens the classic Word-style tabbed dialog with a live dynamic preview box demonstrating real-time aspect ratio and margin guides.`,
  },
  {
    id: "ribbon-review-collab",
    title: "Review & Collaboration Tabs",
    category: "Ribbon Guide",
    keywords: ["review", "spelling", "comments", "compare", "suggestions", "statistics", "word count"],
    content: `• **Proofing:** Browser spellcheck, word count statistics (words, characters, headings, reading time).
• **Comments:** Select any passage and choose New Comment to anchor collaborative threaded comments.
• **Track Changes / Suggestions:** Record ProseMirror editing steps with visual accept / reject controls.
• **Compare Revisions:** Visually compare the open document against any historical snapshot with side-by-side redline diffs.`,
  },
  {
    id: "shortcuts-table",
    title: "Master Keyboard Shortcuts Cheat Sheet",
    category: "Shortcuts",
    keywords: ["shortcuts", "hotkeys", "keyboard", "ctrl", "keys", "commands"],
    content: `Keyboard shortcuts for rapid editing:

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) |
|---|---|---|
| Save Document | Ctrl + S | ⌘ + S |
| Find & Replace | Ctrl + F | ⌘ + F |
| Undo / Redo | Ctrl + Z / Ctrl + Y | ⌘ + Z / ⌘ + Shift + Z |
| Print Document | Ctrl + P | ⌘ + P |
| Bold | Ctrl + B | ⌘ + B |
| Italic | Ctrl + I | ⌘ + I |
| Underline | Ctrl + U | ⌘ + U |
| Heading 1 | Ctrl + Alt + 1 | ⌘ + Option + 1 |
| Heading 2 | Ctrl + Alt + 2 | ⌘ + Option + 2 |
| Heading 3 | Ctrl + Alt + 3 | ⌘ + Option + 3 |
| Bulleted List | Ctrl + Shift + 8 | ⌘ + Shift + 8 |
| Numbered List | Ctrl + Shift + 7 | ⌘ + Shift + 7 |
| Page Break | Ctrl + Enter | ⌘ + Enter |
| Clear Formatting | Ctrl + \\ | ⌘ + \\ |`,
  },
  {
    id: "collab-storage",
    title: "Real-Time Collaboration & Account Cloud Sync",
    category: "Collaboration & Storage",
    keywords: ["collaboration", "crdt", "yjs", "cloud", "multiplayer", "share", "websocket"],
    content: `• **Live Editing (CRDT / Yjs):** To collaborate live with a colleague, open an account document, choose **Share**, and click **Enable live editing**.
• **Permissions:** Grant Viewer or Editor access by entering their registered email address.
• **Presence & Carets:** Shared documents feature synchronized color-coded carets, live cursor positions, and zero-conflict document convergence powered by binary Yjs WebSocket deltas.`,
  },
  {
    id: "export-print-guide",
    title: "Exporting to PDF, Word DOCX & Printing",
    category: "Export & Print",
    keywords: ["export", "pdf", "docx", "print", "word export", "download"],
    content: `• **PDF Export:** Generates high-fidelity PDF documents matching your exact page size, margins, headers, and footers.
• **DOCX Export:** Generates clean Microsoft Word documents preserving heading levels, bold/italics, bulleted lists, tables, and images.
• **HTML & TXT:** Instant lightweight exports directly in your browser.
• **Browser Print (Ctrl + P):** Uses an optimized print stylesheet that removes the ribbon, navigation drawer, and ruler for clean physical paper printing.`,
  },
];

export function HelpCenter({ close }: { close: () => void }) {
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<HelpTopic>(HELP_TOPICS[0]);

  const categories = ["All", "Getting Started", "Ribbon Guide", "Shortcuts", "Collaboration & Storage", "Export & Print"];

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return HELP_TOPICS.filter((t) => {
      if (selectedCat !== "All" && t.category !== selectedCat) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [selectedCat, searchQuery]);

  return (
    <div className="help-center" style={{ width: "100%", maxWidth: "820px", color: "#1f3328" }}>
      {/* Header Search Bar */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <input
            type="text"
            placeholder="Search documentation, guides & shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              border: "1px solid #bcc9c1",
              borderRadius: "4px",
              fontSize: "14px",
              background: "white",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "2px" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCat(cat)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px solid",
                borderColor: selectedCat === cat ? "#23654d" : "#ccd7cf",
                background: selectedCat === cat ? "#23654d" : "white",
                color: selectedCat === cat ? "white" : "#3d5448",
                borderRadius: "16px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: "18px",
          height: "380px",
          border: "1px solid #d4ded8",
          borderRadius: "6px",
          overflow: "hidden",
          background: "white",
        }}
      >
        {/* Left Topics List */}
        <div
          style={{
            borderRight: "1px solid #d4ded8",
            overflowY: "auto",
            background: "#f7f9f8",
            padding: "8px",
          }}
        >
          {filteredTopics.map((topic) => {
            const isSelected = activeTopic.id === topic.id;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => setActiveTopic(topic)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  marginBottom: "4px",
                  borderRadius: "4px",
                  border: isSelected ? "1px solid #32755c" : "1px solid transparent",
                  background: isSelected ? "#e2efe9" : "transparent",
                  color: isSelected ? "#143e2f" : "#2f463b",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "13px" }}>{topic.title}</div>
                <div style={{ fontSize: "11px", color: "#60776b", marginTop: "2px" }}>{topic.category}</div>
              </button>
            );
          })}
          {filteredTopics.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "#74867d", fontSize: "13px" }}>
              No help topics match your query.
            </div>
          )}
        </div>

        {/* Right Content Viewer */}
        <div style={{ overflowY: "auto", padding: "18px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#23654d", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {activeTopic.category}
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "6px 0 14px 0", color: "#163124" }}>
            {activeTopic.title}
          </h3>

          <div style={{ fontSize: "13.5px", lineHeight: "1.65", color: "#2d4439", whiteSpace: "pre-line" }}>
            {activeTopic.content}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", borderTop: "1px solid #e0e7e2", paddingTop: "10px" }}>
        <div style={{ fontSize: "12px", color: "#61776c" }}>
          Need more assistance? Check the official repository documentation in README.md.
        </div>
        <button
          type="button"
          onClick={close}
          style={{
            padding: "7px 18px",
            background: "#246c53",
            color: "white",
            fontWeight: 600,
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Close Help
        </button>
      </div>
    </div>
  );
}

