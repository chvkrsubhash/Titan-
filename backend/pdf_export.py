"""Render escaped structured content in an isolated, network-disabled print context."""

import os
import re
from html import escape
from pathlib import Path
from threading import BoundedSemaphore
from fastapi import HTTPException
from playwright.sync_api import sync_playwright

slots = BoundedSemaphore(2)


def dimension(value, default):
    return (
        str(value)
        if re.fullmatch(r"(?:\d{1,3})(?:\.\d+)?(?:mm|in)", str(value))
        else default
    )


def html_document(content):
    headings = []

    def render(n, depth=0):
        if depth > 60:
            raise ValueError("Document exceeds the supported nesting depth")
        kind = n.get("type", "")
        attrs = n.get("attrs") or {}
        children = "".join(render(child, depth + 1) for child in n.get("content", []))
        if kind == "text":
            text = escape(n.get("text", ""))
            for m in n.get("marks", []):
                tag = {
                    "bold": "strong",
                    "italic": "em",
                    "underline": "u",
                    "strike": "s",
                    "subscript": "sub",
                    "superscript": "sup",
                    "highlight": "mark",
                }.get(m["type"])
                if tag:
                    text = f"<{tag}>{text}</{tag}>"
                a = m.get("attrs") or {}
                if m["type"] == "textStyle":
                    style = []
                    if re.fullmatch(r"[\w ,'-]{1,80}", str(a.get("fontFamily") or "")):
                        style.append("font-family:" + a["fontFamily"])
                    if re.fullmatch(r"\d{1,3}(\.\d+)?pt", str(a.get("fontSize") or "")):
                        style.append("font-size:" + a["fontSize"])
                    if re.fullmatch(r"#[\da-fA-F]{6}", str(a.get("color") or "")):
                        style.append("color:" + a["color"])
                    text = (
                        '<span style="'
                        + escape(";".join(style), quote=True)
                        + '">'
                        + text
                        + "</span>"
                    )
            return text
        if kind == "image":
            src = str(attrs.get("src", ""))
            if re.fullmatch(r"data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+", src):
                width = min(1000, max(1, int(attrs.get("width") or 400)))
                return f'<img width="{width}" src="{src}">'
            return ""
        if kind == "manualBreak":
            return '<div style="break-after:page"></div>'
        if kind == "horizontalRule":
            return "<hr>"
        if kind == "hardBreak":
            return "<br>"
        if kind == "mathBlock":
            return "<p>" + escape(str(attrs.get("latex", ""))) + "</p>"
        if kind == "heading":
            level = max(1, min(6, int(attrs.get("level", 1))))
            headings.append(children)
            return f"<h{level}>{children}</h{level}>"
        if kind == "contentsList":
            return "<!--contents-->"
        tag = {
            "paragraph": "p",
            "bulletList": "ul",
            "orderedList": "ol",
            "listItem": "li",
            "table": "table",
            "tableRow": "tr",
            "tableHeader": "th",
            "tableCell": "td",
            "textBox": "aside",
            "blockquote": "blockquote",
        }.get(kind)
        if not tag:
            return children
        align = attrs.get("textAlign")
        attr = (
            f' style="text-align:{align}"'
            if align in ("left", "right", "center", "justify")
            else ""
        )
        if tag in ("th", "td"):
            for key in ("rowspan", "colspan"):
                attr += (
                    " "
                    + key
                    + '="'
                    + str(min(100, max(1, int(attrs.get(key) or 1))))
                    + '"'
                )
        return f"<{tag}{attr}>{children}</{tag}>"

    body = render(content)
    return (
        '<!doctype html><meta charset="utf-8"><style>body{font:12pt/1.5 Arial,sans-serif;color:#303d35}h1,h2,h3{font-family:Georgia,serif;color:#244e40;break-after:avoid}h1{font-size:32pt}p{margin:0 0 9pt;white-space:pre-wrap}table{width:100%;border-collapse:collapse}td,th,aside{border:1px solid #acbcb1;padding:5px}tr{break-inside:avoid}img{max-width:100%}</style>'
        + body.replace(
            "<!--contents-->",
            "<nav><b>Contents</b><ol>"
            + "".join("<li>" + h + "</li>" for h in headings)
            + "</ol></nav>",
        )
    )


def pdf_bytes(data):
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "PDF renderer busy. Retry shortly.")
    try:
        html = html_document(data.content)
        settings = data.settings
        theme = []
        if settings.get("headingFont") in {"Georgia", "Arial", "Verdana", "Times New Roman"}:
            theme.append("h1,h2,h3,h4{font-family:" + settings["headingFont"] + "}")
        if re.fullmatch(r"#[0-9a-fA-F]{6}", str(settings.get("accent", ""))):
            theme.append("h1,h2,h3,h4{color:" + settings["accent"] + "}")
        if settings.get("spacing") in {"0pt", "6pt", "10pt", "14pt"}:
            theme.append("p{margin-bottom:" + settings["spacing"] + "}")
        html = html.replace("</style>", "".join(theme) + "</style>", 1)
        margin = dimension(settings.get("margin"), "22mm")
        with sync_playwright() as runtime:
            edge = (
                Path(os.environ.get("ProgramFiles(x86)", ""))
                / "Microsoft/Edge/Application/msedge.exe"
            )
            path = os.environ.get("PDF_BROWSER_EXECUTABLE") or (
                str(edge) if edge.is_file() else None
            )
            browser = runtime.chromium.launch(executable_path=path)
            try:
                context = browser.new_context(java_script_enabled=False, offline=True)
                page = context.new_page()
                page.route("http**/*", lambda route: route.abort())
                page.set_content(html, timeout=15000)
                head = escape(str(settings.get("header", "")))
                foot = escape(str(settings.get("footer", "")))
                page_num = (
                    '<span class="pageNumber"></span>'
                    if settings.get("pageNumbers", True)
                    else ""
                )
                return page.pdf(
                    width=dimension(settings.get("width"), "210mm"),
                    height=dimension(settings.get("height"), "297mm"),
                    margin=dict.fromkeys(("top", "right", "bottom", "left"), margin),
                    print_background=True,
                    display_header_footer=True,
                    header_template=f'<div style="font:9px Arial;margin:auto">{head}</div>',
                    footer_template=f'<div style="font:9px Arial;margin:auto">{foot} {page_num}</div>',
                )
            finally:
                browser.close()
    finally:
        slots.release()
