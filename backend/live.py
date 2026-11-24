"""Single-worker collaboration service. MongoDB owns the committed Yjs state."""

import asyncio
import base64
import binascii
from collections import defaultdict
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from pycrdt import Doc as YDoc
from backend.main import db, user, now, digest, origins

router = APIRouter()
peers = defaultdict(dict)


def document(database, doc_id):
    row = database.documents.find_one({"_id": doc_id, "deleted": False})
    if not row:
        raise HTTPException(404, "Document unavailable")
    return row


def role(database, row, email):
    if row["owner"] == email:
        return "owner"
    permission = database.document_permissions.find_one(
        {"doc": row["_id"], "email": email}
    )
    return permission["role"] if permission else None


def audit(database, email, action, doc_id):
    database.audit_logs.insert_one(
        {"user": email, "action": action, "doc": doc_id, "at": now()}
    )


class Start(BaseModel):
    revision: int = Field(ge=1)
    initial: str = Field(max_length=6_000_000)


class Grant(BaseModel):
    email: str = Field(max_length=254)
    role: Literal["editor", "commenter", "viewer"]


def merge(base, update):
    try:
        state = YDoc()
        if base:
            state.apply_update(base)
        state.apply_update(update)
        data = state.get_update()
    except Exception as exc:
        raise HTTPException(422, "Invalid collaborative document") from exc
    if len(data) > 4_500_000:
        raise HTTPException(413, "Shared document exceeds size limit")
    return data


@router.post("/api/documents/{doc_id}/live")
def enable(doc_id: str, body: Start, email=Depends(user), database=Depends(db)):
    row = document(database, doc_id)
    if row["owner"] != email:
        raise HTTPException(403)
    if row.get("live"):
        return {"ok": True}
    try:
        seed = merge(None, base64.b64decode(body.initial, validate=True))
    except binascii.Error as exc:
        raise HTTPException(422, "Invalid state") from exc
    saved = database.documents.update_one(
        {"_id": doc_id, "revision": body.revision, "live": {"$ne": True}},
        {
            "$set": {"live": True, "crdt": seed, "updated": now().isoformat()},
            "$inc": {"revision": 1},
        },
    )
    if not saved.modified_count:
        raise HTTPException(409, "Reload the latest document first")
    audit(database, email, "enable collaboration", doc_id)
    return {"ok": True}


@router.get("/api/documents/{doc_id}/access")
def access(doc_id: str, email=Depends(user), database=Depends(db)):
    row = document(database, doc_id)
    if row["owner"] != email:
        raise HTTPException(403)
    return list(database.document_permissions.find({"doc": doc_id}, {"_id": 0}))


@router.post("/api/documents/{doc_id}/access")
def grant(doc_id: str, body: Grant, email=Depends(user), database=Depends(db)):
    row = document(database, doc_id)
    if row["owner"] != email:
        raise HTTPException(403)
    target = body.email.lower().strip()
    if target == email or not database.users.find_one({"_id": target}):
        raise HTTPException(422, "Choose another registered workspace account")
    database.document_permissions.update_one(
        {"_id": doc_id + ":" + target},
        {"$set": {"doc": doc_id, "email": target, "role": body.role}},
        upsert=True,
    )
    audit(database, email, "grant " + body.role, doc_id)
    return {"ok": True}


@router.delete("/api/documents/{doc_id}/access/{target}")
def revoke(doc_id: str, target: str, email=Depends(user), database=Depends(db)):
    if document(database, doc_id)["owner"] != email:
        raise HTTPException(403)
    database.document_permissions.delete_one({"doc": doc_id, "email": target})
    audit(database, email, "revoke", doc_id)
    return {"ok": True}


class Comment(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    quote: str = Field(max_length=2000)
    start: str = Field(max_length=2048)
    end: str = Field(max_length=2048)


@router.get("/api/documents/{doc_id}/comments")
def comments(doc_id: str, email=Depends(user), database=Depends(db)):
    if not role(database, document(database, doc_id), email):
        raise HTTPException(404)
    return list(database.comments.find({"doc": doc_id}, {"_id": 0}))


@router.post("/api/documents/{doc_id}/comments")
def comment(doc_id: str, body: Comment, email=Depends(user), database=Depends(db)):
    if role(database, document(database, doc_id), email) not in {
        "owner",
        "editor",
        "commenter",
    }:
        raise HTTPException(403)
    data = {
        **body.model_dump(),
        "id": str(uuid4()),
        "doc": doc_id,
        "author": email,
        "resolved": False,
    }
    database.comments.insert_one(dict(data))
    return data


@router.patch("/api/documents/{doc_id}/comments/{comment_id}")
def resolve(doc_id: str, comment_id: str, email=Depends(user), database=Depends(db)):
    if role(database, document(database, doc_id), email) not in {
        "owner",
        "editor",
        "commenter",
    }:
        raise HTTPException(403)
    if not database.comments.update_one(
        {"doc": doc_id, "id": comment_id}, {"$set": {"resolved": True}}
    ).matched_count:
        raise HTTPException(404)
    return {"ok": True}


@router.websocket("/api/live/{doc_id}")
async def live(ws: WebSocket, doc_id: str, database=Depends(db)):
    if ws.headers.get("origin") not in origins:
        await ws.close(code=1008)
        return

    def identity():
        token = database.sessions.find_one(
            {"_id": digest(ws.cookies.get("session", "")), "expires": {"$gt": now()}}
        )
        row = database.documents.find_one(
            {"_id": doc_id, "deleted": False, "live": True}
        )
        access = role(database, row, token["user"]) if token and row else None
        return token, row, access

    token, row, access = identity()
    if not access:
        await ws.close(code=1008)
        return
    await ws.accept()
    session_id = str(uuid4())
    database.collaboration_sessions.insert_one(
        {"_id": session_id, "doc": doc_id, "user": token["user"], "opened": now()}
    )
    peers[doc_id][ws] = token["user"]

    async def broadcast(frame):
        for other, recipient in list(peers[doc_id].items()):
            if other is ws:
                continue
            other_session = database.sessions.find_one(
                {
                    "_id": digest(other.cookies.get("session", "")),
                    "expires": {"$gt": now()},
                }
            )
            if not other_session or not role(database, row, recipient):
                continue
            try:
                await other.send_bytes(frame)
            except Exception:
                peers[doc_id].pop(other, None)

    try:
        await ws.send_bytes(b"\x00" + bytes(row["crdt"]))
        while True:
            try:
                frame = await asyncio.wait_for(ws.receive_bytes(), timeout=15)
            except asyncio.TimeoutError:
                frame = b""
            token, row, access = identity()
            if not access:
                await ws.close(code=1008)
                break
            if not frame:
                continue
            if len(frame) > 4_500_000:
                await ws.close(code=1009)
                break
            if frame[0] == 1:
                if access not in {"owner", "editor"}:
                    await ws.close(code=1008)
                    break
                # Conditional retries merge a concurrent commit without dropping either update.
                while True:
                    state = merge(bytes(row["crdt"]), frame[1:])
                    commit = database.documents.update_one(
                        {"_id": doc_id, "revision": row["revision"], "deleted": False},
                        {
                            "$set": {"crdt": state, "updated": now().isoformat()},
                            "$inc": {"revision": 1},
                        },
                    )
                    if commit.modified_count:
                        break
                    token, row, access = identity()
                    if access not in {"owner", "editor"}:
                        raise HTTPException(403)
                await broadcast(frame)
                await ws.send_bytes(b"\x03")
            elif frame[0] == 2 and len(frame) < 8192:
                await broadcast(frame)
            else:
                await ws.close(code=1008)
                break
    except (WebSocketDisconnect, RuntimeError, HTTPException):
        pass
    finally:
        database.collaboration_sessions.update_one(
            {"_id": session_id}, {"$set": {"closed": now()}}
        )
        peers[doc_id].pop(ws, None)
        if not peers[doc_id]:
            peers.pop(doc_id, None)
