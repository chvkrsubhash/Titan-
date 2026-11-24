from starlette.responses import JSONResponse


class BodyLimit:
    """Bound streamed and fixed-length writes before parsing JSON."""

    def __init__(self, app, limit=5_000_000):
        self.app = app
        self.limit = limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PATCH"}:
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            part = await receive()
            if part["type"] == "http.disconnect":
                return
            body.extend(part.get("body", b""))
            if len(body) > self.limit:
                return await JSONResponse(
                    {"detail": "Document exceeds request size limit"}, status_code=413
                )(scope, receive, send)
            if not part.get("more_body"):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        return await self.app(scope, replay, send)
