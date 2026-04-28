"""
WebSocket 연결 관리자 — 동기 스레드에서도 broadcast 가능
"""
import asyncio
from typing import Any
from fastapi import WebSocket

_connections: list[WebSocket] = []
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


async def connect(ws: WebSocket) -> None:
    await ws.accept()
    _connections.append(ws)


def disconnect(ws: WebSocket) -> None:
    try:
        _connections.remove(ws)
    except ValueError:
        pass


async def broadcast(data: dict) -> None:
    dead: list[WebSocket] = []
    for ws in list(_connections):
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        disconnect(ws)


def broadcast_sync(data: dict) -> None:
    """동기 스레드(스케줄러 등)에서 WebSocket 메시지 전송용"""
    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(broadcast(data), _loop)
