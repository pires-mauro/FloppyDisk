import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from app.models.common import ApiIndexResponse
from app.preliminary_reassessment import recalculate_preliminary_assessments
from app.router import router

logger = logging.getLogger(__name__)
REASSESSMENT_INTERVAL_SECONDS = 60 * 60


async def _run_hourly_reassessment() -> None:
    while True:
        await asyncio.sleep(REASSESSMENT_INTERVAL_SECONDS)
        try:
            count = await asyncio.to_thread(recalculate_preliminary_assessments)
            logger.info("Hourly task recalculated %s preliminary assessment(s)", count)
        except Exception:
            logger.exception("Hourly preliminary assessment recalculation failed")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_run_hourly_reassessment())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="Bank Onboarding API",
    description="Backend API for the bank client onboarding platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router, prefix="/api")


@app.get("/", response_model=ApiIndexResponse, tags=["Health"], summary="Get API links")
def root() -> ApiIndexResponse:
    return ApiIndexResponse(message="Welcome to the Bank Onboarding API", docs="/docs")
