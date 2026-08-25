"""
APEX Backend — FastAPI entry point.

Starts the Delta Exchange WebSocket client on app startup and
shuts it down cleanly on exit.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import market
from app.services.delta_ws import delta_client

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-28s  %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)

# ---------------------------------------------------------------------------
# Lifespan — start / stop the Delta WS client
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the background WS client on boot, stop it on shutdown."""
    await delta_client.start()
    yield
    await delta_client.stop()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="APEX — Crypto Trading Dashboard API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server (default port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(market.router)


@app.get("/health")
async def health():
    """Simple health check."""
    return {"status": "ok"}
