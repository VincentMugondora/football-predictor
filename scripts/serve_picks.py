"""Serve public/picks.json (and site/history.json) to the app on your Wi-Fi.

Built-in Python only. Adds CORS headers so the web version of the app can
fetch from it too, and prints the address to put in .env.

    .venv\\Scripts\\python scripts\\serve_picks.py
"""

from __future__ import annotations

import socket
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8000


class CorsHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802 - http.server naming
        self.send_response(204)
        self.end_headers()

    def translate_path(self, path: str) -> str:
        # history.json lives in site/, everything else in public/.
        if path.split("?")[0].endswith("/history.json"):
            return str(ROOT / "site" / "history.json")
        return super().translate_path(path)


def lan_address() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.168.1.1", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def main() -> None:
    handler = partial(CorsHandler, directory=str(ROOT / "public"))
    server = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    ip = lan_address()
    print(f"Serving picks at http://{ip}:{PORT}/picks.json")
    print(f"Put this in .env:  EXPO_PUBLIC_PICKS_URL=http://{ip}:{PORT}/picks.json")
    print("Requests will be listed below. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
