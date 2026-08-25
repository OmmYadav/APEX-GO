"""
Pydantic models for OHLCV candle data and WebSocket messages.
"""

from pydantic import BaseModel


class Candle(BaseModel):
    """A single OHLCV candle."""

    time: int  # Unix timestamp in seconds (start of candle)
    open: float
    high: float
    low: float
    close: float
    volume: float  # 0.0 for mark-price candles


class CandleUpdate(BaseModel):
    """A candle update pushed to frontend clients via WebSocket."""

    symbol: str
    resolution: str
    candle: Candle


class SnapshotMessage(BaseModel):
    """Full candle history snapshot sent on initial connection."""

    type: str = "snapshot"
    symbol: str
    resolution: str
    candles: list[Candle]


class UpdateMessage(BaseModel):
    """Incremental candle update sent on each tick."""

    type: str = "update"
    symbol: str
    resolution: str
    candle: Candle
