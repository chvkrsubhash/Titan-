import { useState, useRef, useEffect, useMemo } from "react";
import type { Editor } from "@tiptap/react";

interface SignaturePadProps {
  editor: Editor;
  close: () => void;
  notify: (msg: string) => void;
}

const FONTS = [
  { name: "Cursive Script", style: "italic 32px 'Brush Script MT', cursive, sans-serif" },
  { name: "Elegant Handwriting", style: "italic 30px 'Lucida Handwriting', cursive, serif" },
  { name: "Executive Signature", style: "italic 28px 'Segoe Script', cursive, sans-serif" },
  { name: "Classic Calligraphy", style: "italic 32px 'Apple Chancery', serif" },
];

const COLORS = [
  { name: "Classic Navy", hex: "#0f2b48" },
  { name: "Dark Ink", hex: "#111827" },
  { name: "Emerald Green", hex: "#065f46" },
  { name: "Royal Purple", hex: "#581c87" },
];

export function SignaturePad({ editor, close, notify }: SignaturePadProps) {
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("Alex Morgan");
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  // Drawing Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Initialize canvas
  useEffect(() => {
    if (tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = selectedColor.hex;
  }, [tab, selectedColor]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    isDrawing.current = true;
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Generate typed signature image data URL
  const typedSignatureDataUrl = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 460;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.font = selectedFont.style;
    ctx.fillStyle = selectedColor.hex;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);

    // Decorative baseline stroke
    ctx.strokeStyle = selectedColor.hex;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, canvas.height / 2 + 25);
    ctx.lineTo(420, canvas.height / 2 + 25);
    ctx.stroke();

    return canvas.toDataURL("image/png");
  }, [typedName, selectedFont, selectedColor]);

  const handleInsert = () => {
    let src = "";
    if (tab === "draw") {
      if (!canvasRef.current || !hasDrawn) {
        notify("Please draw your signature first.");
        return;
      }
      src = canvasRef.current.toDataURL("image/png");
    } else {
      if (!typedName.trim()) {
        notify("Please enter a name for the signature.");
        return;
      }
      src = typedSignatureDataUrl;
    }

    editor.chain().focus().insertContent({
      type: "image",
      attrs: {
        src,
        alt: "Digital signature",
        width: 260,
      },
    }).run();

    notify("Signature inserted successfully!");
    close();
  };

  return (
    <div className="signature-pad-dialog" style={{ width: "100%", maxWidth: "560px", color: "#1f3328" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #d4ded8", marginBottom: "16px", gap: "6px" }}>
        <button
          type="button"
          onClick={() => setTab("draw")}
          style={{
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "13px",
            border: "none",
            borderBottom: tab === "draw" ? "3px solid #23654d" : "3px solid transparent",
            background: tab === "draw" ? "#f0f5f2" : "transparent",
            color: tab === "draw" ? "#184534" : "#51665a",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
          }}
        >
          Draw Signature
        </button>
        <button
          type="button"
          onClick={() => setTab("type")}
          style={{
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "13px",
            border: "none",
            borderBottom: tab === "type" ? "3px solid #23654d" : "3px solid transparent",
            background: tab === "type" ? "#f0f5f2" : "transparent",
            color: tab === "type" ? "#184534" : "#51665a",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
          }}
        >
          Type Stylized Signature
        </button>
      </div>

      {/* Color picker row */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#465f52" }}>Ink Color:</span>
        {COLORS.map((col) => (
          <button
            key={col.hex}
            type="button"
            onClick={() => setSelectedColor(col)}
            title={col.name}
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: col.hex,
              border: selectedColor.hex === col.hex ? "3px solid #75a48e" : "1px solid #ccc",
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      {tab === "draw" ? (
        <div>
          <div
            style={{
              border: "2px dashed #b5c7bd",
              borderRadius: "6px",
              background: "#fafcfb",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <canvas
              ref={canvasRef}
              width={500}
              height={160}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{ display: "block", cursor: "crosshair", width: "100%", height: "160px" }}
            />
            {!hasDrawn && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a89d",
                  pointerEvents: "none",
                  fontSize: "14px",
                }}
              >
                Sign here with your mouse or stylus...
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="button"
              onClick={clearCanvas}
              style={{ fontSize: "12px", color: "#61776b", border: "none", background: "transparent", cursor: "pointer", textDecoration: "underline" }}
            >
              Clear Pad
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 600, marginBottom: "12px" }}>
            Full Name or Signer:
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #bcc9c1", borderRadius: "4px", fontSize: "14px" }}
            />
          </label>

          <span style={{ fontSize: "12px", fontWeight: 600, color: "#465f52", display: "block", marginBottom: "6px" }}>
            Signature Style:
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
            {FONTS.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setSelectedFont(f)}
                style={{
                  padding: "10px",
                  border: selectedFont.name === f.name ? "2px solid #246c53" : "1px solid #ccd8cf",
                  background: selectedFont.name === f.name ? "#e3efe9" : "white",
                  borderRadius: "4px",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div style={{ font: f.style, color: selectedColor.hex, fontSize: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {typedName || "Signature"}
                </div>
                <div style={{ fontSize: "11px", color: "#61776c", marginTop: "4px" }}>{f.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

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
          onClick={handleInsert}
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
          Insert Signature
        </button>
      </div>
    </div>
  );
}

