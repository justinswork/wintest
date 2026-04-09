"""Builder API routes — interactive single-step execution for test building."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import state as state_module
from ..services import execution_service

router = APIRouter()

# Module-level builder state (one session at a time)
_builder: execution_service.BuilderState | None = None


class BuilderStepRequest(BaseModel):
    action: str
    description: str = ""
    target: str | None = None
    text: str | None = None
    key: str | None = None
    keys: list[str] | None = None
    scroll_amount: int = 0
    wait_seconds: float = 0.0
    app_path: str | None = None
    app_title: str | None = None
    expected: bool = True
    click_x: float | None = None
    click_y: float | None = None


@router.post("/start")
async def start_session():
    """Start a new builder session (loads model if needed)."""
    global _builder
    app_state = state_module.app_state
    try:
        _builder = execution_service.start_builder(app_state)
        return {"status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/step")
async def execute_step(request: BuilderStepRequest):
    """Execute a single step and return the result with screenshot."""
    global _builder
    if _builder is None:
        raise HTTPException(status_code=409, detail="No builder session active. Call /start first.")

    from ....tasks.schema import Step

    step = Step(
        action=request.action,
        description=request.description,
        target=request.target,
        text=request.text,
        key=request.key,
        keys=request.keys,
        scroll_amount=request.scroll_amount,
        wait_seconds=request.wait_seconds,
        app_path=request.app_path,
        app_title=request.app_title,
        expected=request.expected,
        click_x=request.click_x,
        click_y=request.click_y,
    )

    result = execution_service.execute_builder_step(step, _builder)
    return result


@router.post("/stop")
async def stop_session():
    """Stop the builder session and clean up."""
    global _builder
    if _builder is not None:
        if _builder.app_manager:
            try:
                _builder.app_manager.close()
            except Exception:
                pass
        _builder = None
    return {"status": "stopped"}


@router.get("/screenshot")
async def get_screenshot():
    """Capture and return the current screen."""
    global _builder
    if _builder is None:
        raise HTTPException(status_code=409, detail="No builder session active.")

    import base64
    import io

    try:
        screenshot = _builder.screen.capture()
        buf = io.BytesIO()
        screenshot.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        return {"screenshot_base64": b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
