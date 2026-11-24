import { useState, useMemo } from "react";
import type { Editor } from "@tiptap/react";

interface SymbolItem {
  char: string;
  name: string;
  cat: string;
}

const SYMBOLS_DATA: SymbolItem[] = [
  // Currency
  { char: "$", name: "Dollar sign", cat: "Currency" },
  { char: "€", name: "Euro sign", cat: "Currency" },
  { char: "£", name: "Pound sign", cat: "Currency" },
  { char: "¥", name: "Yen sign", cat: "Currency" },
  { char: "₹", name: "Indian Rupee sign", cat: "Currency" },
  { char: "₩", name: "Won sign", cat: "Currency" },
  { char: "₿", name: "Bitcoin sign", cat: "Currency" },
  { char: "¢", name: "Cent sign", cat: "Currency" },
  { char: "₽", name: "Ruble sign", cat: "Currency" },
  { char: "₺", name: "Turkish Lira sign", cat: "Currency" },
  { char: "₫", name: "Dong sign", cat: "Currency" },
  { char: "₱", name: "Peso sign", cat: "Currency" },
  { char: "₦", name: "Naira sign", cat: "Currency" },
  { char: "₲", name: "Guarani sign", cat: "Currency" },
  { char: "₴", name: "Hryvnia sign", cat: "Currency" },
  { char: "₸", name: "Tenge sign", cat: "Currency" },
  { char: "₭", name: "Kip sign", cat: "Currency" },
  { char: "₮", name: "Tugrik sign", cat: "Currency" },

  // Math & Logic
  { char: "±", name: "Plus-minus sign", cat: "Math & Logic" },
  { char: "×", name: "Multiplication sign", cat: "Math & Logic" },
  { char: "÷", name: "Division sign", cat: "Math & Logic" },
  { char: "≈", name: "Almost equal to", cat: "Math & Logic" },
  { char: "≠", name: "Not equal to", cat: "Math & Logic" },
  { char: "≤", name: "Less-than or equal to", cat: "Math & Logic" },
  { char: "≥", name: "Greater-than or equal to", cat: "Math & Logic" },
  { char: "∞", name: "Infinity", cat: "Math & Logic" },
  { char: "∑", name: "N-ary summation", cat: "Math & Logic" },
  { char: "∏", name: "N-ary product", cat: "Math & Logic" },
  { char: "√", name: "Square root", cat: "Math & Logic" },
  { char: "∂", name: "Partial differential", cat: "Math & Logic" },
  { char: "∫", name: "Integral", cat: "Math & Logic" },
  { char: "∆", name: "Increment / Delta", cat: "Math & Logic" },
  { char: "‰", name: "Per mille sign", cat: "Math & Logic" },
  { char: "¼", name: "Vulgar fraction one quarter", cat: "Math & Logic" },
  { char: "½", name: "Vulgar fraction one half", cat: "Math & Logic" },
  { char: "¾", name: "Vulgar fraction three quarters", cat: "Math & Logic" },
  { char: "⅓", name: "Vulgar fraction one third", cat: "Math & Logic" },
  { char: "⅔", name: "Vulgar fraction two thirds", cat: "Math & Logic" },
  { char: "⅛", name: "Vulgar fraction one eighth", cat: "Math & Logic" },
  { char: "⅜", name: "Vulgar fraction three eighths", cat: "Math & Logic" },
  { char: "⅝", name: "Vulgar fraction five eighths", cat: "Math & Logic" },
  { char: "⅞", name: "Vulgar fraction seven eighths", cat: "Math & Logic" },
  { char: "¬", name: "Not sign", cat: "Math & Logic" },
  { char: "∧", name: "Logical and", cat: "Math & Logic" },
  { char: "∨", name: "Logical or", cat: "Math & Logic" },
  { char: "⊕", name: "Circled plus", cat: "Math & Logic" },
  { char: "⊗", name: "Circled times", cat: "Math & Logic" },
  { char: "∈", name: "Element of", cat: "Math & Logic" },
  { char: "∉", name: "Not an element of", cat: "Math & Logic" },
  { char: "⊂", name: "Subset of", cat: "Math & Logic" },
  { char: "⊃", name: "Superset of", cat: "Math & Logic" },
  { char: "⊆", name: "Subset of or equal to", cat: "Math & Logic" },
  { char: "⊇", name: "Superset of or equal to", cat: "Math & Logic" },
  { char: "∪", name: "Union", cat: "Math & Logic" },
  { char: "∩", name: "Intersection", cat: "Math & Logic" },
  { char: "⊥", name: "Up tack / Perpendicular", cat: "Math & Logic" },
  { char: "∠", name: "Angle", cat: "Math & Logic" },
  { char: "°", name: "Degree sign", cat: "Math & Logic" },
  { char: "′", name: "Prime (minutes / feet)", cat: "Math & Logic" },
  { char: "″", name: "Double prime (seconds / inches)", cat: "Math & Logic" },
  { char: "∝", name: "Proportional to", cat: "Math & Logic" },

  // Greek Letters
  { char: "α", name: "Greek small letter alpha", cat: "Greek Letters" },
  { char: "β", name: "Greek small letter beta", cat: "Greek Letters" },
  { char: "γ", name: "Greek small letter gamma", cat: "Greek Letters" },
  { char: "δ", name: "Greek small letter delta", cat: "Greek Letters" },
  { char: "ε", name: "Greek small letter epsilon", cat: "Greek Letters" },
  { char: "ζ", name: "Greek small letter zeta", cat: "Greek Letters" },
  { char: "η", name: "Greek small letter eta", cat: "Greek Letters" },
  { char: "θ", name: "Greek small letter theta", cat: "Greek Letters" },
  { char: "ι", name: "Greek small letter iota", cat: "Greek Letters" },
  { char: "κ", name: "Greek small letter kappa", cat: "Greek Letters" },
  { char: "λ", name: "Greek small letter lambda", cat: "Greek Letters" },
  { char: "μ", name: "Greek small letter mu / micro", cat: "Greek Letters" },
  { char: "ν", name: "Greek small letter nu", cat: "Greek Letters" },
  { char: "ξ", name: "Greek small letter xi", cat: "Greek Letters" },
  { char: "ο", name: "Greek small letter omicron", cat: "Greek Letters" },
  { char: "π", name: "Greek small letter pi", cat: "Greek Letters" },
  { char: "ρ", name: "Greek small letter rho", cat: "Greek Letters" },
  { char: "σ", name: "Greek small letter sigma", cat: "Greek Letters" },
  { char: "τ", name: "Greek small letter tau", cat: "Greek Letters" },
  { char: "υ", name: "Greek small letter upsilon", cat: "Greek Letters" },
  { char: "φ", name: "Greek small letter phi", cat: "Greek Letters" },
  { char: "χ", name: "Greek small letter chi", cat: "Greek Letters" },
  { char: "ψ", name: "Greek small letter psi", cat: "Greek Letters" },
  { char: "ω", name: "Greek small letter omega", cat: "Greek Letters" },
  { char: "Α", name: "Greek capital letter Alpha", cat: "Greek Letters" },
  { char: "Β", name: "Greek capital letter Beta", cat: "Greek Letters" },
  { char: "Γ", name: "Greek capital letter Gamma", cat: "Greek Letters" },
  { char: "Δ", name: "Greek capital letter Delta", cat: "Greek Letters" },
  { char: "Ε", name: "Greek capital letter Epsilon", cat: "Greek Letters" },
  { char: "Ζ", name: "Greek capital letter Zeta", cat: "Greek Letters" },
  { char: "Η", name: "Greek capital letter Eta", cat: "Greek Letters" },
  { char: "Θ", name: "Greek capital letter Theta", cat: "Greek Letters" },
  { char: "Ι", name: "Greek capital letter Iota", cat: "Greek Letters" },
  { char: "Κ", name: "Greek capital letter Kappa", cat: "Greek Letters" },
  { char: "Λ", name: "Greek capital letter Lambda", cat: "Greek Letters" },
  { char: "Μ", name: "Greek capital letter Mu", cat: "Greek Letters" },
  { char: "Ν", name: "Greek capital letter Nu", cat: "Greek Letters" },
  { char: "Ξ", name: "Greek capital letter Xi", cat: "Greek Letters" },
  { char: "Ο", name: "Greek capital letter Omicron", cat: "Greek Letters" },
  { char: "Π", name: "Greek capital letter Pi", cat: "Greek Letters" },
  { char: "Ρ", name: "Greek capital letter Rho", cat: "Greek Letters" },
  { char: "Σ", name: "Greek capital letter Sigma", cat: "Greek Letters" },
  { char: "Τ", name: "Greek capital letter Tau", cat: "Greek Letters" },
  { char: "Υ", name: "Greek capital letter Upsilon", cat: "Greek Letters" },
  { char: "Φ", name: "Greek capital letter Phi", cat: "Greek Letters" },
  { char: "Χ", name: "Greek capital letter Chi", cat: "Greek Letters" },
  { char: "Ψ", name: "Greek capital letter Psi", cat: "Greek Letters" },
  { char: "Ω", name: "Greek capital letter Omega", cat: "Greek Letters" },

  // Arrows & Pointers
  { char: "←", name: "Leftwards arrow", cat: "Arrows & Pointers" },
  { char: "↑", name: "Upwards arrow", cat: "Arrows & Pointers" },
  { char: "→", name: "Rightwards arrow", cat: "Arrows & Pointers" },
  { char: "↓", name: "Downwards arrow", cat: "Arrows & Pointers" },
  { char: "↔", name: "Left right arrow", cat: "Arrows & Pointers" },
  { char: "↕", name: "Up down arrow", cat: "Arrows & Pointers" },
  { char: "↖", name: "North west arrow", cat: "Arrows & Pointers" },
  { char: "↗", name: "North east arrow", cat: "Arrows & Pointers" },
  { char: "↘", name: "South east arrow", cat: "Arrows & Pointers" },
  { char: "↙", name: "South west arrow", cat: "Arrows & Pointers" },
  { char: "⇐", name: "Leftwards double arrow", cat: "Arrows & Pointers" },
  { char: "⇑", name: "Upwards double arrow", cat: "Arrows & Pointers" },
  { char: "⇒", name: "Rightwards double arrow", cat: "Arrows & Pointers" },
  { char: "⇓", name: "Downwards double arrow", cat: "Arrows & Pointers" },
  { char: "⇔", name: "Left right double arrow", cat: "Arrows & Pointers" },
  { char: "⇕", name: "Up down double arrow", cat: "Arrows & Pointers" },
  { char: "↵", name: "Downwards arrow with corner leftwards (Return)", cat: "Arrows & Pointers" },
  { char: "➔", name: "Heavy rightwards arrow", cat: "Arrows & Pointers" },
  { char: "➜", name: "Heavy round-tipped rightwards arrow", cat: "Arrows & Pointers" },
  { char: "➤", name: "Black rightwards arrowhead", cat: "Arrows & Pointers" },
  { char: "▲", name: "Black up-pointing triangle", cat: "Arrows & Pointers" },
  { char: "▼", name: "Black down-pointing triangle", cat: "Arrows & Pointers" },
  { char: "◀", name: "Black left-pointing triangle", cat: "Arrows & Pointers" },
  { char: "▶", name: "Black right-pointing triangle", cat: "Arrows & Pointers" },
  { char: "◄", name: "Black left-pointing pointer", cat: "Arrows & Pointers" },
  { char: "►", name: "Black right-pointing pointer", cat: "Arrows & Pointers" },

  // Typography & Special
  { char: "©", name: "Copyright sign", cat: "Typography & Special" },
  { char: "®", name: "Registered sign", cat: "Typography & Special" },
  { char: "™", name: "Trade mark sign", cat: "Typography & Special" },
  { char: "§", name: "Section sign", cat: "Typography & Special" },
  { char: "¶", name: "Pilcrow sign (paragraph sign)", cat: "Typography & Special" },
  { char: "†", name: "Dagger", cat: "Typography & Special" },
  { char: "‡", name: "Double dagger", cat: "Typography & Special" },
  { char: "•", name: "Bullet", cat: "Typography & Special" },
  { char: "◦", name: "White bullet", cat: "Typography & Special" },
  { char: "‣", name: "Triangular bullet", cat: "Typography & Special" },
  { char: "—", name: "Em dash", cat: "Typography & Special" },
  { char: "–", name: "En dash", cat: "Typography & Special" },
  { char: "…", name: "Horizontal ellipsis", cat: "Typography & Special" },
  { char: "«", name: "Left-pointing double angle quotation mark", cat: "Typography & Special" },
  { char: "»", name: "Right-pointing double angle quotation mark", cat: "Typography & Special" },
  { char: "“", name: "Left double quotation mark", cat: "Typography & Special" },
  { char: "”", name: "Right double quotation mark", cat: "Typography & Special" },
  { char: "‘", name: "Left single quotation mark", cat: "Typography & Special" },
  { char: "’", name: "Right single quotation mark", cat: "Typography & Special" },
  { char: "‹", name: "Single left-pointing angle quotation mark", cat: "Typography & Special" },
  { char: "›", name: "Single right-pointing angle quotation mark", cat: "Typography & Special" },
  { char: "№", name: "Numero sign", cat: "Typography & Special" },
  { char: "℃", name: "Degree Celsius", cat: "Typography & Special" },
  { char: "℉", name: "Degree Fahrenheit", cat: "Typography & Special" },
  { char: "ª", name: "Feminine ordinal indicator", cat: "Typography & Special" },
  { char: "º", name: "Masculine ordinal indicator", cat: "Typography & Special" },
  { char: "¿", name: "Inverted question mark", cat: "Typography & Special" },
  { char: "¡", name: "Inverted exclamation mark", cat: "Typography & Special" },

  // Latin Accents & Diacritics
  { char: "á", name: "Latin small a with acute", cat: "Latin Accents" },
  { char: "é", name: "Latin small e with acute", cat: "Latin Accents" },
  { char: "í", name: "Latin small i with acute", cat: "Latin Accents" },
  { char: "ó", name: "Latin small o with acute", cat: "Latin Accents" },
  { char: "ú", name: "Latin small u with acute", cat: "Latin Accents" },
  { char: "ñ", name: "Latin small n with tilde", cat: "Latin Accents" },
  { char: "ü", name: "Latin small u with diaeresis", cat: "Latin Accents" },
  { char: "à", name: "Latin small a with grave", cat: "Latin Accents" },
  { char: "è", name: "Latin small e with grave", cat: "Latin Accents" },
  { char: "ì", name: "Latin small i with grave", cat: "Latin Accents" },
  { char: "ò", name: "Latin small o with grave", cat: "Latin Accents" },
  { char: "ù", name: "Latin small u with grave", cat: "Latin Accents" },
  { char: "â", name: "Latin small a with circumflex", cat: "Latin Accents" },
  { char: "ê", name: "Latin small e with circumflex", cat: "Latin Accents" },
  { char: "î", name: "Latin small i with circumflex", cat: "Latin Accents" },
  { char: "ô", name: "Latin small o with circumflex", cat: "Latin Accents" },
  { char: "û", name: "Latin small u with circumflex", cat: "Latin Accents" },
  { char: "ä", name: "Latin small a with diaeresis", cat: "Latin Accents" },
  { char: "ë", name: "Latin small e with diaeresis", cat: "Latin Accents" },
  { char: "ï", name: "Latin small i with diaeresis", cat: "Latin Accents" },
  { char: "ö", name: "Latin small o with diaeresis", cat: "Latin Accents" },
  { char: "ÿ", name: "Latin small y with diaeresis", cat: "Latin Accents" },
  { char: "ã", name: "Latin small a with tilde", cat: "Latin Accents" },
  { char: "õ", name: "Latin small o with tilde", cat: "Latin Accents" },
  { char: "ç", name: "Latin small c with cedilla", cat: "Latin Accents" },
  { char: "å", name: "Latin small a with ring above", cat: "Latin Accents" },
  { char: "æ", name: "Latin small letter ae", cat: "Latin Accents" },
  { char: "œ", name: "Latin small ligature oe", cat: "Latin Accents" },
  { char: "ø", name: "Latin small letter o with stroke", cat: "Latin Accents" },
  { char: "Á", name: "Latin capital A with acute", cat: "Latin Accents" },
  { char: "É", name: "Latin capital E with acute", cat: "Latin Accents" },
  { char: "Í", name: "Latin capital I with acute", cat: "Latin Accents" },
  { char: "Ó", name: "Latin capital O with acute", cat: "Latin Accents" },
  { char: "Ú", name: "Latin capital U with acute", cat: "Latin Accents" },
  { char: "Ñ", name: "Latin capital N with tilde", cat: "Latin Accents" },
  { char: "Ü", name: "Latin capital U with diaeresis", cat: "Latin Accents" },
  { char: "À", name: "Latin capital A with grave", cat: "Latin Accents" },
  { char: "È", name: "Latin capital E with grave", cat: "Latin Accents" },
  { char: "Ç", name: "Latin capital C with cedilla", cat: "Latin Accents" },
  { char: "Å", name: "Latin capital A with ring above", cat: "Latin Accents" },
  { char: "Æ", name: "Latin capital letter AE", cat: "Latin Accents" },
  { char: "Œ", name: "Latin capital ligature OE", cat: "Latin Accents" },
  { char: "Ø", name: "Latin capital letter O with stroke", cat: "Latin Accents" },

  // Shapes & Checkmarks
  { char: "✓", name: "Check mark", cat: "Shapes & Checkmarks" },
  { char: "✔", name: "Heavy check mark", cat: "Shapes & Checkmarks" },
  { char: "✕", name: "Multiplication X / Cross", cat: "Shapes & Checkmarks" },
  { char: "✖", name: "Heavy multiplication X", cat: "Shapes & Checkmarks" },
  { char: "★", name: "Black star", cat: "Shapes & Checkmarks" },
  { char: "☆", name: "White star", cat: "Shapes & Checkmarks" },
  { char: "◆", name: "Black diamond", cat: "Shapes & Checkmarks" },
  { char: "◇", name: "White diamond", cat: "Shapes & Checkmarks" },
  { char: "■", name: "Black square", cat: "Shapes & Checkmarks" },
  { char: "□", name: "White square", cat: "Shapes & Checkmarks" },
  { char: "●", name: "Black circle", cat: "Shapes & Checkmarks" },
  { char: "○", name: "White circle", cat: "Shapes & Checkmarks" },
  { char: "◉", name: "Fisheye", cat: "Shapes & Checkmarks" },
  { char: "◈", name: "White diamond containing black small diamond", cat: "Shapes & Checkmarks" },
  { char: "♥", name: "Black heart suit", cat: "Shapes & Checkmarks" },
  { char: "♦", name: "Black diamond suit", cat: "Shapes & Checkmarks" },
  { char: "♣", name: "Black club suit", cat: "Shapes & Checkmarks" },
  { char: "♠", name: "Black spade suit", cat: "Shapes & Checkmarks" },
  { char: "♪", name: "Eighth note", cat: "Shapes & Checkmarks" },
  { char: "♫", name: "Beamed eighth notes", cat: "Shapes & Checkmarks" },
  { char: "⚙", name: "Gear", cat: "Shapes & Checkmarks" },
  { char: "⚡", name: "High voltage sign", cat: "Shapes & Checkmarks" },
  { char: "✦", name: "Black four pointed star", cat: "Shapes & Checkmarks" },
  { char: "✧", name: "White four pointed star", cat: "Shapes & Checkmarks" },
];

export const SYMBOL_CATEGORIES = [
  "All",
  "Currency",
  "Math & Logic",
  "Greek Letters",
  "Arrows & Pointers",
  "Typography & Special",
  "Latin Accents",
  "Shapes & Checkmarks",
];

export const QUICK_SYMBOLS = ["©", "®", "™", "§", "±", "×", "÷", "≠", "≤", "≥", "→", "←", "π", "∞", "°", "€", "£", "¥", "₹", "✓", "★"];

export function SymbolsDialog({
  editor,
  close,
}: {
  editor: Editor;
  close: () => void;
}) {
  const [selectedCat, setSelectedCat] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SymbolItem>(SYMBOLS_DATA[0]);

  // Load recently used from localStorage
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("titan.recent_symbols");
      return saved ? JSON.parse(saved) : ["©", "®", "™", "§", "±", "→", "π", "∞", "°", "€", "£", "¥", "₹", "✓", "★", "…"];
    } catch {
      return ["©", "®", "™", "§", "±", "→", "π", "∞", "°", "€", "£", "¥", "₹", "✓", "★", "…"];
    }
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SYMBOLS_DATA.filter((item) => {
      if (selectedCat !== "All" && item.cat !== selectedCat) return false;
      if (!q) return true;
      return (
        item.char.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.cat.toLowerCase().includes(q)
      );
    });
  }, [selectedCat, query]);

  const insertSymbol = (char: string, item?: SymbolItem) => {
    editor.chain().focus().insertContent(char).run();
    // Update recent symbols
    setRecent((prev) => {
      const next = [char, ...prev.filter((c) => c !== char)].slice(0, 20);
      try {
        localStorage.setItem("titan.recent_symbols", JSON.stringify(next));
      } catch {}
      return next;
    });
    if (item) setSelected(item);
  };

  const getUnicodeHex = (char: string) => {
    const code = char.codePointAt(0);
    return code ? "U+" + code.toString(16).toUpperCase().padStart(4, "0") : "";
  };

  const getDecCode = (char: string) => {
    const code = char.codePointAt(0);
    return code ? `&#${code};` : "";
  };

  return (
    <div className="symbols-dialog" style={{ width: "100%", maxWidth: "680px" }}>
      {/* Top Search & Filter Bar */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "180px" }}>
          <label style={{ fontSize: "12px", color: "#4d6054", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Subset / Category
          </label>
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", border: "1px solid #bcc9c1", background: "white", borderRadius: "4px" }}
          >
            {SYMBOL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1.5, minWidth: "200px" }}>
          <label style={{ fontSize: "12px", color: "#4d6054", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Search symbols
          </label>
          <input
            type="text"
            placeholder="Search by name or character (e.g. euro, delta, arrow)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", border: "1px solid #bcc9c1", borderRadius: "4px" }}
          />
        </div>
      </div>

      {/* Main Symbols Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))",
          gap: "4px",
          height: "240px",
          overflowY: "auto",
          border: "1px solid #c9d5cd",
          borderRadius: "4px",
          padding: "8px",
          background: "white",
        }}
      >
        {filtered.map((item) => {
          const isSelected = selected.char === item.char;
          return (
            <button
              key={item.char + item.name}
              type="button"
              onClick={() => setSelected(item)}
              onDoubleClick={() => insertSymbol(item.char, item)}
              title={`${item.name} (${getUnicodeHex(item.char)})`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "40px",
                fontSize: "20px",
                border: isSelected ? "2px solid #23654d" : "1px solid #e1e8e3",
                background: isSelected ? "#e2efe9" : "transparent",
                borderRadius: "3px",
                cursor: "pointer",
                transition: "all 0.08s ease",
              }}
            >
              {item.char}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "30px", color: "#74867d" }}>
            No symbols match your search.
          </div>
        )}
      </div>

      {/* Character Details Box & Recently Used */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginTop: "12px",
          padding: "10px 14px",
          background: "#f4f7f5",
          border: "1px solid #d5ded8",
          borderRadius: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              background: "white",
              border: "1px solid #c1cec5",
              borderRadius: "4px",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            {selected.char}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e3328" }}>{selected.name}</div>
            <div style={{ fontSize: "12px", color: "#596f63", marginTop: "2px" }}>
              Unicode: <strong>{getUnicodeHex(selected.char)}</strong> · HTML Entity: <strong>{getDecCode(selected.char)}</strong> · Category: {selected.cat}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => insertSymbol(selected.char, selected)}
          style={{
            background: "#246c53",
            color: "white",
            padding: "8px 18px",
            fontWeight: 600,
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Insert
        </button>
      </div>

      {/* Recently Used Symbols Row */}
      <div style={{ marginTop: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#465d50", marginBottom: "6px" }}>
          Recently used symbols:
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {recent.map((char) => (
            <button
              key={"recent-" + char}
              type="button"
              onClick={() => {
                const found = SYMBOLS_DATA.find((s) => s.char === char);
                if (found) setSelected(found);
                insertSymbol(char);
              }}
              title={char}
              style={{
                width: "32px",
                height: "32px",
                fontSize: "17px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #ccd7cf",
                background: "white",
                borderRadius: "3px",
              }}
            >
              {char}
            </button>
          ))}
        </div>
      </div>

      {/* Footer controls */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px", borderTop: "1px solid #e1e7e3", paddingTop: "12px" }}>
        <button
          type="button"
          onClick={close}
          style={{
            padding: "7px 16px",
            border: "1px solid #bbc8c0",
            background: "white",
            borderRadius: "4px",
            color: "#283e33",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

