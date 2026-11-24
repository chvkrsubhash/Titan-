import { useState, useMemo } from "react";
import type { Editor } from "@tiptap/react";

interface VariableTokensProps {
  editor: Editor;
  close: () => void;
  notify: (msg: string) => void;
}

const COMMON_VARIABLES = [
  { key: "Client_Name", label: "Client Name", example: "Acme Corporation" },
  { key: "Company_Name", label: "Company Name", example: "AkashaVyom Labs" },
  { key: "Project_Title", label: "Project Title", example: "Workspace Modernization" },
  { key: "Invoice_Number", label: "Invoice Number", example: "INV-2026-0042" },
  { key: "Total_Amount", label: "Total Amount", example: "$12,500.00" },
  { key: "Author_Name", label: "Author / Signer", example: "Subhash C." },
  { key: "Document_Date", label: "Document Date", example: new Date().toLocaleDateString() },
];

export function VariableTokens({ editor, close, notify }: VariableTokensProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [customKey, setCustomKey] = useState("");

  // Scan document for all {{variable}} patterns
  const detectedVariables = useMemo(() => {
    const text = editor.getText();
    const regex = /\{\{([a-zA-Z0-9_\- ]+)\}\}/g;
    const found = new Set<string>();
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (m[1]) found.add(m[1].trim());
    }
    return Array.from(found);
  }, [editor]);

  // Combined list of active variables
  const allKeys = useMemo(() => {
    const set = new Set<string>([...detectedVariables, ...Object.keys(values)]);
    COMMON_VARIABLES.forEach((v) => set.add(v.key));
    return Array.from(set);
  }, [detectedVariables, values]);

  const insertToken = (key: string) => {
    editor.chain().focus().insertContent(`{{${key}}}`).run();
    notify(`Inserted {{${key}}}`);
  };

  const handleApplyValues = () => {
    const activeEntries = Object.entries(values).filter(([, val]) => val.trim().length > 0);
    if (activeEntries.length === 0) {
      notify("Please enter at least one variable value to replace.");
      return;
    }

    let replacementsCount = 0;
    const tr = editor.state.tr;
    const { doc } = editor.state;

    // Traverse all text nodes and replace {{key}} with value
    const ranges: { from: number; to: number; text: string }[] = [];
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      activeEntries.forEach(([k, v]) => {
        const token = `{{${k}}}`;
        let index = node.text!.indexOf(token);
        while (index !== -1) {
          ranges.push({
            from: pos + index,
            to: pos + index + token.length,
            text: v,
          });
          replacementsCount++;
          index = node.text!.indexOf(token, index + token.length);
        }
      });
    });

    if (ranges.length === 0) {
      notify("No matching {{variable}} placeholders found in the document to replace.");
      return;
    }

    // Sort descending by position to prevent index shifting
    ranges.sort((a, b) => b.from - a.from);
    for (const r of ranges) {
      tr.insertText(r.text, r.from, r.to);
    }
    editor.view.dispatch(tr);
    notify(`Successfully replaced ${replacementsCount} variable placeholder(s)!`);
    close();
  };

  return (
    <div className="variable-tokens-dialog" style={{ width: "100%", maxWidth: "600px", color: "#1f3328" }}>
      <p style={{ fontSize: "13px", color: "#546a5d", margin: "0 0 14px 0" }}>
        Use dynamic variable placeholders (like <code>{"{{Client_Name}}"}</code>) for contract templates, proposals, and invoices. Insert tokens anywhere, then fill values to update all occurrences instantly.
      </p>

      {/* Insert New Token Row */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          background: "#f4f7f5",
          padding: "10px 12px",
          borderRadius: "6px",
          border: "1px solid #d5dfd8",
          marginBottom: "16px",
        }}
      >
        <input
          type="text"
          placeholder="New variable name (e.g. PO_Number)"
          value={customKey}
          onChange={(e) => setCustomKey(e.target.value)}
          style={{ flex: 1, padding: "6px 10px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
        />
        <button
          type="button"
          onClick={() => {
            if (customKey.trim()) {
              const clean = customKey.trim().replace(/[^a-zA-Z0-9_\-]/g, "_");
              insertToken(clean);
              setCustomKey("");
            }
          }}
          style={{
            padding: "6px 14px",
            background: "#246c53",
            color: "white",
            fontWeight: 600,
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Insert Token
        </button>
      </div>

      {/* Variables List & Values Form */}
      <div style={{ maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #d4ded8", textAlign: "left", color: "#425a4d" }}>
              <th style={{ padding: "6px 8px" }}>Placeholder Token</th>
              <th style={{ padding: "6px 8px" }}>Fill Value</th>
              <th style={{ padding: "6px 8px", width: "70px", textAlign: "right" }}>Insert</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map((key) => {
              const isDetected = detectedVariables.includes(key);
              return (
                <tr key={key} style={{ borderBottom: "1px solid #e5ebe7" }}>
                  <td style={{ padding: "8px", verticalAlign: "middle" }}>
                    <code
                      style={{
                        background: isDetected ? "#e0f2e8" : "#f1f4f2",
                        color: isDetected ? "#1b5a43" : "#3e5246",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontWeight: 600,
                        fontSize: "12px",
                      }}
                    >
                      {`{{${key}}}`}
                    </code>
                    {isDetected && (
                      <span style={{ fontSize: "10px", color: "#226a48", marginLeft: "6px", fontWeight: 600 }}>
                        (in document)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="text"
                      placeholder="Enter value..."
                      value={values[key] || ""}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                      style={{ width: "100%", padding: "5px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                    />
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => insertToken(key)}
                      title="Insert token at cursor position"
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        border: "1px solid #ccd8cf",
                        background: "white",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      + Insert
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
          borderTop: "1px solid #d4ded8",
          paddingTop: "12px",
        }}
      >
        <span style={{ fontSize: "11px", color: "#61776c" }}>
          {detectedVariables.length} placeholder token(s) currently detected in document.
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={close}
            style={{ padding: "7px 16px", border: "1px solid #bbc8c0", background: "white", borderRadius: "4px" }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleApplyValues}
            style={{
              padding: "7px 20px",
              background: "#246c53",
              color: "white",
              fontWeight: 600,
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Fill & Replace in Doc
          </button>
        </div>
      </div>
    </div>
  );
}

