import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";

interface WikiLinksProps {
  editor: Editor;
  close: () => void;
  notify: (msg: string) => void;
}

export function WikiLinks({ editor, close, notify }: WikiLinksProps) {
  const [tab, setTab] = useState<"link" | "scratchpad">("link");
  const [linkTarget, setLinkTarget] = useState("");
  const [scratchpadText, setScratchpadText] = useState(() => {
    return localStorage.getItem("titan.scratchpad") || "• Project milestones review\n• Client contact: legal@acme.com\n• Key metrics to include in report";
  });

  const sampleDocs = [
    "Workspace Modernization Proposal",
    "Mutual Non-Disclosure Agreement",
    "Q4 Executive Strategic Plan",
    "Software Architecture Design Spec",
    "Client Consulting Contract",
  ];

  useEffect(() => {
    localStorage.setItem("titan.scratchpad", scratchpadText);
  }, [scratchpadText]);

  const handleInsertWikiLink = (title: string) => {
    const textToInsert = `[[${title}]]`;
    editor.chain().focus().insertContent(textToInsert).run();
    notify(`Inserted link to ${textToInsert}`);
    close();
  };

  const handleInsertScratchpadContent = () => {
    editor.chain().focus().insertContent(scratchpadText).run();
    notify("Inserted scratchpad notes into document!");
    close();
  };

  return (
    <div className="wiki-links-dialog" style={{ width: "100%", maxWidth: "560px", color: "#1f3328" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #d4ded8", marginBottom: "16px", gap: "6px" }}>
        <button
          type="button"
          onClick={() => setTab("link")}
          style={{
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "13px",
            border: "none",
            borderBottom: tab === "link" ? "3px solid #23654d" : "3px solid transparent",
            background: tab === "link" ? "#f0f5f2" : "transparent",
            color: tab === "link" ? "#184534" : "#51665a",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
          }}
        >
          Bi-Directional Wiki Links [[Doc]]
        </button>
        <button
          type="button"
          onClick={() => setTab("scratchpad")}
          style={{
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "13px",
            border: "none",
            borderBottom: tab === "scratchpad" ? "3px solid #23654d" : "3px solid transparent",
            background: tab === "scratchpad" ? "#f0f5f2" : "transparent",
            color: tab === "scratchpad" ? "#184534" : "#51665a",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
          }}
        >
          Persistent Scratchpad
        </button>
      </div>

      {tab === "link" ? (
        <div>
          <p style={{ fontSize: "13px", color: "#546a5d", margin: "0 0 12px 0" }}>
            Connect your knowledge base. Insert bi-directional wiki links to reference related documents and research notes.
          </p>

          <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 600, marginBottom: "14px" }}>
            Custom Document Link:
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Enter document title (e.g. Project Plan)..."
                value={linkTarget}
                onChange={(e) => setLinkTarget(e.target.value)}
                style={{ flex: 1, padding: "7px 10px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
              />
              <button
                type="button"
                onClick={() => {
                  if (linkTarget.trim()) handleInsertWikiLink(linkTarget.trim());
                }}
                style={{
                  padding: "7px 16px",
                  background: "#246c53",
                  color: "white",
                  fontWeight: 600,
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Insert [[Link]]
              </button>
            </div>
          </label>

          <span style={{ fontSize: "12px", fontWeight: 600, color: "#375043", display: "block", marginBottom: "6px" }}>
            Suggested Documents in Workspace:
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {sampleDocs.map((docTitle) => (
              <button
                key={docTitle}
                type="button"
                onClick={() => handleInsertWikiLink(docTitle)}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  border: "1px solid #d4ded8",
                  background: "#f9fbfa",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#224132",
                }}
              >
                📄 <strong>[[{docTitle}]]</strong>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: "13px", color: "#546a5d", margin: "0 0 10px 0" }}>
            A persistent scratchpad for your thoughts, clipboard snippets, and research quotes. Content persists across tabs and document switches.
          </p>

          <textarea
            rows={8}
            value={scratchpadText}
            onChange={(e) => setScratchpadText(e.target.value)}
            placeholder="Jot down notes or clipboard snippets here..."
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #bcc9c1",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "13.5px",
              lineHeight: "1.5",
              marginBottom: "12px",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={handleInsertScratchpadContent}
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
              Insert Notes into Document
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", borderTop: "1px solid #d4ded8", paddingTop: "12px" }}>
        <button
          type="button"
          onClick={close}
          style={{ padding: "7px 16px", border: "1px solid #bbc8c0", background: "white", borderRadius: "4px" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

