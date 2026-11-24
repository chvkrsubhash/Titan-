from io import BytesIO
import base64
import re
from docx import Document
from docx.shared import Mm, Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT


def length(value, fallback):
    match = re.fullmatch(r"(\d+(?:\.\d+)?)(mm|in)", str(value))
    return (
        (Mm if match and match[2] == "mm" else Inches)(float(match[1]))
        if match
        else Mm(fallback)
    )


def build_docx(data):
    result = Document()
    result.core_properties.title = data.title
    settings = data.settings
    section = result.sections[0]
    section.page_width = length(settings.get("width"), 210)
    section.page_height = length(settings.get("height"), 297)
    margin = length(settings.get("margin"), 22)
    section.top_margin = section.bottom_margin = section.left_margin = (
        section.right_margin
    ) = margin
    section.header.paragraphs[0].text = str(settings.get("header", ""))
    footer = section.footer.paragraphs[0]
    footer.add_run(str(settings.get("footer", "")))
    if settings.get("pageNumbers", True):
        field = OxmlElement("w:fldSimple")
        field.set(qn("w:instr"), "PAGE")
        footer._p.append(field)

    def inline(p, node):
        if node.get("type") == "hardBreak":
            p.add_run().add_break()
            return
        if node.get("type") == "text":
            run = p.add_run(node.get("text", ""))
            link = None
            for mark in node.get("marks", []):
                kind = mark["type"]
                if kind in {"bold", "italic", "underline"}:
                    setattr(run, kind, True)
                if kind in {"strike", "superscript", "subscript"}:
                    setattr(run.font, kind, True)
                attrs = mark.get("attrs", {})
                if kind == "link":
                    href = str(attrs.get("href", ""))
                    if href.startswith(("https://", "http://", "mailto:", "#")):
                        link = href
                if kind == "highlight":
                    color = attrs.get("color", "#fff191").lstrip("#")
                    if re.fullmatch(r"[\da-fA-F]{6}", color):
                        shade = OxmlElement("w:shd")
                        shade.set(qn("w:fill"), color)
                        run._r.get_or_add_rPr().append(shade)
                if kind == "textStyle":
                    if attrs.get("fontFamily"):
                        run.font.name = attrs["fontFamily"]
                    size = str(attrs.get("fontSize", ""))
                    if re.fullmatch(r"\d+(?:\.\d+)?pt", size):
                        run.font.size = Pt(min(300, float(size[:-2])))
                    color = str(attrs.get("color", "")).lstrip("#")
                    if re.fullmatch(r"[\da-fA-F]{6}", color):
                        run.font.color.rgb = RGBColor.from_string(color)
            if link:
                element = OxmlElement("w:hyperlink")
                if link.startswith("#"):
                    element.set(qn("w:anchor"), link[1:])
                else:
                    element.set(
                        qn("r:id"),
                        p.part.relate_to(link, RT.HYPERLINK, is_external=True),
                    )
                run.font.underline = True
                element.append(run._r)
                p._p.append(element)
        elif node.get("type") == "bookmark":
            idx = str(len(p.part.element.xpath(".//w:bookmarkStart")) + 1)
            start = OxmlElement("w:bookmarkStart")
            start.set(qn("w:id"), idx)
            start.set(qn("w:name"), str(node.get("attrs", {}).get("id", "")))
            end = OxmlElement("w:bookmarkEnd")
            end.set(qn("w:id"), idx)
            p._p.append(start)
            p._p.append(end)
        else:
            for child in node.get("content", []):
                inline(p, child)

    def block(node, parent, style=None):
        kind = node.get("type")
        content = node.get("content", [])
        attrs = node.get("attrs", {})
        if kind in {"paragraph", "heading", "mathBlock"}:
            p = parent.add_paragraph(
                style=("Heading " + str(min(9, max(1, int(attrs.get("level", 1))))))
                if kind == "heading"
                else style
            )
            align = attrs.get("textAlign")
            if align in {"left", "right", "center", "justify"}:
                p.alignment = getattr(WD_ALIGN_PARAGRAPH, align.upper())
            for key, property in (
                ("marginLeft", "left_indent"),
                ("marginRight", "right_indent"),
                ("marginTop", "space_before"),
                ("marginBottom", "space_after"),
            ):
                value = str(attrs.get(key, ""))
                if re.fullmatch(r"\d+(\.\d+)?(pt|px)", value):
                    setattr(
                        p.paragraph_format,
                        property,
                        Pt(float(value[:-2]) * (0.75 if value.endswith("px") else 1)),
                    )
            if kind == "mathBlock":
                p.add_run(str(attrs.get("latex", "")))
            for child in content:
                inline(p, child)
        elif kind in {"bulletList", "orderedList"}:
            for item in content:
                for child in item.get("content", []):
                    block(
                        child,
                        parent,
                        "List Bullet" if kind == "bulletList" else "List Number",
                    )
        elif kind == "table" and content:
            cols = max(
                sum(
                    int(cell.get("attrs", {}).get("colspan", 1))
                    for cell in row.get("content", [])
                )
                for row in content
            )
            if not 1 <= cols <= 100 or cols * len(content) > 10000:
                raise ValueError("Table exceeds the export limit")
            table = parent.add_table(rows=len(content), cols=cols)
            table.style = "Table Grid"
            for row_index, row in enumerate(content):
                col = 0
                for cell in row.get("content", []):
                    span = max(1, int(cell.get("attrs", {}).get("colspan", 1)))
                    target = table.cell(row_index, col)
                    if span > 1:
                        target = target.merge(table.cell(row_index, col + span - 1))
                    for child in cell.get("content", []):
                        block(child, target)
                    if len(target.paragraphs) > 1 and not target.paragraphs[0].text:
                        empty = target.paragraphs[0]._p
                        empty.getparent().remove(empty)
                    col += span
        elif kind == "contentsList":
            parent.add_paragraph("Contents", style="Heading 2")
            for heading in data.content.get("content", []):
                if heading.get("type") == "heading":
                    paragraph = parent.add_paragraph()
                    for child in heading.get("content", []):
                        inline(paragraph, child)
        elif kind == "manualBreak":
            parent.add_paragraph().add_run().add_break(7)
        elif kind == "image":
            src = attrs.get("src", "")
            if isinstance(src, str) and re.match(
                r"^data:image/(png|jpeg);base64,", src
            ):
                raw = base64.b64decode(src.partition(",")[2], validate=True)
                parent.add_paragraph().add_run().add_picture(
                    BytesIO(raw),
                    width=Inches(min(6, float(attrs.get("width") or 360) / 96)),
                )
        else:
            for child in content:
                block(child, parent, "Quote" if kind == "blockquote" else style)

    for node in data.content.get("content", []):
        block(node, result)
    out = BytesIO()
    result.save(out)
    return out.getvalue()
