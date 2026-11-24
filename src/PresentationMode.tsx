import { useState, useEffect, useMemo, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import * as I from "lucide-react";

interface Slide {
  title: string;
  points: string[];
}

export function PresentationMode({
  editor,
  close,
}: {
  editor: Editor;
  close: () => void;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Extract slides from document content
  const slides: Slide[] = useMemo(() => {
    const result: Slide[] = [];
    let currentTitle = "Overview";
    let currentPoints: string[] = [];

    editor.state.doc.descendants((node) => {
      if (node.type.name === "heading") {
        if (currentPoints.length > 0 || result.length > 0) {
          result.push({
            title: currentTitle,
            points: currentPoints.length > 0 ? currentPoints : ["Key discussion points & overview"],
          });
          currentPoints = [];
        }
        currentTitle = node.textContent || "Slide";
      } else if (node.type.name === "paragraph" || node.type.name === "listItem") {
        const text = node.textContent.trim();
        if (text && text.length > 3) {
          currentPoints.push(text);
        }
      }
    });

    if (currentTitle || currentPoints.length > 0) {
      result.push({
        title: currentTitle || "Summary",
        points: currentPoints.length > 0 ? currentPoints : ["Summary & Conclusion"],
      });
    }

    return result.length > 0
      ? result
      : [
          {
            title: "Executive Summary",
            points: [
              "Welcome to the document presentation mode.",
              "Add headings and bullet points to automatically generate distinct presentation slides.",
            ],
          },
        ];
  }, [editor]);

  const total = slides.length;
  const activeSlide = slides[currentSlide] || slides[0];

  const nextSlide = useCallback(() => {
    setCurrentSlide((curr) => (curr < total - 1 ? curr + 1 : curr));
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((curr) => (curr > 0 ? curr - 1 : curr));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Space" || e.key === "Enter") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, close]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "linear-gradient(135deg, #11231a 0%, #1e3a2d 50%, #0d1b14 100%)",
        color: "#f0f6f2",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "40px 60px",
        fontFamily: "'Segoe UI', Roboto, Inter, sans-serif",
      }}
    >
      {/* Top Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              background: "#246c53",
              color: "white",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.5px",
            }}
          >
            TITAN SLIDES
          </div>
          <span style={{ fontSize: "14px", color: "#a2c1b2" }}>Instant Presentation Mode</span>
        </div>

        <button
          type="button"
          onClick={close}
          style={{
            background: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            backdropFilter: "blur(6px)",
          }}
        >
          <I.X size={16} /> Exit (Esc)
        </button>
      </div>

      {/* Main Slide Card */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: "1000px",
          width: "100%",
          margin: "0 auto",
          padding: "20px 0",
        }}
      >
        <div style={{ fontSize: "16px", fontWeight: 700, color: "#54b38d", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
          Slide {currentSlide + 1} of {total}
        </div>

        <h1
          style={{
            fontSize: "44px",
            fontWeight: 800,
            lineHeight: "1.2",
            margin: "0 0 36px 0",
            color: "#ffffff",
            textShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          {activeSlide.title}
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {activeSlide.points.slice(0, 5).map((point, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                fontSize: "22px",
                lineHeight: "1.5",
                color: "#e2ede6",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#4ade80",
                  marginTop: "12px",
                  flexShrink: 0,
                }}
              />
              <div>{point}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0, 0, 0, 0.35)",
          padding: "12px 24px",
          borderRadius: "12px",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Progress bar */}
        <div style={{ flex: 1, maxWidth: "250px", height: "6px", background: "rgba(255,255,255,0.15)", borderRadius: "3px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${((currentSlide + 1) / total) * 100}%`,
              background: "#4ade80",
              transition: "width 0.2s ease",
            }}
          />
        </div>

        {/* Counter */}
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#cadfd2" }}>
          {currentSlide + 1} / {total}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            disabled={currentSlide === 0}
            onClick={prevSlide}
            style={{
              padding: "8px 16px",
              background: currentSlide === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.15)",
              color: currentSlide === 0 ? "rgba(255,255,255,0.3)" : "white",
              border: "none",
              borderRadius: "6px",
              cursor: currentSlide === 0 ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 600,
            }}
          >
            <I.ChevronLeft size={18} /> Previous
          </button>

          <button
            type="button"
            disabled={currentSlide === total - 1}
            onClick={nextSlide}
            style={{
              padding: "8px 20px",
              background: currentSlide === total - 1 ? "rgba(255,255,255,0.05)" : "#246c53",
              color: currentSlide === total - 1 ? "rgba(255,255,255,0.3)" : "white",
              border: "none",
              borderRadius: "6px",
              cursor: currentSlide === total - 1 ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 600,
            }}
          >
            Next <I.ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

