import { useState, useMemo } from "react";
import type { Doc } from "./store";

interface PageSetupProps {
  doc: Doc;
  update: (changes: Partial<Doc>) => void;
  close: () => void;
}

export const PAPER_SIZES = [
  { name: "Letter", width: 215.9, height: 279.4, desc: '8.5" × 11"' },
  { name: "A4", width: 210, height: 297, desc: "210 × 297 mm" },
  { name: "Legal", width: 215.9, height: 355.6, desc: '8.5" × 14"' },
  { name: "Executive", width: 184.1, height: 266.7, desc: '7.25" × 10.5"' },
  { name: "A3", width: 297, height: 420, desc: "297 × 420 mm" },
  { name: "A5", width: 148, height: 210, desc: "148 × 210 mm" },
  { name: "B5", width: 176, height: 250, desc: "176 × 250 mm" },
];

export const MARGIN_PRESETS = [
  { name: "Normal", top: 25.4, bottom: 25.4, left: 25.4, right: 25.4, desc: '1" on all sides' },
  { name: "Narrow", top: 12.7, bottom: 12.7, left: 12.7, right: 12.7, desc: '0.5" on all sides' },
  { name: "Moderate", top: 25.4, bottom: 25.4, left: 19.1, right: 19.1, desc: 'Top/Bottom 1", Left/Right 0.75"' },
  { name: "Wide", top: 25.4, bottom: 25.4, left: 50.8, right: 50.8, desc: 'Top/Bottom 1", Left/Right 2"' },
];

export const COLUMN_PRESETS = [
  { name: "One", cols: 1, desc: "Single standard column" },
  { name: "Two", cols: 2, desc: "Two equal columns" },
  { name: "Three", cols: 3, desc: "Three equal columns" },
  { name: "Left", cols: "left", desc: "Narrow left, wide right" },
  { name: "Right", cols: "right", desc: "Wide left, narrow right" },
];

function parseUnit(val: string | number | undefined, defaultMm: number): number {
  if (val === undefined || val === null || val === "") return defaultMm;
  if (typeof val === "number") return val;
  const num = parseFloat(val);
  if (isNaN(num)) return defaultMm;
  if (val.endsWith("in")) return Math.round(num * 25.4 * 10) / 10;
  return Math.round(num * 10) / 10;
}

export function PageSetup({ doc, update, close }: PageSetupProps) {
  const s = doc.settings || {};
  const [activeTab, setActiveTab] = useState<"margins" | "paper" | "columns">("margins");

  // Initial values from doc settings
  const baseMargin = parseUnit(s.margin, 25.4);
  const [top, setTop] = useState(parseUnit(s.marginTop, baseMargin));
  const [bottom, setBottom] = useState(parseUnit(s.marginBottom, baseMargin));
  const [left, setLeft] = useState(parseUnit(s.marginLeft, baseMargin));
  const [right, setRight] = useState(parseUnit(s.marginRight, baseMargin));
  const [gutter, setGutter] = useState(parseUnit(s.gutter, 0));

  const [paperName, setPaperName] = useState(s.paperSize || (s.width?.includes("in") ? "Letter" : "A4"));
  const [width, setWidth] = useState(parseUnit(s.width, 210));
  const [height, setHeight] = useState(parseUnit(s.height, 297));
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    s.orientation || (width > height ? "landscape" : "portrait")
  );

  const [columns, setColumns] = useState<number | string>(s.columns || 1);
  const [columnGap, setColumnGap] = useState(parseUnit(s.columnGap, 12));
  const [columnRule, setColumnRule] = useState<boolean>(!!s.columnRule);

  // Apply paper size preset
  const selectPaper = (name: string) => {
    setPaperName(name);
    const found = PAPER_SIZES.find((p) => p.name === name);
    if (found) {
      if (orientation === "landscape") {
        setWidth(found.height);
        setHeight(found.width);
      } else {
        setWidth(found.width);
        setHeight(found.height);
      }
    }
  };

  // Toggle orientation
  const setOrient = (orient: "portrait" | "landscape") => {
    if (orientation === orient) return;
    setOrientation(orient);
    // Swap width & height
    const currentW = width;
    const currentH = height;
    if (orient === "landscape" && currentW < currentH) {
      setWidth(currentH);
      setHeight(currentW);
    } else if (orient === "portrait" && currentW > currentH) {
      setWidth(currentH);
      setHeight(currentW);
    }
  };

  // Apply margin preset
  const applyMarginPreset = (preset: typeof MARGIN_PRESETS[0]) => {
    setTop(preset.top);
    setBottom(preset.bottom);
    setLeft(preset.left);
    setRight(preset.right);
  };

  // Save changes
  const handleSave = () => {
    const avgMargin = Math.round(((left + right + top + bottom) / 4) * 10) / 10;
    update({
      settings: {
        ...s,
        width: `${width}mm`,
        height: `${height}mm`,
        paperSize: paperName,
        orientation,
        margin: `${avgMargin}mm`,
        marginTop: `${top}mm`,
        marginBottom: `${bottom}mm`,
        marginLeft: `${left + gutter}mm`,
        marginRight: `${right}mm`,
        gutter: `${gutter}mm`,
        columns,
        columnGap: `${columnGap}mm`,
        columnRule,
      },
    });
    close();
  };

  // Live Demo Preview Calculations
  const previewBox = useMemo(() => {
    const maxBoxW = 160;
    const maxBoxH = 190;
    const isLand = orientation === "landscape" || width > height;
    const ratio = width / (height || 1);

    let boxW = maxBoxW;
    let boxH = boxW / ratio;
    if (boxH > maxBoxH) {
      boxH = maxBoxH;
      boxW = boxH * ratio;
    }

    // Margins relative percentage
    const pLeft = Math.min(40, (left / width) * 100);
    const pRight = Math.min(40, (right / width) * 100);
    const pTop = Math.min(40, (top / height) * 100);
    const pBottom = Math.min(40, (bottom / height) * 100);
    const pGutter = Math.min(20, (gutter / width) * 100);

    return { boxW, boxH, pLeft, pRight, pTop, pBottom, pGutter, isLand };
  }, [width, height, top, bottom, left, right, gutter, orientation]);

  return (
    <div className="pagesetup-dialog" style={{ width: "100%", maxWidth: "720px", color: "#1f3328" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #d4ded7", marginBottom: "16px", gap: "6px" }}>
        {(["margins", "paper", "columns"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 18px",
              fontWeight: 600,
              fontSize: "13px",
              border: "none",
              borderBottom: activeTab === tab ? "3px solid #23654d" : "3px solid transparent",
              background: activeTab === tab ? "#f0f5f2" : "transparent",
              color: activeTab === tab ? "#184534" : "#51665a",
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "20px", minHeight: "330px" }}>
        {/* Main Settings Form */}
        <div style={{ overflowY: "auto", maxHeight: "400px", paddingRight: "6px" }}>
          {activeTab === "margins" && (
            <div>
              {/* Presets */}
              <div style={{ marginBottom: "14px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#375043", display: "block", marginBottom: "6px" }}>
                  Margin Presets:
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                  {MARGIN_PRESETS.map((p) => {
                    const isCur =
                      top === p.top && bottom === p.bottom && left === p.left && right === p.right;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => applyMarginPreset(p)}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          border: isCur ? "2px solid #23654d" : "1px solid #ccd7cf",
                          background: isCur ? "#e2efe9" : "white",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "13px" }}>{p.name}</div>
                        <div style={{ fontSize: "11px", color: "#61776b" }}>{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Margins Input */}
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#375043", marginBottom: "8px" }}>
                Custom Margins (mm):
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <label style={{ display: "grid", gap: "3px", fontSize: "12px", fontWeight: 600 }}>
                  Top (mm):
                  <input
                    type="number"
                    min="2"
                    max="100"
                    step="0.1"
                    value={top}
                    onChange={(e) => setTop(parseFloat(e.target.value) || 0)}
                    style={{ padding: "6px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                  />
                </label>
                <label style={{ display: "grid", gap: "3px", fontSize: "12px", fontWeight: 600 }}>
                  Bottom (mm):
                  <input
                    type="number"
                    min="2"
                    max="100"
                    step="0.1"
                    value={bottom}
                    onChange={(e) => setBottom(parseFloat(e.target.value) || 0)}
                    style={{ padding: "6px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                  />
                </label>
                <label style={{ display: "grid", gap: "3px", fontSize: "12px", fontWeight: 600 }}>
                  Left (mm):
                  <input
                    type="number"
                    min="2"
                    max="100"
                    step="0.1"
                    value={left}
                    onChange={(e) => setLeft(parseFloat(e.target.value) || 0)}
                    style={{ padding: "6px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                  />
                </label>
                <label style={{ display: "grid", gap: "3px", fontSize: "12px", fontWeight: 600 }}>
                  Right (mm):
                  <input
                    type="number"
                    min="2"
                    max="100"
                    step="0.1"
                    value={right}
                    onChange={(e) => setRight(parseFloat(e.target.value) || 0)}
                    style={{ padding: "6px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                  />
                </label>
                <label style={{ display: "grid", gap: "3px", fontSize: "12px", fontWeight: 600, gridColumn: "1 / -1" }}>
                  Gutter (binding margin in mm):
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={gutter}
                    onChange={(e) => setGutter(parseFloat(e.target.value) || 0)}
                    style={{ padding: "6px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                  />
                </label>
              </div>

              {/* Orientation */}
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#375043", marginBottom: "6px" }}>
                Orientation:
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setOrient("portrait")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    border: orientation === "portrait" ? "2px solid #23654d" : "1px solid #ccd7cf",
                    background: orientation === "portrait" ? "#e2efe9" : "white",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "18px",
                      height: "24px",
                      border: "2px solid currentColor",
                      borderRadius: "2px",
                      background: "white",
                    }}
                  />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>Portrait</div>
                    <div style={{ fontSize: "11px", color: "#61776b" }}>Tall format</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOrient("landscape")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    border: orientation === "landscape" ? "2px solid #23654d" : "1px solid #ccd7cf",
                    background: orientation === "landscape" ? "#e2efe9" : "white",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "18px",
                      border: "2px solid currentColor",
                      borderRadius: "2px",
                      background: "white",
                    }}
                  />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>Landscape</div>
                    <div style={{ fontSize: "11px", color: "#61776b" }}>Wide format</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === "paper" && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#375043", marginBottom: "6px" }}>
                Standard Paper Sizes:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                {PAPER_SIZES.map((p) => {
                  const isCur = paperName === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => selectPaper(p.name)}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        border: isCur ? "2px solid #23654d" : "1px solid #ccd7cf",
                        background: isCur ? "#e2efe9" : "white",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: "#61776b" }}>{p.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: "12px", fontWeight: 700, color: "#375043", marginBottom: "8px" }}>
                Custom Dimensions:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ display: "grid", gap: "3px", fontSize: "12px", fontWeight: 600 }}>
                  Width (mm):
                  <input
                    type="number"
                    min="80"
                    max="600"
                    value={width}
                    onChange={(e) => {
                      setWidth(parseFloat(e.target.value) || 0);
                      setPaperName("Custom");
                    }}
                    style={{ padding: "6px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                  />
                </label>
                <label style={{ display: "grid", gap: "3px", fontSize: "12px", fontWeight: 600 }}>
                  Height (mm):
                  <input
                    type="number"
                    min="80"
                    max="800"
                    value={height}
                    onChange={(e) => {
                      setHeight(parseFloat(e.target.value) || 0);
                      setPaperName("Custom");
                    }}
                    style={{ padding: "6px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "columns" && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#375043", marginBottom: "6px" }}>
                Columns Presets:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px" }}>
                {COLUMN_PRESETS.map((c) => {
                  const isCur = String(columns) === String(c.cols);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setColumns(c.cols)}
                      style={{
                        textAlign: "center",
                        padding: "10px 8px",
                        border: isCur ? "2px solid #23654d" : "1px solid #ccd7cf",
                        background: isCur ? "#e2efe9" : "white",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      {/* Mini column preview icon */}
                      <div
                        style={{
                          height: "30px",
                          display: "flex",
                          gap: "3px",
                          justifyContent: "center",
                          marginBottom: "6px",
                        }}
                      >
                        {c.cols === 1 && (
                          <div style={{ flex: 1, background: "#8ca89b", borderRadius: "1px" }} />
                        )}
                        {c.cols === 2 && (
                          <>
                            <div style={{ flex: 1, background: "#8ca89b", borderRadius: "1px" }} />
                            <div style={{ flex: 1, background: "#8ca89b", borderRadius: "1px" }} />
                          </>
                        )}
                        {c.cols === 3 && (
                          <>
                            <div style={{ flex: 1, background: "#8ca89b", borderRadius: "1px" }} />
                            <div style={{ flex: 1, background: "#8ca89b", borderRadius: "1px" }} />
                            <div style={{ flex: 1, background: "#8ca89b", borderRadius: "1px" }} />
                          </>
                        )}
                        {c.cols === "left" && (
                          <>
                            <div style={{ flex: 1, background: "#8ca89b", borderRadius: "1px" }} />
                            <div style={{ flex: 2, background: "#8ca89b", borderRadius: "1px" }} />
                          </>
                        )}
                        {c.cols === "right" && (
                          <>
                            <div style={{ flex: 2, background: "#8ca89b", borderRadius: "1px" }} />
                            <div style={{ flex: 1, background: "#8ca89b", borderRadius: "1px" }} />
                          </>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "12px" }}>{c.name}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <label style={{ display: "grid", gap: "3px", fontSize: "12px", fontWeight: 600 }}>
                  Spacing / Column Gap (mm):
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={columnGap}
                    onChange={(e) => setColumnGap(parseFloat(e.target.value) || 0)}
                    style={{ padding: "6px 8px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
                  />
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, marginTop: "22px" }}>
                  <input
                    type="checkbox"
                    checked={columnRule}
                    onChange={(e) => setColumnRule(e.target.checked)}
                  />
                  Line between columns
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Live Demo Preview (Word-Style Preview Box) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "#f4f7f5",
            border: "1px solid #d4ded8",
            borderRadius: "6px",
            padding: "12px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#4c6356", textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.5px" }}>
            Live Preview (Demo)
          </div>

          {/* Miniature Page SVG / Canvas */}
          <div
            style={{
              width: `${previewBox.boxW}px`,
              height: `${previewBox.boxH}px`,
              background: "white",
              border: "1px solid #7d9689",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.15s ease",
            }}
          >
            {/* Shaded margin guide frame */}
            <div
              style={{
                position: "absolute",
                top: `${previewBox.pTop}%`,
                bottom: `${previewBox.pBottom}%`,
                left: `${previewBox.pLeft + previewBox.pGutter}%`,
                right: `${previewBox.pRight}%`,
                border: "1px dashed #487d69",
                background: "#fdfefe",
                display: "flex",
                gap: `${columns === 1 ? 0 : 4}px`,
                padding: "3px",
              }}
            >
              {/* Simulated text lines inside columns */}
              {columns === 1 && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
                  <div style={{ height: "3px", background: "#396554", width: "92%" }} />
                  <div style={{ height: "2px", background: "#adc4b8", width: "100%" }} />
                  <div style={{ height: "2px", background: "#adc4b8", width: "95%" }} />
                  <div style={{ height: "2px", background: "#adc4b8", width: "88%" }} />
                  <div style={{ height: "2px", background: "#adc4b8", width: "100%" }} />
                  <div style={{ height: "2px", background: "#adc4b8", width: "90%" }} />
                  <div style={{ height: "2px", background: "#adc4b8", width: "70%" }} />
                </div>
              )}

              {columns === 2 && (
                <>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#396554", width: "90%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "100%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "95%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "80%" }} />
                  </div>
                  {columnRule && <div style={{ width: "1px", background: "#82a192" }} />}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#adc4b8", width: "100%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "92%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "85%" }} />
                  </div>
                </>
              )}

              {columns === 3 && (
                <>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#396554", width: "90%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "95%" }} />
                  </div>
                  {columnRule && <div style={{ width: "1px", background: "#82a192" }} />}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#adc4b8", width: "100%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "85%" }} />
                  </div>
                  {columnRule && <div style={{ width: "1px", background: "#82a192" }} />}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#adc4b8", width: "95%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "80%" }} />
                  </div>
                </>
              )}

              {columns === "left" && (
                <>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#396554", width: "90%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "80%" }} />
                  </div>
                  {columnRule && <div style={{ width: "1px", background: "#82a192" }} />}
                  <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#adc4b8", width: "100%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "95%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "88%" }} />
                  </div>
                </>
              )}

              {columns === "right" && (
                <>
                  <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#396554", width: "95%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "100%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "90%" }} />
                  </div>
                  {columnRule && <div style={{ width: "1px", background: "#82a192" }} />}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ height: "2px", background: "#adc4b8", width: "85%" }} />
                    <div style={{ height: "2px", background: "#adc4b8", width: "80%" }} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ fontSize: "11px", color: "#546e61", marginTop: "10px", textAlign: "center" }}>
            <strong>{paperName}</strong> ({width} × {height} mm)
            <br />
            {orientation === "portrait" ? "Portrait" : "Landscape"} · {columns} Col
          </div>

          <div style={{ marginTop: "auto", fontSize: "11px", color: "#6e8277", width: "100%", textAlign: "center", paddingTop: "8px" }}>
            Apply to: <strong>Whole document</strong>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px", borderTop: "1px solid #d4ded7", paddingTop: "12px" }}>
        <button
          type="button"
          onClick={close}
          style={{
            padding: "8px 18px",
            border: "1px solid #bbc8c0",
            background: "white",
            borderRadius: "4px",
            color: "#283e33",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: "8px 22px",
            background: "#246c53",
            color: "white",
            fontWeight: 600,
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
          }}
        >
          OK / Apply
        </button>
      </div>
    </div>
  );
}

