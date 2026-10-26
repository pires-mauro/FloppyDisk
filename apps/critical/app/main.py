from fastapi import FastAPI

from app.router import router

app = FastAPI(
    title="Risk Calculator",
    description="Risk Scoring API for the bank client onboarding platform",
    version="0.1.0"
    )

app.include_router(router)