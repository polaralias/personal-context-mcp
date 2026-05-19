from __future__ import annotations

import io
import json
from urllib.error import HTTPError


class FakeHttpResponse:
    def __init__(self, payload):
        self._payload = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def http_error(url: str, code: int, message: str, payload: dict | None = None) -> HTTPError:
    return HTTPError(
        url=url,
        code=code,
        msg=message,
        hdrs=None,
        fp=io.BytesIO(json.dumps(payload or {}).encode("utf-8")),
    )
