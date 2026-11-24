import { Mark, Node, mergeAttributes, Extension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TableKitPlus } from "tiptap-table-plus";
import { PaginationPlus } from "tiptap-pagination-plus";
import katex from "katex";
import "katex/dist/katex.min.css";
export const richExtensions = [
  Extension.create({name:"dropCap",addGlobalAttributes(){return [{types:["paragraph","heading"],attributes:{dropCap:{default:false,parseHTML:el=>el.hasAttribute("data-drop-cap"),renderHTML:a=>a.dropCap?{"data-drop-cap":"true"}:{}}}}]}}),
  Node.create({
    name: "mathBlock",
    group: "block",
    atom: true,
    addAttributes() {
      return { latex: { default: "" } };
    },
    parseHTML() {
      return [
        {
          tag: "div[data-equation]",
          getAttrs: (el) => ({ latex: (el as HTMLElement).dataset.equation }),
        },
      ];
    },
    renderHTML({ node }) {
      return ["div", { "data-equation": node.attrs.latex }, node.attrs.latex];
    },
    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement("div");
        katex.render(node.attrs.latex, dom, {
          throwOnError: false,
          trust: false,
        });
        return { dom };
      };
    },
  }),
  TableKitPlus.configure({
    table: { resizable: true, allowTableNodeSelection: true },
  }),
  Image.configure({ allowBase64: true }),
  Extension.create({
    name: "extraLayout",
    addGlobalAttributes() {
      return [
        {
          types: ["tableCell", "tableHeader", "image"],
          attributes: {
            backgroundColor: {
              default: null,
              parseHTML: (el) => el.style.backgroundColor,
              renderHTML: (a) =>
                a.backgroundColor
                  ? { style: "background-color:" + a.backgroundColor }
                  : {},
            },
            float: {
              default: null,
              parseHTML: (el) => el.style.float,
              renderHTML: (a) => (a.float ? { style: "float:" + a.float } : {}),
            },
            borderStyle: {
              default: null,
              parseHTML: (el) => el.style.borderStyle,
              renderHTML: (a) =>
                a.borderStyle ? { style: "border-style:" + a.borderStyle } : {},
            },
          },
        },
      ];
    },
  }),
  Mark.create({
    name: "commentAnchor",
    inclusive: false,
    addAttributes() {
      return {
        thread: { default: null, parseHTML: (el) => el.dataset.thread },
      };
    },
    parseHTML() {
      return [{ tag: "span[data-thread]" }];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        "span",
        { "data-thread": HTMLAttributes.thread, class: "commentAnchor" },
        0,
      ];
    },
  }),
  Node.create({
    name: "bookmark",
    group: "inline",
    inline: true,
    atom: true,
    addAttributes() {
      return { id: { default: null } };
    },
    parseHTML() {
      return [{ tag: "span[data-bookmark]" }];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          "data-bookmark": "",
          class: "bookmark",
        }),
      ];
    },
  }),
  Node.create({
    name: "contentsList",
    group: "block",
    atom: true,
    parseHTML() {
      return [{ tag: "nav[data-contents]" }];
    },
    renderHTML() {
      return ["nav", { "data-contents": "" }, "Contents"];
    },
    addNodeView() {
      return ({ editor }) => {
        const dom = document.createElement("nav");
        dom.dataset.contents = "";
        dom.contentEditable = "false";
        let last = "";
        const render = () => {
          const headings: { label: string; pos: number; level: number }[] = [];
          editor.state.doc.descendants((n, p) => {
            if (n.type.name === "heading")
              headings.push({
                label: n.textContent,
                pos: p,
                level: n.attrs.level,
              });
          });
          const key = JSON.stringify(headings);
          if (key === last) return;
          last = key;
          dom.replaceChildren();
          const title = document.createElement("b");
          title.textContent = "Contents";
          dom.append(title);
          for (const h of headings) {
            const link = document.createElement("button");
            link.textContent = h.label;
            link.style.paddingLeft = (h.level - 1) * 12 + "px";
            link.onclick = () =>
              editor
                .chain()
                .focus()
                .setTextSelection(h.pos + 1)
                .scrollIntoView()
                .run();
            dom.append(link);
          }
        };
        render();
        editor.on("update", render);
        return {
          dom,
          ignoreMutation: () => true,
          destroy: () => {
            editor.off("update", render);
          },
        };
      };
    },
  }),
  Node.create({
    name: "manualBreak",
    group: "block",
    atom: true,
    parseHTML() {
      return [{ tag: "div[data-page-break]" }];
    },
    renderHTML() {
      return ["div", { "data-page-break": "", class: "manualbreak" }];
    },
  }),
  Node.create({
    name: "textBox",
    group: "block",
    content: "paragraph+",
    defining: true,
    parseHTML() {
      return [{ tag: "aside[data-text-box]" }];
    },
    renderHTML() {
      return ["aside", { "data-text-box": "" }, 0];
    },
  }),
  PaginationPlus.configure({
    pageHeight: 1122.52,
    pageWidth: 793.7,
    marginTop: 55,
    marginBottom: 48,
    marginLeft: 83,
    marginRight: 83,
    contentMarginTop: 22,
    contentMarginBottom: 22,
    pageGap: 20,
    pageBreakBackground: "#e9ede9",
    footerRight: "{page}",
    headerLeft: "",
  }),
];
export function px(s: string) {
  return (
    parseFloat(s) * (s.endsWith("mm") ? 96 / 25.4 : s.endsWith("in") ? 96 : 1)
  );
}
export function escapeText(s: string) {
  const span = document.createElement("span");
  span.textContent = s;
  return span.innerHTML;
}

