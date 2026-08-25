"""
REST + WebSocket router for market / candle data.

Endpoints:
  GET  /api/market/candles?symbol=BTCUSD  →  last 200 candles (JSON)
  GET  /api/market/symbols                →  list of tracked symbols
  GET  /api/market/signal?symbol=BTCUSD  →  LONG/SHORT/WAIT signal
  WS   /ws/market?symbol=BTCUSD          →  snapshot + live stream
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.models.schemas import Candle, SnapshotMessage, UpdateMessage
from app.services.delta_ws import candle_store
from app.services.signal_engine import default_engine

logger = logging.getLogger("apex.router.market")

router = APIRouter(prefix="/api/market", tags=["market"])


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/symbols")
async def get_symbols() -> dict:
    """Return the list of symbols being tracked."""
    return {"symbols": candle_store.get_symbols()}


@router.get("/candles")
async def get_candles(symbol: str = Query(..., description="Trading pair symbol, e.g. BTCUSD")) -> dict:
    """Return the last N candles for the given symbol."""
    candles = candle_store.get_candles(symbol.upper())
    return {
        "symbol": symbol.upper(),
        "count": len(candles),
        "candles": [c.model_dump() for c in candles],
    }


@router.get("/signal")
async def get_signal(
    symbol: str = Query("BTCUSD", description="Trading pair symbol, e.g. BTCUSD"),
) -> dict:
    """
    Run the signal engine on the live candle buffer and return a
    LONG / SHORT / WAIT verdict with entry, stop-loss, and take-profit levels.
    """
    sym = symbol.upper()
    candles = candle_store.get_candles(sym)
    result = default_engine.compute(candles)
    return {
        "symbol": sym,
        "direction": result.direction,
        "entry": result.entry,
        "stop_loss": result.stop_loss,
        "take_profit": result.take_profit,
        "confidence": result.confidence,
        "score": result.score,
        "indicators": {
            "rsi": result.rsi,
            "rsi_signal": result.rsi_signal,
            "ema_fast": result.ema_fast,
            "ema_slow": result.ema_slow,
            "ema_signal": result.ema_signal,
            "breakout_signal": result.breakout_signal,
            "atr": result.atr,
        },
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint — live candle stream
# ---------------------------------------------------------------------------

@router.websocket("/ws/market")
async def ws_market(
    websocket: WebSocket,
    symbol: str = Query("BTCUSD", description="Symbol to stream"),
):
    """
    WebSocket endpoint for live candle updates.

    1. On connect → send a ``snapshot`` message with the full candle buffer.
    2. Then stream ``update`` messages every time a candle is upserted.
    """
    await websocket.accept()
    symbol = symbol.upper()

    # Send initial snapshot
    candles = candle_store.get_candles(symbol)
    snapshot = SnapshotMessage(
        symbol=symbol,
        resolution="1m",
        candles=candles,
    )
    await websocket.send_text(snapshot.model_dump_json())

    # Set up a queue to receive updates from the candle store
    queue: asyncio.Queue[tuple[str, Candle]] = asyncio.Queue()

    def on_update(sym: str, candle: Candle) -> None:
        if sym == symbol:
            queue.put_nowait((sym, candle))

    candle_store.add_listener(on_update)

    try:
        while True:
            # Wait for the next candle update
            sym, candle = await queue.get()
            update = UpdateMessage(
                symbol=sym,
                resolution="1m",
                candle=candle,
            )
            await websocket.send_text(update.model_dump_json())
    except WebSocketDisconnect:
        logger.info("Client disconnected from /ws/market (symbol=%s)", symbol)
    except Exception:
        logger.exception("Error in /ws/market WebSocket")
    finally:
        candle_store.remove_listener(on_update)
