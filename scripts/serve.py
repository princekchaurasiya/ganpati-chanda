#!/usr/bin/env python3
"""Serve FastAPI + built UI on IPv4 and IPv6 (Preview may use either)."""

from __future__ import annotations

import os
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))

import uvicorn

PORT = int(os.environ.get("PORT", "45211"))


def listen(port: int) -> socket.socket:
    sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    # Dual-stack: :: with V6ONLY=0 also accepts 127.0.0.1
    sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
    sock.bind(("::", port))
    sock.listen(2048)
    return sock


_LISTEN_SOCK = None


def main() -> None:
    global _LISTEN_SOCK
    _LISTEN_SOCK = listen(PORT)
    sock = _LISTEN_SOCK
    config = uvicorn.Config(
        "server:app",
        fd=sock.fileno(),
        proxy_headers=True,
        forwarded_allow_ips="*",
        timeout_keep_alive=5,
        log_level="info",
    )
    print(f"Listening dual-stack on *:{PORT} (127.0.0.1 and ::1)", flush=True)
    uvicorn.Server(config).run()
    sock.close()


if __name__ == "__main__":
    main()
