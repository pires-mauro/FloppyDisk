from fastapi import FastAPI

from app.router import router

app = FastAPI(
    title="Bank Onboarding API",
    description="Backend API for the bank client onboarding platform",
    version="0.1.0",
)

app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {
        "message": "Welcome to the Bank Onboarding API",
        "docs": "/docs",
    }