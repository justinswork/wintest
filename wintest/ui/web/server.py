"""Uvicorn server launcher."""

import logging
import webbrowser

import uvicorn

from ...config.settings import Settings
from .app import create_app

logger = logging.getLogger(__name__)


class _Server(uvicorn.Server):
    """Uvicorn server that opens the browser once startup is complete."""

    def __init__(self, config: uvicorn.Config, url: str):
        super().__init__(config)
        self._url = url

    async def startup(self, sockets=None):
        await super().startup(sockets)
        if self.started:
            webbrowser.open(self._url)


def start_server(settings: Settings, host: str = "127.0.0.1", port: int = 8080):
    """Start the uvicorn server with the FastAPI app."""
    app = create_app(settings)
    url = f"http://{host}:{port}"
    logger.info("Starting wintest web on %s", url)

    config = uvicorn.Config(app, host=host, port=port, log_level="info")
    server = _Server(config, url)
    server.run()
