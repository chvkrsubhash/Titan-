import hashlib
import hmac
import json
import os
import secrets
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from backend.limits import BodyLimit
from pydantic import BaseModel, Field, field_validator
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

app = FastAPI(title="Titan Documents", version="0.1.0")
origins = os.getenv("APP_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(
    ","
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Workspace"],
)
app.add_middleware(BodyLimit)
client = None
attempts = defaultdict(deque)
lock = Lock()


def db():
    global client
    if client is None:
        client = MongoClient(
            os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017"),
            serverSelectionTimeoutMS=5000,
            tz_aware=True,
        )
    return client[os.getenv("MONGODB_DATABASE", "akasha_docs")]


@app.middleware("http")
async def protect(request: Request, call_next):
    from fastapi.responses import JSONResponse

    if request.method in {"POST", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if request.headers.get("x-workspace") != "editor" or (
            origin and origin not in origins
        ):
            return JSONResponse({"detail": "Request origin rejected"}, status_code=403)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(PyMongoError)
async def database_failure(request, error):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        {"detail": "Database unavailable. Retry in a moment."}, status_code=503
    )


def now():
    return datetime.now(timezone.utc)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def user(session: str | None = Cookie(None), database=Depends(db)):
    if not session:
        raise HTTPException(401, "Sign in to continue")
    record = database.sessions.find_one(
        {"_id": digest(session or ""), "expires": {"$gt": now()}}
    )
    if not record:
        raise HTTPException(401, "Sign in to continue")
    return record["user"]


class Credentials(BaseModel):
    email: str = Field(
        min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    )
    password: str = Field(min_length=10, max_length=256)


def throttle(request):
    key = request.client.host if request.client else "local"
    with lock:
        bucket = attempts[key]
        while bucket and bucket[0] < monotonic() - 300:
            bucket.popleft()
        if len(bucket) >= 20:
            raise HTTPException(429, "Try again in five minutes")
        bucket.append(monotonic())


def password_hash(password, salt):
    return hashlib.scrypt(
        password.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=64 * 1024 * 1024
    ).hex()


@app.post("/api/auth/{action}")
def authenticate(
    action: str,
    body: Credentials,
    request: Request,
    response: Response,
    database=Depends(db),
):
    throttle(request)
    email = body.email.strip().lower()
    if action == "register":
        salt = secrets.token_bytes(16)
        try:
            database.users.insert_one(
                {
                    "_id": email,
                    "salt": salt.hex(),
                    "hash": password_hash(body.password, salt),
                }
            )
        except DuplicateKeyError:
            raise HTTPException(409, "Email already registered")
    elif action == "login":
        row = database.users.find_one({"_id": email})
        candidate = password_hash(
            body.password, bytes.fromhex(row["salt"]) if row else bytes(16)
        )
        if not row or not hmac.compare_digest(candidate, row["hash"]):
            raise HTTPException(401, "Incorrect email or password")
    else:
        raise HTTPException(404)
    token = secrets.token_urlsafe(32)
    database.sessions.create_index("expires", expireAfterSeconds=0)
    database.sessions.insert_one(
        {"_id": digest(token), "user": email, "expires": now() + timedelta(days=7)}
    )
    response.set_cookie(
        "session",
        token,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "1") == "1",
        samesite="lax",
        max_age=604800,
        path="/api",
    )
    return {"email": email}


@app.get("/api/me")
def me(email=Depends(user)):
    return {"email": email}


@app.delete("/api/session")
def logout(
    response: Response, session: str | None = Cookie(None), database=Depends(db)
):
    database.sessions.delete_one({"_id": digest(session or "")})
    response.delete_cookie("session", path="/api")
    return {"ok": True}


class Document(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9-]{1,64}$")
    title: str = Field(min_length=1, max_length=180)
    content: dict
    revision: int = Field(ge=0)
    favorite: bool = False
    deleted: bool = False
    folder: str = Field(default="", max_length=120)
    settings: dict = Field(default_factory=dict)

    @field_validator("content")
    @classmethod
    def valid_tree(cls, value):
        nodes = [(value, 0)]
        count = 0
        while nodes:
            node, level = nodes.pop()
            count += 1
            if (
                level > 60
                or count > 80000
                or not isinstance(node, dict)
                or not isinstance(node.get("type"), str)
            ):
                raise ValueError("Document exceeds the supported structure")
            if node["type"] == "text" and not isinstance(node.get("text"), str):
                raise ValueError("Invalid text")
            children = node.get("content", [])
            if not isinstance(children, list) or not isinstance(
                node.get("attrs", {}), dict
            ):
                raise ValueError("Invalid node")
            marks = node.get("marks", [])
            if not isinstance(marks, list) or any(
                not isinstance(m, dict) or not isinstance(m.get("type"), str)
                for m in marks
            ):
                raise ValueError("Invalid marks")
            nodes.extend((child, level + 1) for child in children)
        return value


def validated(body):
    data = body.model_dump()
    if data["content"].get("type") != "doc" or not isinstance(
        data["content"].get("content"), list
    ):
        raise HTTPException(422, "Expected a structured editor document")
    if len(json.dumps(data).encode()) > 4_500_000:
        raise HTTPException(413, "Document too large")
    data["updated"] = now().isoformat()
    return data


@app.get("/api/documents")
def documents(email=Depends(user), database=Depends(db)):
    grants = {
        p["doc"]: p["role"]
        for p in database.document_permissions.find({"email": email})
    }
    rows = list(
        database.documents.find(
            {
                "$or": [
                    {"owner": email},
                    {"_id": {"$in": list(grants)}, "live": True, "deleted": False},
                ]
            },
            {"_id": 0, "crdt": 0},
        ).sort("updated", -1)
    )
    for row in rows:
        row["role"] = "owner" if row["owner"] == email else grants[row["id"]]
    return rows


@app.post("/api/documents", status_code=201)
def create(body: Document, email=Depends(user), database=Depends(db)):
    data = validated(body)
    data.update(owner=email, created=data["updated"], revision=1)
    try:
        database.documents.insert_one({"_id": body.id, **data})
    except DuplicateKeyError:
        raise HTTPException(409, "Document already exists")
    database.audit_logs.insert_one(
        {"user": email, "doc": body.id, "action": "create", "at": now()}
    )
    return data


@app.patch("/api/documents/{doc_id}")
def save(doc_id: str, body: Document, email=Depends(user), database=Depends(db)):
    if doc_id != body.id:
        raise HTTPException(422, "Document ID mismatch")
    old = database.documents.find_one({"_id": doc_id, "owner": email})
    if not old:
        raise HTTPException(404, "Document missing")
    if old.get("live"):
        if (
            body.deleted != old["deleted"]
            or body.favorite != old["favorite"]
            or body.folder != old["folder"]
            or body.title != old["title"]
        ):
            fields = {
                key: getattr(body, key)
                for key in ("deleted", "favorite", "folder", "title")
            }
            row = database.documents.find_one_and_update(
                {"_id": doc_id, "owner": email, "revision": body.revision},
                {"$set": fields, "$inc": {"revision": 1}},
                return_document=ReturnDocument.AFTER,
                projection={"crdt": 0, "_id": 0},
            )
            if row:
                return row
        raise HTTPException(409, "Open the live workspace for shared edits")
    if old["revision"] != body.revision:
        raise HTTPException(409, "A newer revision exists")
    # Archive before the conditional write. Concurrent writers archive the same prior state.
    database.document_revisions.update_one(
        {"_id": f"{doc_id}:{body.revision}"},
        {
            "$setOnInsert": {
                "doc_id": doc_id,
                "snapshot": {k: v for k, v in old.items() if k != "_id"},
            }
        },
        upsert=True,
    )
    data = validated(body)
    if body.folder:
        database.folders.update_one(
            {"owner": email, "name": body.folder},
            {"$setOnInsert": {"created": now()}},
            upsert=True,
        )
    data["revision"] += 1
    result = database.documents.find_one_and_update(
        {
            "_id": doc_id,
            "owner": email,
            "revision": body.revision,
            "live": {"$ne": True},
        },
        {"$set": data},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(409, "A newer revision exists")
    result.pop("_id")
    database.audit_logs.insert_one(
        {
            "user": email,
            "doc": doc_id,
            "action": "save",
            "revision": result["revision"],
            "at": now(),
        }
    )
    return result


@app.get("/api/documents/{doc_id}/versions")
def versions(doc_id: str, email=Depends(user), database=Depends(db)):
    if not database.documents.find_one({"_id": doc_id, "owner": email}):
        raise HTTPException(404)
    return [
        r["snapshot"]
        for r in database.document_revisions.find({"doc_id": doc_id})
        .sort("snapshot.revision", -1)
        .limit(50)
    ]


@app.post("/api/export/docx")
def export_docx(body: Document):
    from backend.export import build_docx

    validated(body)
    try:
        binary = build_docx(body)
    except (ValueError, TypeError, KeyError, IndexError) as exc:
        raise HTTPException(422, "Unsupported document structure") from exc
    return Response(
        binary,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


from backend.live import router as live_router

app.include_router(live_router)


@app.post("/api/export/pdf")
def export_pdf(body: Document, email=Depends(user)):
    from backend.pdf_export import pdf_bytes

    validated(body)
    return Response(pdf_bytes(body), media_type="application/pdf")


class Folder(BaseModel):
    name: str = Field(min_length=1, max_length=120)


@app.get("/api/folders")
def folders(email=Depends(user), database=Depends(db)):
    return list(database.folders.find({"owner": email}, {"_id": 0}))


@app.post("/api/folders")
def create_folder(body: Folder, email=Depends(user), database=Depends(db)):
    database.folders.update_one(
        {"owner": email, "name": body.name},
        {"$setOnInsert": {"created": now()}},
        upsert=True,
    )
    return {"name": body.name}


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: str, email=Depends(user), database=Depends(db)):
    from backend.live import role

    row = database.documents.find_one({"_id": doc_id}, {"crdt": 0})
    permission = role(database, row, email) if row else None
    if not permission or row["deleted"] and permission != "owner":
        raise HTTPException(404)
    row.pop("_id")
    return {**row, "role": permission}


@app.get("/api/templates")
def templates(email=Depends(user), database=Depends(db)):
    from pathlib import Path

    definitions = json.loads(
        (Path(__file__).resolve().parents[1] / "src" / "templates.json").read_text(
            encoding="utf-8"
        )
    )
    for title, content in definitions.items():
        database.templates.update_one(
            {"_id": title},
            {
                "$setOnInsert": {
                    "title": title,
                    "content": {"type": "doc", "content": content},
                }
            },
            upsert=True,
        )
    return list(database.templates.find({}, {"_id": 0}))

