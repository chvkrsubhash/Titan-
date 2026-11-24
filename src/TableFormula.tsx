import { useState, useMemo, useEffect } from "react";
import type { Editor } from "@tiptap/react";

interface TableFormulaProps {
  editor: Editor;
  close: () => void;
  notify: (msg: string) => void;
}

const FUNCTIONS = ["SUM", "AVERAGE", "COUNT", "MAX", "MIN", "PRODUCT"];

const NUMBER_FORMATS = [
  { label: "Standard (1234.56)", format: "std" },
  { label: "Currency ($#,##0.00)", format: "currency" },
  { label: "Rupee (₹#,##0.00)", format: "rupee" },
  { label: "Euro (€#,##0.00)", format: "euro" },
  { label: "Percentage (0.00%)", format: "percent" },
  { label: "Integer (1235)", format: "int" },
];

export function TableFormula({ editor, close, notify }: TableFormulaProps) {
  const [formula, setFormula] = useState("=SUM(ABOVE)");
  const [format, setFormat] = useState("std");

  // Inspect the active table cell from DOM
  const tableData = useMemo(() => {
    try {
      const { selection } = editor.state;
      const domNode = editor.view.domAtPos(selection.from).node;
      const el = domNode instanceof HTMLElement ? domNode : domNode.parentElement;
      const cell = el?.closest("td, th") as HTMLTableCellElement | null;
      const row = cell?.closest("tr") as HTMLTableRowElement | null;
      const table = cell?.closest("table") as HTMLTableElement | null;

      if (!cell || !row || !table) return null;

      const colIdx = cell.cellIndex;
      const rowIdx = row.rowIndex;

      // Extract numbers above
      const aboveNumbers: number[] = [];
      for (let r = 0; r < rowIdx; r++) {
        const targetRow = table.rows[r];
        if (targetRow && targetRow.cells[colIdx]) {
          const text = targetRow.cells[colIdx].textContent || "";
          const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
          if (!isNaN(num)) aboveNumbers.push(num);
        }
      }

      // Extract numbers to the left
      const leftNumbers: number[] = [];
      for (let c = 0; c < colIdx; c++) {
        if (row.cells[c]) {
          const text = row.cells[c].textContent || "";
          const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
          if (!isNaN(num)) leftNumbers.push(num);
        }
      }

      return { colIdx, rowIdx, aboveNumbers, leftNumbers };
    } catch {
      return null;
    }
  }, [editor]);

  // Default to SUM(LEFT) if no numbers above but numbers on left exist
  useEffect(() => {
    if (tableData) {
      if (tableData.aboveNumbers.length === 0 && tableData.leftNumbers.length > 0) {
        setFormula("=SUM(LEFT)");
      }
    }
  }, [tableData]);

  // Compute calculated result
  const calculatedResult = useMemo(() => {
    if (!formula.startsWith("=")) return "Formula must start with '='";
    const expr = formula.slice(1).trim().toUpperCase();

    const evaluateList = (fn: string, nums: number[]): number => {
      if (nums.length === 0) return 0;
      switch (fn) {
        case "SUM":
          return nums.reduce((a, b) => a + b, 0);
        case "AVERAGE":
          return nums.reduce((a, b) => a + b, 0) / nums.length;
        case "COUNT":
          return nums.length;
        case "MAX":
          return Math.max(...nums);
        case "MIN":
          return Math.min(...nums);
        case "PRODUCT":
          return nums.reduce((a, b) => a * b, 1);
        default:
          return 0;
      }
    };

    try {
      // Check for fn(ABOVE) or fn(LEFT)
      const match = expr.match(/^(SUM|AVERAGE|COUNT|MAX|MIN|PRODUCT)\((ABOVE|LEFT)\)$/);
      if (match) {
        const [, fn, dir] = match;
        const nums = dir === "ABOVE" ? tableData?.aboveNumbers || [] : tableData?.leftNumbers || [];
        const rawVal = evaluateList(fn, nums);
        return formatValue(rawVal, format);
      }

      // Safe arithmetic calculation: replace safe characters and evaluate
      const cleanExpr = expr.replace(/[^0-9.+\-*/()]/g, "");
      if (!cleanExpr) return "0";
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${cleanExpr})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        return formatValue(result, format);
      }
      return "Invalid formula";
    } catch {
      return "Syntax Error";
    }
  }, [formula, format, tableData]);

  function formatValue(val: number, fmt: string): string {
    switch (fmt) {
      case "currency":
        return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case "rupee":
        return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case "euro":
        return "€" + val.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case "percent":
        return (val * 100).toFixed(2) + "%";
      case "int":
        return Math.round(val).toLocaleString();
      default:
        return Number.isInteger(val) ? String(val) : val.toFixed(2);
    }
  }

  const handleInsert = () => {
    if (calculatedResult.includes("Error") || calculatedResult.includes("Invalid")) {
      notify("Please enter a valid formula.");
      return;
    }
    editor.chain().focus().insertContent(calculatedResult).run();
    close();
  };

  return (
    <div className="table-formula-dialog" style={{ width: "100%", maxWidth: "520px", color: "#1f3328" }}>
      <p style={{ fontSize: "13px", color: "#546a5d", margin: "0 0 16px 0" }}>
        Calculate sums, averages, or custom mathematical expressions directly in the selected table cell, just like in Microsoft Word.
      </p>

      {/* Formula Input */}
      <label style={{ display: "grid", gap: "4px", fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>
        Formula:
        <input
          type="text"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="=SUM(ABOVE)"
          style={{
            padding: "8px 10px",
            border: "1px solid #bcc9c1",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "14px",
            background: "white",
          }}
        />
      </label>

      {/* Quick Paste Functions */}
      <div style={{ marginBottom: "14px" }}>
        <span style={{ fontSize: "12px", color: "#475e51", fontWeight: 600, display: "block", marginBottom: "4px" }}>
          Quick Functions:
        </span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {FUNCTIONS.map((fn) => (
            <button
              key={fn}
              type="button"
              onClick={() => setFormula(`=${fn}(ABOVE)`)}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 600,
                border: "1px solid #cad5cd",
                background: "#f4f7f5",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              ={fn}(ABOVE)
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFormula("=SUM(LEFT)")}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              border: "1px solid #cad5cd",
              background: "#f4f7f5",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            =SUM(LEFT)
          </button>
        </div>
      </div>

      {/* Number Format */}
      <label style={{ display: "grid", gap: "4px", fontSize: "13px", fontWeight: 600, marginBottom: "16px" }}>
        Number format:
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          style={{ padding: "8px 10px", border: "1px solid #bcc9c1", borderRadius: "4px", background: "white" }}
        >
          {NUMBER_FORMATS.map((fmt) => (
            <option key={fmt.format} value={fmt.format}>
              {fmt.label}
            </option>
          ))}
        </select>
      </label>

      {/* Detected Context & Preview */}
      <div
        style={{
          background: "#eef4f0",
          border: "1px solid #d0ded5",
          borderRadius: "6px",
          padding: "12px 14px",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#324d3f" }}>Calculated Result:</span>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "#19513d", fontFamily: "monospace" }}>
            {calculatedResult}
          </span>
        </div>
        <div style={{ fontSize: "11px", color: "#60786b", marginTop: "6px" }}>
          {tableData ? (
            <>
              Detected {tableData.aboveNumbers.length} number(s) above and {tableData.leftNumbers.length} number(s) to the left.
            </>
          ) : (
            "Place cursor inside a table cell to calculate row or column ranges."
          )}
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
          Insert Formula
        </button>
      </div>
    </div>
  );
}

