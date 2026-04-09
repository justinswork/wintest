"""FastAPI application factory."""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import state as state_module
from .state import AppState
from .routes import tests, test_suites, execution, reports, ws, builder, files, saved_apps
from .routes import settings as settings_routes

logger = logging.getLogger(__name__)


def create_app(settings) -> FastAPI:
    """Create and configure the FastAPI application."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app_state = AppState(settings)
        app_state.loop = asyncio.get_event_loop()
        state_module.app_state = app_state
        logger.info("Web server started.")
        yield
        app_state.shutdown()
        logger.info("Web server stopped.")

    app = FastAPI(
        title="wintest",
        description="AI-powered Windows UI testing tool",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(tests.router, prefix="/api/tests", tags=["tests"])
    app.include_router(test_suites.router, prefix="/api/test-suites", tags=["test-suites"])
    app.include_router(execution.router, prefix="/api/execution", tags=["execution"])
    app.include_router(builder.router, prefix="/api/builder", tags=["builder"])
    app.include_router(files.router, prefix="/api/files", tags=["files"])
    app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
    app.include_router(saved_apps.router, prefix="/api/saved-apps", tags=["saved-apps"])
    app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
    app.add_api_websocket_route("/api/ws/execution", ws.execution_ws)

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    # Serve React SPA build if it exists
    frontend_dist = Path(__file__).parent / "frontend" / "dist"
    if frontend_dist.exists():
        index_html = frontend_dist / "index.html"

        # Mount static assets (JS, CSS, images)
        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")))

        # Catch-all: serve index.html for any non-API route (SPA client-side routing)
        @app.get("/{full_path:path}")
        async def spa_fallback(request: Request, full_path: str):
            return FileResponse(str(index_html))
    else:
        @app.get("/")
        async def index():
            return {
                "message": "wintest web API is running.",
                "hint": "Build the frontend with: cd wintest/ui/web/frontend && npm run build",
            }

    return app
