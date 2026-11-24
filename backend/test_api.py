import mongomock
import pytest
from fastapi.testclient import TestClient
from backend.main import app, db, attempts


@pytest.fixture
def service(monkeypatch):
    database = mongomock.MongoClient(tz_aware=True).test
    app.dependency_overrides[db] = lambda: database
    monkeypatch.setenv("COOKIE_SECURE", "0")
    attempts.clear()
    yield TestClient(app, headers={"X-Workspace": "editor"})
    app.dependency_overrides.clear()


def register(service, name):
    return service.post(
        "/api/auth/register",
        json={"email": name + "@example.org", "password": "long-enough-password"},
    )


def document():
    return {
        "id": "a",
        "title": "Meeting",
        "content": {"type": "doc", "content": [{"type": "paragraph"}]},
        "revision": 0,
    }


def test_auth_and_origin(service):
    assert service.get("/api/documents").status_code == 401
    assert register(service, "owner").status_code == 200
    assert (
        service.post(
            "/api/documents",
            json=document(),
            headers={"Origin": "https://other.invalid"},
        ).status_code
        == 403
    )
    assert service.delete("/api/session").status_code == 200
    assert service.get("/api/me").status_code == 401
    assert (
        service.post(
            "/api/auth/login",
            json={"email": "owner@example.org", "password": "incorrect-password"},
        ).status_code
        == 401
    )


def test_documents_revisions_and_isolation(service):
    register(service, "owner")
    saved = service.post("/api/documents", json=document()).json()
    assert saved["revision"] == 1
    saved["title"] = "Updated"
    assert service.patch("/api/documents/a", json=saved).json()["revision"] == 2
    assert service.patch("/api/documents/a", json=saved).status_code == 409
    assert service.get("/api/documents/a/versions").json()[0]["title"] == "Meeting"
    register(service, "another")
    assert service.get("/api/documents").json() == []
    assert service.patch("/api/documents/a", json=saved).status_code == 404
    assert service.get("/api/documents/a/versions").status_code == 404


def test_duplicate_and_invalid_content(service):
    register(service, "owner")
    assert service.post("/api/documents", json=document()).status_code == 201
    assert service.post("/api/documents", json=document()).status_code == 409
    assert (
        service.post("/api/documents", json={**document(), "content": {}}).status_code
        == 422
    )


def test_export_opens_in_word_parser(service):
    from io import BytesIO
    from docx import Document

    body = document()
    body["content"]["content"] = [
        {
            "type": "heading",
            "attrs": {"level": 1},
            "content": [{"type": "text", "text": "Report"}],
        },
        {
            "type": "paragraph",
            "content": [
                {"type": "text", "text": "Review", "marks": [{"type": "bold"}]}
            ],
        },
        {
            "type": "table",
            "content": [
                {
                    "type": "tableRow",
                    "content": [
                        {
                            "type": "tableCell",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": "Cell"}],
                                }
                            ],
                        }
                    ],
                }
            ],
        },
    ]
    response = service.post("/api/export/docx", json=body)
    assert response.status_code == 200
    loaded = Document(BytesIO(response.content))
    assert loaded.paragraphs[0].text == "Report"
    assert loaded.paragraphs[1].runs[0].bold
    assert loaded.tables[0].cell(0, 0).text == "Cell"


def test_shared_permissions_and_crdt(service):
    import base64
    from pycrdt import Doc, Text

    register(service, "member")
    visitor = TestClient(
        app, headers={"X-Workspace": "editor"}, cookies=service.cookies
    )
    register(service, "owner")
    saved = service.post("/api/documents", json=document()).json()
    seed = Doc({"text": Text("First")})
    initial = base64.b64encode(seed.get_update()).decode()
    assert (
        service.post(
            "/api/documents/a/live",
            json={"revision": saved["revision"], "initial": initial},
        ).status_code
        == 200
    )
    base = "/api/documents/a/access"

    def grant(role):
        assert (
            service.post(
                base, json={"email": "member@example.org", "role": role}
            ).status_code
            == 200
        )

    grant("viewer")
    assert visitor.get("/api/documents").json()[0]["role"] == "viewer"
    assert visitor.get(base).status_code == 403
    note = {"text": "Please check", "quote": "First", "start": "a", "end": "b"}
    assert visitor.post("/api/documents/a/comments", json=note).status_code == 403
    opts = {"headers": {"origin": "http://localhost:5173"}}
    with visitor.websocket_connect("/api/live/a", **opts) as sock:
        assert sock.receive_bytes()[0] == 0
        sock.send_bytes(bytes([1]) + seed.get_update())
        assert sock.receive()["type"] == "websocket.close"
    grant("commenter")
    assert visitor.post("/api/documents/a/comments", json=note).status_code == 200
    grant("editor")
    with visitor.websocket_connect("/api/live/a", **opts) as sock:
        replica = Doc()
        replica.apply_update(sock.receive_bytes()[1:])
        before = replica.get_state()
        replica.get("text", type=Text).insert(5, " draft")
        sock.send_bytes(bytes([1]) + replica.get_update(before))
        assert sock.receive_bytes() == bytes([3])
    with service.websocket_connect("/api/live/a", **opts) as sock:
        recovered = Doc()
        recovered.apply_update(sock.receive_bytes()[1:])
        assert str(recovered.get("text", type=Text)) == "First draft"
    assert service.delete(base + "/member@example.org").status_code == 200
    assert not visitor.get("/api/documents").json()


def test_pdf_export(service):
    register(service, "pdf")
    body = document()
    body["content"]["content"] = [
        {"type": "paragraph", "content": [{"type": "text", "text": "Printable page"}]},
        {"type": "manualBreak"},
        {"type": "paragraph", "content": [{"type": "text", "text": "Second page"}]},
    ]
    res = service.post("/api/export/pdf", json=body)
    assert res.status_code == 200
    assert res.content.startswith(b"%PDF-")
    import re

    assert len(re.findall(rb"/Type\s*/Page\b", res.content)) == 2
