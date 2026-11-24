# Feature and verification report

| Area | Delivered | Limits |
| --- | --- | --- |
| Editing | Eight ribbon tabs, rich text, reusable text styles, selection-aware controls, nested lists, tables, images, equations and keyboard shortcuts | Clipboard permissions depend on the browser. |
| Layout | Continuous ProseMirror selection across paginated pages, page dimensions, margins, headers, footers, ruler and zoom | Page settings apply to the document as a whole. Mixed-orientation sections and page-bottom footnotes remain open. |
| Files | DOCX, HTML and TXT import, DOCX, PDF, HTML and TXT export, print stylesheet | Word conversions cover supported elements. Equations export as source text. Complex tables, text wrapping and printer pagination can differ from the editor. |
| References and review | Heading navigation, generated contents, bookmarks, cross-references, endnotes, text citations, comments, revision comparison and restore | Citation styles and bibliography management are limited. Revision comparison highlights paragraph text. Suggestions record ProseMirror steps and require the original base to accept them. |
| Storage | IndexedDB for guest documents, MongoDB for accounts, autosave, conflict detection, recoverable drafts, templates and trash | Local history retains 20 prior revisions. Browser profile deletion removes local documents. |
| Sharing | Account-based roles, permission revocation, document links, Yjs synchronization, live carets and relative-position comments | Granting access requires an existing account. Invitation email delivery is outstanding. Live editing has a smaller ribbon and uses one FastAPI worker. Private revision restore and suggestion workflows belong to the private editor. |
| Hosting | Local launcher, environment example, Cloudflare Pages proxy and Python hosting instructions | Public hosting, Atlas integration, multi-worker broadcasts and production load testing remain unverified. |

The unit suite covers formatting, undo/redo, long documents and conditional storage writes. API tests exercise authentication, request origins, ownership, versions, collaboration permissions, DOCX parsing and two-page PDF rendering. Edge tests exercise real browser selections, imports, images, pagination, concurrent edits, reload and conflict recovery. See README.md for reproduction commands.
