import { useState, useMemo } from "react";
import type { Editor } from "@tiptap/react";

interface RedactionToolProps {
  editor: Editor;
  close: () => void;
  notify: (msg: string) => void;
}

interface DetectedItem {
  id: string;
  type: "Email" | "Phone" | "Card" | "SSN" | "Custom";
  text: string;
}

export function RedactionTool({ editor, close, notify }: RedactionToolProps) {
  const [customKeyword, setCustomKeyword] = useState("");
  const [redactionStyle, setRedactionStyle] = useState<"blackout" | "tag">("blackout");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Scan document for PII
  const detectedItems: DetectedItem[] = useMemo(() => {
    const text = editor.getText();
    const items: DetectedItem[] = [];

    // Email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let m;
    while ((m = emailRegex.exec(text)) !== null) {
      items.push({ id: `email-${m.index}`, type: "Email", text: m[0] });
    }

    // Phone
    const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    while ((m = phoneRegex.exec(text)) !== null) {
      items.push({ id: `phone-${m.index}`, type: "Phone", text: m[0] });
    }

    // Credit Card
    const cardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
    while ((m = cardRegex.exec(text)) !== null) {
      items.push({ id: `card-${m.index}`, type: "Card", text: m[0] });
    }

    // SSN
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    while ((m = ssnRegex.exec(text)) !== null) {
      items.push({ id: `ssn-${m.index}`, type: "SSN", text: m[0] });
    }

    // Custom
    if (customKeyword.trim()) {
      const q = customKeyword.trim();
      let pos = text.indexOf(q);
      let count = 0;
      while (pos !== -1 && count < 30) {
        items.push({ id: `custom-${pos}`, type: "Custom", text: q });
        pos = text.indexOf(q, pos + q.length);
        count++;
      }
    }

    return items;
  }, [editor, customKeyword]);

  // Default to selecting all detected items
  useMemo(() => {
    setSelectedIds(new Set(detectedItems.map((item) => item.id)));
  }, [detectedItems.length]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => setSelectedIds(new Set(detectedItems.map((item) => item.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleApplyRedaction = () => {
    const targets = detectedItems.filter((item) => selectedIds.has(item.id));
    if (targets.length === 0) {
      notify("Please select at least one item to redact.");
      return;
    }

    const { doc } = editor.state;
    const tr = editor.state.tr;
    const ranges: { from: number; to: number; replacement: string }[] = [];

    // Unique phrases to redact
    const phraseMap = new Map<string, string>();
    targets.forEach((item) => {
      const replacement =
        redactionStyle === "blackout"
          ? "█".repeat(Math.max(4, Math.min(item.text.length, 12)))
          : `[REDACTED: ${item.type.toUpperCase()}]`;
      phraseMap.set(item.text, replacement);
    });

    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      phraseMap.forEach((replacement, phrase) => {
        let index = node.text!.indexOf(phrase);
        while (index !== -1) {
          ranges.push({
            from: pos + index,
            to: pos + index + phrase.length,
            replacement,
          });
          index = node.text!.indexOf(phrase, index + phrase.length);
        }
      });
    });

    if (ranges.length === 0) {
      notify("No matching occurrences found in document.");
      return;
    }

    // Sort descending by position to prevent index offset distortion
    ranges.sort((a, b) => b.from - a.from);
    for (const r of ranges) {
      tr.insertText(r.replacement, r.from, r.to);
    }

    editor.view.dispatch(tr);
    notify(`Permanently redacted ${ranges.length} sensitive item(s)!`);
    close();
  };

  return (
    <div className="redaction-tool-dialog" style={{ width: "100%", maxWidth: "620px", color: "#1f3328" }}>
      <p style={{ fontSize: "13px", color: "#546a5d", margin: "0 0 14px 0" }}>
        Protect sensitive confidentiality. Automatically detect Personally Identifiable Information (PII) such as emails, phone numbers, credit card numbers, and custom terms, and black them out permanently before sharing.
      </p>

      {/* Custom Keyword Input */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Add custom keyword or phrase to redact (e.g. Confidential Project)..."
          value={customKeyword}
          onChange={(e) => setCustomKeyword(e.target.value)}
          style={{ flex: 1, padding: "7px 10px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
        />
      </div>

      {/* Redaction Style Radios */}
      <div style={{ display: "flex", gap: "18px", alignItems: "center", marginBottom: "12px", fontSize: "13px", fontWeight: 600 }}>
        <span>Redaction Style:</span>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input
            type="radio"
            name="style"
            checked={redactionStyle === "blackout"}
            onChange={() => setRedactionStyle("blackout")}
          />
          Blackout Blocks (████████)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input
            type="radio"
            name="style"
            checked={redactionStyle === "tag"}
            onChange={() => setRedactionStyle("tag")}
          />
          Tag Labels ([REDACTED: EMAIL])
        </label>
      </div>

      {/* Select All / Deselect Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#375043" }}>
          Detected Sensitive Items ({detectedItems.length}):
        </span>
        <div style={{ display: "flex", gap: "8px", fontSize: "11px" }}>
          <button type="button" onClick={selectAll} style={{ color: "#246c53", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Select All
          </button>
          <span>·</span>
          <button type="button" onClick={deselectAll} style={{ color: "#60786b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Deselect All
          </button>
        </div>
      </div>

      {/* Detected List */}
      <div
        style={{
          maxHeight: "220px",
          overflowY: "auto",
          border: "1px solid #c9d7cf",
          borderRadius: "4px",
          background: "white",
        }}
      >
        {detectedItems.map((item) => {
          const isChecked = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggleSelect(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderBottom: "1px solid #eef2ef",
                cursor: "pointer",
                background: isChecked ? "#f4faf6" : "transparent",
              }}
            >
              <input type="checkbox" checked={isChecked} onChange={() => {}} />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "3px",
                  background:
                    item.type === "Email"
                      ? "#e0e7ff"
                      : item.type === "Phone"
                        ? "#fef3c7"
                        : item.type === "Card"
                          ? "#fee2e2"
                          : "#f3e8ff",
                  color:
                    item.type === "Email"
                      ? "#3730a3"
                      : item.type === "Phone"
                        ? "#92400e"
                        : item.type === "Card"
                          ? "#991b1b"
                          : "#6b21a8",
                }}
              >
                {item.type}
              </span>
              <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#1f3328" }}>
                {item.text}
              </span>
            </div>
          );
        })}
        {detectedItems.length === 0 && (
          <div style={{ padding: "30px", textAlign: "center", color: "#61776c", fontSize: "13px" }}>
            No emails, phone numbers, or card numbers detected in the document.
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px", borderTop: "1px solid #d4ded8", paddingTop: "12px" }}>
        <button
          type="button"
          onClick={close}
          style={{ padding: "7px 16px", border: "1px solid #bbc8c0", background: "white", borderRadius: "4px" }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={selectedIds.size === 0}
          onClick={handleApplyRedaction}
          style={{
            padding: "7px 22px",
            background: selectedIds.size === 0 ? "#819b8f" : "#b91c1c",
            color: "white",
            fontWeight: 600,
            borderRadius: "4px",
            border: "none",
            cursor: selectedIds.size === 0 ? "default" : "pointer",
          }}
        >
          Apply Permanent Redaction ({selectedIds.size})
        </button>
      </div>
    </div>
  );
}

