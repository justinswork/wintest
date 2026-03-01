"""Singleton application state for the web server."""

import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class RunState:
    run_id: str
    test_name: str
    status: str  # running, completed, failed, cancelled
    current_step: int = 0
    total_steps: int = 0
    step_results: list = field(default_factory=list)
    cancel_event: threading.Event = field(default_factory=threading.Event)


class AppState:
    """Holds shared resources across the web application."""

    def __init__(self, settings):
        self.settings = settings
        self.vision_model = None
        self.model_status: str = "not_loaded"  # not_loaded, loading, loaded
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.current_run: Optional[RunState] = None
        self.last_run: Optional[RunState] = None
        self.ws_clients: set[WebSocket] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    @property
    def loop(self) -> asyncio.AbstractEventLoop:
        if self._loop is None:
            self._loop = asyncio.get_event_loop()
        return self._loop

    @loop.setter
    def loop(self, value):
        self._loop = value

    async def broadcast(self, message: dict):
        """Send a JSON message to all connected WebSocket clients."""
        disconnected = set()
        for ws in self.ws_clients:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.add(ws)
        self.ws_clients -= disconnected

    def broadcast_sync(self, message: dict):
        """Send a broadcast from a synchronous (thread pool) context."""
        asyncio.run_coroutine_threadsafe(self.broadcast(message), self.loop)

    def shutdown(self):
        self.executor.shutdown(wait=False)


# Module-level singleton, set during app startup
app_state: Optional[AppState] = None
