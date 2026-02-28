"""WebSocket endpoint for live execution streaming."""

from fastapi import WebSocket, WebSocketDisconnect

from ..state import app_state as _app_state_ref
from .. import state as state_module


async def execution_ws(websocket: WebSocket):
    """Handle a WebSocket connection for execution progress."""
    await websocket.accept()
    app_state = state_module.app_state
    app_state.ws_clients.add(websocket)

    # Send current state on connect
    if app_state.current_run:
        run = app_state.current_run
        await websocket.send_json({
            "type": "run_status",
            "run_id": run.run_id,
            "test_name": run.test_name,
            "status": run.status,
            "current_step": run.current_step,
            "total_steps": run.total_steps,
            "step_results": run.step_results,
        })

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        app_state.ws_clients.discard(websocket)
