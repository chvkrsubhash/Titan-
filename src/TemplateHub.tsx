import { useState, useMemo } from "react";
import type { Editor } from "@tiptap/react";

interface TemplateHubProps {
  editor: Editor;
  close: () => void;
  notify: (msg: string) => void;
}

interface TemplateCard {
  id: string;
  title: string;
  category: "Business" | "Legal" | "Productivity" | "Technical";
  desc: string;
  preview: string;
  nodes: any[];
}

const TEMPLATES_CATALOG: TemplateCard[] = [
  {
    id: "nda-contract",
    title: "Non-Disclosure Agreement (NDA)",
    category: "Legal",
    desc: "Standard mutual confidentiality contract for partners and contractors",
    preview: "MUTUAL CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT\n\nThis Agreement is entered into on this day between...",
    nodes: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "MUTUAL NON-DISCLOSURE AGREEMENT" }] },
      { type: "paragraph", content: [{ type: "text", text: "This Mutual Non-Disclosure Agreement (“Agreement”) is entered into as of {{Agreement_Date}}, by and between {{Company_Name}} and {{Counterparty_Name}}." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Definition of Confidential Information" }] },
      { type: "paragraph", content: [{ type: "text", text: "“Confidential Information” refers to all proprietary data, trade secrets, source code, financial projections, customer records, and product designs disclosed by either party." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "2. Obligations of Receiving Party" }] },
      { type: "paragraph", content: [{ type: "text", text: "The Receiving Party agrees to hold all Confidential Information in strict trust and not disclose it to any third party without prior written authorization." }] },
    ],
  },
  {
    id: "consulting-agreement",
    title: "Consulting Services Contract",
    category: "Legal",
    desc: "Independent contractor service scope, compensation and deliverables",
    preview: "CONSULTING SERVICES AGREEMENT\n\nScope of work, milestone delivery schedule, compensation and IP ownership...",
    nodes: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "CONSULTING SERVICES AGREEMENT" }] },
      { type: "paragraph", content: [{ type: "text", text: "This Agreement outlines the consulting engagement between {{Client_Company}} (“Client”) and {{Consultant_Name}} (“Consultant”)." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Scope of Work & Deliverables" }] },
      { type: "paragraph", content: [{ type: "text", text: "Consultant shall provide strategic advisory, software architecture consulting, and technical verification as requested by Client." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "2. Compensation & Billing" }] },
      { type: "paragraph", content: [{ type: "text", text: "Client agrees to compensate Consultant at the agreed rate of {{Hourly_Rate}} per hour or fixed fee milestone payments." }] },
    ],
  },
  {
    id: "executive-summary",
    title: "Executive Business Proposal",
    category: "Business",
    desc: "C-suite strategic overview, budget request and ROI projections",
    preview: "EXECUTIVE SUMMARY\n\nStrategic vision, market opportunity, solution architecture, and investment requirements...",
    nodes: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Executive Business Proposal" }] },
      { type: "paragraph", content: [{ type: "text", text: "A strategic modernization proposal presented to {{Executive_Sponsor}} by {{Initiative_Lead}}." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Strategic Problem Statement" }] },
      { type: "paragraph", content: [{ type: "text", text: "Current workflows rely on fragmented legacy document silos, incurring high overhead and communication friction." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "2. Proposed Modernization Plan" }] },
      { type: "paragraph", content: [{ type: "text", text: "Deploying Titan word processing with unified CRDT live collaboration, structured variables, and enterprise security." }] },
    ],
  },
  {
    id: "sprint-retro",
    title: "Sprint Retrospective & Team Sync",
    category: "Productivity",
    desc: "Agile retrospective with What Went Well, Action Items, and Roadblocks",
    preview: "SPRINT RETROSPECTIVE\n\nSprint Goal Review, What Went Well, Opportunities for Growth, Action Owners...",
    nodes: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Sprint Retrospective: Sprint {{Sprint_Number}}" }] },
      { type: "paragraph", content: [{ type: "text", text: "Date: {{Retro_Date}} · Facilitator: {{Facilitator_Name}} · Team: Engineering" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "🚀 What Went Exceptionally Well" }] },
      { type: "paragraph", content: [{ type: "text", text: "• High velocity on core feature deliverables\n• Smooth code reviews and zero build regressions\n• Positive stakeholder feedback on UI polish" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "⚠️ Areas for Improvement" }] },
      { type: "paragraph", content: [{ type: "text", text: "• Improve automated test coverage for edge-case layout configurations\n• Streamline documentation updates alongside pull requests" }] },
    ],
  },
  {
    id: "tech-spec",
    title: "Technical Architecture RFC",
    category: "Technical",
    desc: "Detailed software design specification, data schemas and API endpoints",
    preview: "TECHNICAL DESIGN SPECIFICATION (RFC)\n\nSystem context, component architecture, storage schema, security considerations...",
    nodes: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "RFC: Architectural Modernization" }] },
      { type: "paragraph", content: [{ type: "text", text: "Author: {{Author_Name}} · Status: In Review · Last Updated: {{Updated_Date}}" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Architecture Overview" }] },
      { type: "paragraph", content: [{ type: "text", text: "The system decouples client-rendered paginated rich text from persistence layers using transactional state sync." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "2. Data Model & Storage" }] },
      { type: "paragraph", content: [{ type: "text", text: "ProseMirror JSON nodes are validated against custom extension schemas and stored with monotonic revision counters." }] },
    ],
  },
];

export function TemplateHub({ editor, close, notify }: TemplateHubProps) {
  const [selectedCat, setSelectedCat] = useState("All");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCard>(TEMPLATES_CATALOG[0]);

  const categories = ["All", "Business", "Legal", "Productivity", "Technical"];

  const filtered = useMemo(() => {
    if (selectedCat === "All") return TEMPLATES_CATALOG;
    return TEMPLATES_CATALOG.filter((t) => t.category === selectedCat);
  }, [selectedCat]);

  const handleApplyTemplate = () => {
    editor.commands.setContent({
      type: "doc",
      content: selectedTemplate.nodes,
    });
    notify(`Loaded “${selectedTemplate.title}” template!`);
    close();
  };

  return (
    <div className="template-hub-dialog" style={{ width: "100%", maxWidth: "780px", color: "#1f3328" }}>
      {/* Category Pills */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCat(cat)}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              border: "1px solid",
              borderColor: selectedCat === cat ? "#246c53" : "#cad7ce",
              background: selectedCat === cat ? "#246c53" : "white",
              color: selectedCat === cat ? "white" : "#3b5447",
              borderRadius: "16px",
              cursor: "pointer",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Two-Column View */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: "18px",
          height: "360px",
          border: "1px solid #d4ded8",
          borderRadius: "6px",
          overflow: "hidden",
          background: "white",
        }}
      >
        {/* Left Template List */}
        <div style={{ borderRight: "1px solid #d4ded8", overflowY: "auto", background: "#f7f9f8", padding: "8px" }}>
          {filtered.map((t) => {
            const isCur = selectedTemplate.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplate(t)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  marginBottom: "4px",
                  borderRadius: "4px",
                  border: isCur ? "1px solid #246c53" : "1px solid transparent",
                  background: isCur ? "#e2efe9" : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "13px", color: isCur ? "#154233" : "#243c31" }}>
                  {t.title}
                </div>
                <div style={{ fontSize: "11px", color: "#61776c", marginTop: "2px" }}>
                  {t.category}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Preview Card */}
        <div style={{ padding: "18px 22px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#246c53", textTransform: "uppercase" }}>
            {selectedTemplate.category} Template
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "6px 0 10px 0", color: "#163124" }}>
            {selectedTemplate.title}
          </h3>
          <p style={{ fontSize: "13px", color: "#546a5d", margin: "0 0 14px 0" }}>
            {selectedTemplate.desc}
          </p>

          <div
            style={{
              flex: 1,
              background: "#fafcfb",
              border: "1px solid #d4ded8",
              borderRadius: "4px",
              padding: "12px",
              fontFamily: "monospace",
              fontSize: "12px",
              whiteSpace: "pre-line",
              color: "#384f43",
              overflowY: "auto",
            }}
          >
            {selectedTemplate.preview}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", borderTop: "1px solid #d4ded8", paddingTop: "12px" }}>
        <span style={{ fontSize: "12px", color: "#62796e" }}>
          Loading a template will replace the open document's content.
        </span>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={close}
            style={{ padding: "7px 16px", border: "1px solid #bbc8c0", background: "white", borderRadius: "4px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyTemplate}
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
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}

