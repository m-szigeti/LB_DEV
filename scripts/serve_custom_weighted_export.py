#!/usr/bin/env python3
"""
Tiny localhost helper so the map tool can write custom weighted exports
into exports/custom_weighted/ from any browser (including Cursor Simple Browser).

Usage:
  python scripts/serve_custom_weighted_export.py

Keep this running while you use Export to folder. Default port: 8765.
"""

from __future__ import annotations

import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT_DIR = ROOT / "exports" / "custom_weighted"
HOST = "127.0.0.1"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")
MAX_BODY_BYTES = 80 * 1024 * 1024


class ExportHandler(BaseHTTPRequestHandler):
    server_version = "LBCustomWeightedExport/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _send(self, code: int, payload: dict, extra_headers: dict | None = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send(204, {"ok": True})

    def do_GET(self) -> None:
        if self.path.rstrip("/") in ("/__lb_export__/custom_weighted", "/health"):
            self._send(
                200,
                {
                    "ok": True,
                    "exportDir": str(EXPORT_DIR),
                    "ready": True,
                },
            )
            return
        self._send(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/__lb_export__/custom_weighted":
            self._send(404, {"ok": False, "error": "Not found"})
            return

        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send(400, {"ok": False, "error": "Invalid Content-Length"})
            return

        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            self._send(400, {"ok": False, "error": "Body must be JSON"})
            return

        files = payload.get("files")
        if not isinstance(files, list) or not files:
            self._send(400, {"ok": False, "error": "Expected files: [{name, content}, ...]"})
            return

        EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        written = []
        try:
            for item in files:
                if not isinstance(item, dict):
                    raise ValueError("Each file must be an object")
                name = str(item.get("name") or "").strip()
                content = item.get("content")
                if not SAFE_NAME.match(name) or ".." in name or "/" in name or "\\" in name:
                    raise ValueError(f"Unsafe filename: {name!r}")
                if not isinstance(content, str):
                    raise ValueError(f"File content must be a string: {name}")
                target = EXPORT_DIR / name
                target.write_text(content, encoding="utf-8")
                written.append(str(target))
        except Exception as exc:
            self._send(400, {"ok": False, "error": str(exc)})
            return

        self._send(
            200,
            {
                "ok": True,
                "exportDir": str(EXPORT_DIR),
                "written": written,
            },
        )


def main() -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), ExportHandler)
    print(f"Custom weighted export server listening on http://{HOST}:{PORT}")
    print(f"Writing files to: {EXPORT_DIR}")
    print("Keep this window open, then use Export to folder in the map tool.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
