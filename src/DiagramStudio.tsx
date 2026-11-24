import { useState, useMemo } from "react";
import type { Editor } from "@tiptap/react";

interface DiagramStudioProps {
  editor: Editor;
  close: () => void;
  notify: (msg: string) => void;
}

const DIAGRAM_PRESETS = [
  {
    id: "process",
    title: "Linear Process Flow",
    desc: "Sequential step-by-step workflow",
    nodes: ["1. Initiate Request", "2. Review & Validate", "3. Executive Approval", "4. Execute & Deploy"],
  },
  {
    id: "decision",
    title: "Decision & Logic Branch",
    desc: "Condition check with outcome branches",
    nodes: ["Incoming Event", "Meets SLA Threshold?", "Branch A: Expedited", "Branch B: Standard Queue"],
  },
  {
    id: "architecture",
    title: "3-Tier System Architecture",
    desc: "Client, Application, and Persistence layers",
    nodes: ["Frontend React App", "FastAPI Document Service", "MongoDB Atlas Database"],
  },
  {
    id: "cycle",
    title: "Continuous Feedback Loop",
    desc: "Agile iteration cycle",
    nodes: ["Plan & Design", "Build & Integrate", "Verify & Test", "Deploy & Measure"],
  },
];

const CALLOUT_PRESETS = [
  { type: "info", title: "Information", icon: "ℹ️", border: "#2563eb", bg: "#eff6ff", text: "#1e40af" },
  { type: "tip", title: "Pro Tip", icon: "💡", border: "#16a34a", bg: "#f0fdf4", text: "#166534" },
  { type: "warning", title: "Caution", icon: "⚠️", border: "#d97706", bg: "#fffbeb", text: "#92400e" },
  { type: "danger", title: "Important Notice", icon: "🚨", border: "#dc2626", bg: "#fef2f2", text: "#991b1b" },
];

export function DiagramStudio({ editor, close, notify }: DiagramStudioProps) {
  const [activeTab, setActiveTab] = useState<"diagram" | "callout">("diagram");

  // Diagram state
  const [selectedPreset, setSelectedPreset] = useState(DIAGRAM_PRESETS[0]);
  const [nodesText, setNodesText] = useState(DIAGRAM_PRESETS[0].nodes.join("\n"));
  const [direction, setDirection] = useState<"LR" | "TD">("LR");
  const [accentColor, setAccentColor] = useState("#246c53");

  // Callout state
  const [calloutType, setCalloutType] = useState(CALLOUT_PRESETS[0]);
  const [calloutTitle, setCalloutTitle] = useState("Important Information");
  const [calloutBody, setCalloutBody] = useState("Please review the document layout settings before finalizing.");

  const currentNodes = useMemo(() => {
    return nodesText.split("\n").map((s) => s.trim()).filter(Boolean);
  }, [nodesText]);

  // Generate SVG markup for diagram
  const svgDataUrl = useMemo(() => {
    const count = Math.max(1, currentNodes.length);
    const isLR = direction === "LR";
    const width = isLR ? Math.max(500, count * 155) : 340;
    const height = isLR ? 140 : count * 90 + 20;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family: Arial, sans-serif;">`;
    svgContent += `<defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="${accentColor}" /></marker></defs>`;

    currentNodes.forEach((node, i) => {
      const x = isLR ? 20 + i * 150 : 30;
      const y = isLR ? 40 : 20 + i * 85;
      const boxW = isLR ? 115 : 280;
      const boxH = 55;

      // Draw node box
      svgContent += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="8" fill="#f6faf8" stroke="${accentColor}" stroke-width="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))"/>`;
      svgContent += `<text x="${x + boxW / 2}" y="${y + boxH / 2 + 5}" font-size="12" font-weight="600" fill="#1d3529" text-anchor="middle">${node.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`;

      // Draw arrow to next node
      if (i < count - 1) {
        if (isLR) {
          const fromX = x + boxW;
          const fromY = y + boxH / 2;
          const toX = fromX + 35;
          svgContent += `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${fromY}" stroke="${accentColor}" stroke-width="2" marker-end="url(#arrow)" />`;
        } else {
          const fromX = x + boxW / 2;
          const fromY = y + boxH;
          const toY = fromY + 30;
          svgContent += `<line x1="${fromX}" y1="${fromY}" x2="${fromX}" y2="${toY}" stroke="${accentColor}" stroke-width="2" marker-end="url(#arrow)" />`;
        }
      }
    });

    svgContent += "</svg>";
    return "data:image/svg+xml;utf8," + encodeURIComponent(svgContent);
  }, [currentNodes, direction, accentColor]);

  // Insert Diagram into Editor as Image
  const handleInsertDiagram = () => {
    if (currentNodes.length === 0) {
      notify("Please enter at least one node.");
      return;
    }
    editor.chain().focus().insertContent({
      type: "image",
      attrs: {
        src: svgDataUrl,
        alt: "Process Diagram",
      },
    }).run();
    notify("Diagram inserted successfully!");
    close();
  };

  // Insert Callout Box into Editor
  const handleInsertCallout = () => {
    const html = `
      <div style="border-left: 4px solid ${calloutType.border}; background: ${calloutType.bg}; padding: 12px 16px; margin: 12px 0; border-radius: 0 6px 6px 0;">
        <div style="font-weight: 700; color: ${calloutType.text}; font-size: 14px; margin-bottom: 4px;">
          ${calloutType.icon} ${calloutTitle}
        </div>
        <div style="font-size: 13.5px; color: #334155; line-height: 1.5;">
          ${calloutBody}
        </div>
      </div>
    `;
    editor.chain().focus().insertContent(html).run();
    notify("Callout inserted successfully!");
    close();
  };

  return (
    <div className="diagram-studio-dialog" style={{ width: "100%", maxWidth: "680px", color: "#1f3328" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #d4ded8", marginBottom: "16px", gap: "6px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("diagram")}
          style={{
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "13px",
            border: "none",
            borderBottom: activeTab === "diagram" ? "3px solid #23654d" : "3px solid transparent",
            background: activeTab === "diagram" ? "#f0f5f2" : "transparent",
            color: activeTab === "diagram" ? "#184534" : "#51665a",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
          }}
        >
          Flowcharts & Diagrams
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("callout")}
          style={{
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "13px",
            border: "none",
            borderBottom: activeTab === "callout" ? "3px solid #23654d" : "3px solid transparent",
            background: activeTab === "callout" ? "#f0f5f2" : "transparent",
            color: activeTab === "callout" ? "#184534" : "#51665a",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
          }}
        >
          Callout Admonition Blocks
        </button>
      </div>

      {activeTab === "diagram" ? (
        <div>
          {/* Presets */}
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#375043", display: "block", marginBottom: "6px" }}>
              Diagram Templates:
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
              {DIAGRAM_PRESETS.map((p) => {
                const isCur = selectedPreset.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(p);
                      setNodesText(p.nodes.join("\n"));
                    }}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      border: isCur ? "2px solid #23654d" : "1px solid #ccd7cf",
                      background: isCur ? "#e2efe9" : "white",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>{p.title}</div>
                    <div style={{ fontSize: "11px", color: "#61776b" }}>{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls: direction & accent */}
          <div style={{ display: "flex", gap: "14px", alignItems: "center", marginBottom: "12px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              Layout:
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "LR" | "TD")}
                style={{ padding: "4px 8px", border: "1px solid #bcc9c1", borderRadius: "4px", background: "white" }}
              >
                <option value="LR">Horizontal (Left to Right)</option>
                <option value="TD">Vertical (Top to Bottom)</option>
              </select>
            </label>

            <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              Accent color:
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{ border: "none", width: "28px", height: "24px", cursor: "pointer" }}
              />
            </label>
          </div>

          {/* Node Editor */}
          <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 600, marginBottom: "14px" }}>
            Node steps (one step per line):
            <textarea
              rows={3}
              value={nodesText}
              onChange={(e) => setNodesText(e.target.value)}
              placeholder="Enter steps..."
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #bcc9c1",
                borderRadius: "4px",
                fontFamily: "inherit",
                fontSize: "13px",
              }}
            />
          </label>

          {/* Live Diagram Preview */}
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#375043", marginBottom: "6px" }}>
            Live Diagram Preview:
          </div>
          <div
            style={{
              maxHeight: "180px",
              overflow: "auto",
              background: "#fafcfb",
              border: "1px solid #c9d7cf",
              borderRadius: "6px",
              padding: "12px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <img src={svgDataUrl} alt="Diagram preview" style={{ maxWidth: "100%", height: "auto" }} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={close}
              style={{ padding: "7px 16px", border: "1px solid #bbc8c0", background: "white", borderRadius: "4px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsertDiagram}
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
              Insert Diagram
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Callout Presets */}
          <div style={{ marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#375043", display: "block", marginBottom: "6px" }}>
              Callout Style:
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
              {CALLOUT_PRESETS.map((p) => {
                const isCur = calloutType.type === p.type;
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => {
                      setCalloutType(p);
                      setCalloutTitle(p.title);
                    }}
                    style={{
                      textAlign: "center",
                      padding: "8px 6px",
                      border: isCur ? `2px solid ${p.border}` : "1px solid #ccd7cf",
                      background: isCur ? p.bg : "white",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "18px", marginBottom: "2px" }}>{p.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: "12px", color: p.text }}>{p.title}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Callout Title and Content */}
          <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
            <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Callout Title:
              <input
                type="text"
                value={calloutTitle}
                onChange={(e) => setCalloutTitle(e.target.value)}
                style={{ padding: "7px 10px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Callout Body Message:
              <textarea
                rows={3}
                value={calloutBody}
                onChange={(e) => setCalloutBody(e.target.value)}
                style={{ padding: "7px 10px", border: "1px solid #bcc9c1", borderRadius: "4px", fontFamily: "inherit" }}
              />
            </label>
          </div>

          {/* Live Callout Preview */}
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#375043", marginBottom: "6px" }}>
            Live Callout Preview:
          </div>
          <div
            style={{
              borderLeft: `4px solid ${calloutType.border}`,
              background: calloutType.bg,
              padding: "12px 16px",
              borderRadius: "0 6px 6px 0",
              marginBottom: "18px",
            }}
          >
            <div style={{ fontWeight: 700, color: calloutType.text, fontSize: "14px", marginBottom: "4px" }}>
              {calloutType.icon} {calloutTitle}
            </div>
            <div style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.5" }}>
              {calloutBody}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={close}
              style={{ padding: "7px 16px", border: "1px solid #bbc8c0", background: "white", borderRadius: "4px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsertCallout}
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
              Insert Callout Box
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

