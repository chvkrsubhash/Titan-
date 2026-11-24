import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";

const paragraphProperties = {
  marginLeft: "margin-left",
  marginRight: "margin-right",
  marginTop: "margin-top",
  marginBottom: "margin-bottom",
  backgroundColor: "background-color",
  borderBottom: "border-bottom",
};
const ParagraphLayout = Extension.create({
  name: "paragraphLayout",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: Object.fromEntries(
          Object.entries(paragraphProperties).map(([name, css]) => [
            name,
            {
              default: null,
              parseHTML: (el: HTMLElement) =>
                el.style.getPropertyValue(css) || null,
              renderHTML: (attrs: Record<string, string>) =>
                attrs[name] ? { style: css + ":" + attrs[name] } : {},
            },
          ]),
        ),
      },
    ];
  },
});
export const extensions = [
  StarterKit.configure({ link: { openOnClick: false } }),
  TextStyleKit,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight.configure({ multicolor: true }),
  Subscript,
  Superscript,
  ParagraphLayout,
];
