# Titan

Titan is an AkashaVyom Labs word processor built with React and Tiptap with a FastAPI document service. The first visit opens an editable project proposal. Choose **Documents** in the title bar to open the library, create a blank document, or start from one of ten templates.

## Run locally

Use Node.js 24 and Python 3.12. From this directory on Windows, run the following in PowerShell.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock
npm.cmd ci
npm.cmd run dev:full
```

Open [the local editor](http://127.0.0.1:5173). The launcher starts the frontend, API and a loopback MongoDB instance. The MongoDB binary downloads on first setup and development data persists in `.local/mongodb`. The launcher accepts an existing `MONGODB_URI` instead. On macOS or Linux, use `.venv/bin/python` and `npm`.

For frontend-only use, run `npm run dev`. Documents created before signing in autosave in IndexedDB in the current browser profile. Signing in from an open local document copies it into the account. Local and account copies then have independent revision histories.

For separate services, configure the environment shown in [.env.example](.env.example), start `uvicorn backend.main:app --host 127.0.0.1 --port 8000` using the virtual environment, then start Vite. Vite forwards HTTP and WebSocket requests under `/api`. Set `API_TARGET` to override the backend address. For direct PDF export, Windows can use an existing Edge installation. Elsewhere, install the rendering browser with `python -m playwright install --with-deps chromium` or set `PDF_BROWSER_EXECUTABLE`.

## Working with documents

- **Edit and navigate.** Select text, use the Home ribbon, or move between headings in Navigation. Layout changes page dimensions, orientation, margins and background. View controls the ruler, zoom, formatting marks and full screen.
- **Save and recover.** A pause in typing triggers a save. Local saves commit the document and its prior revision in one IndexedDB transaction. Account saves compare revisions in MongoDB. A stale tab offers **Save a copy**. Reopening a tab with an interrupted draft offers recovery.
- **Import and export.** File → Import file inserts DOCX, HTML or TXT at the selection. The backend produces DOCX and signed-in PDF exports. HTML, TXT and browser printing run entirely in the browser.
- **Review.** Select a passage and open Comments. Review includes find and replace, statistics, revision comparison and restore. Restoring creates a new save.
- **Collaborate.** Open an account document, choose Share, then Enable live editing. Grant access to another registered email address and send the document link. The recipient signs in using the account that received access. Shared documents use Yjs updates, server acknowledgements, live carets and comments anchored to relative positions. Owners can change or revoke permissions.
- **Manage.** The library provides search, sort, favorites, folders, grid/list views, trash and restore. File → Save as creates a second document.

## Deployment

1. Create a MongoDB Atlas database and a database user scoped to the application database. Set `MONGODB_URI` and `MONGODB_DATABASE` as backend environment variables. Configure Atlas network access for the backend host.
2. Deploy this repository as a Python web service. Use `pip install -r backend/requirements.txt` for the build and `uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1 --ws-max-size 5000000` to start. Use a Chromium-capable image or install Chromium and its OS dependencies for PDF export. The collaboration broadcaster currently operates in one worker. [Render FastAPI deployment](https://render.com/docs/deploy-fastapi) · [WebSocket hosting](https://render.com/docs/websocket)
3. Create a Cloudflare Pages project. Set Node.js to 24, build with `npm run build`, and publish `dist`. Set `MONGOMS_DISABLE_POSTINSTALL=1` in hosted build environments that use Atlas. Set the Pages runtime binding `API_ORIGIN` to the backend HTTPS origin. The included Pages Worker proxies API requests and WebSocket upgrades on the frontend origin. [Cloudflare Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)
4. On the backend, set `COOKIE_SECURE=1` and `APP_ORIGINS` to the exact frontend HTTPS origin. Use separate credentials and databases for development and deployment. Verify sign-in, two-account edits after reload, revocation and both export formats on the deployed URLs.
5. A free Render instance can spin down during inactivity. Confirm capacity and service requirements before storing production documents. [Render free instance behavior](https://render.com/docs/free)

## API and storage

FastAPI serves interactive documentation at [/docs](http://127.0.0.1:8000/docs) and the OpenAPI schema at [/openapi.json](http://127.0.0.1:8000/openapi.json). State-changing HTTP requests carry `X-Workspace: editor`. Authenticated clients use an expiring HTTP-only cookie. Browser writes and WebSocket upgrades are checked against the configured frontend origins.

| Resource | Operations |
| --- | --- |
| `/api/auth/register`, `/api/auth/login`, `/api/me`, `/api/session` | Create an account, sign in, inspect identity, sign out |
| `/api/documents`, `/api/documents/{id}` | List accessible documents, create, retrieve, rename, save, move, trash and restore |
| `/api/documents/{id}/versions` | Retrieve previous private saves |
| `/api/folders`, `/api/templates` | List or create folders and retrieve editable built-in templates |
| `/api/documents/{id}/live`, `/access`, `/access/{email}` under the document | Enable a CRDT session, manage permissions, revoke access |
| `/api/documents/{id}/comments` | Create and list shared range comments, resolve by ID |
| `/api/live/{id}` | Authenticated binary WebSocket for initial state, deltas, acknowledgements and awareness |
| `/api/export/docx`, `/api/export/pdf` | Render a supported structured document |

MongoDB stores users, expiring sessions, documents, folders, permissions, revisions, comments, collaboration sessions, templates and audit logs. Private document content is ProseMirror JSON. For a live document, the committed Yjs binary becomes authoritative. Each accepted delta merges into that state before acknowledgement. Presence is ephemeral.

## Tests

```powershell
npm.cmd test
npm.cmd run build
.\.venv\Scripts\python.exe -m pytest -q backend
$env:FULL_STACK_URL = 'http://127.0.0.1:5173'
npm.cmd run test:e2e -- --workers=1
```

The browser suite uses Edge and creates isolated browser profiles. Run the complete stack for the full suite. Tests create uniquely named test accounts and documents, so use a development database. The API suite uses an isolated MongoDB-compatible fixture and checks generated files with a Word parser and a Chromium PDF render.

See [the feature and verification report](FEATURES.md) for coverage and remaining limitations.

