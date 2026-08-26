"""
Delta Exchange India WebSocket client for live OHLCV candle data.

Connects to wss://public-socket.india.delta.exchange and subscribes to
the candlestick_{resolution} channel for all configured symbols.
Stores the last N candles per symbol in an in-memory ring buffer.

Also seeds the buffer on startup by fetching the last N historical
candles from the REST API.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import deque
from typing import Any, Callable

import httpx
import websockets
import websockets.exceptions

from app.config import settings
from app.models.schemas import Candle

logger = logging.getLogger("apex.delta_ws")


# ---------------------------------------------------------------------------
# In-memory candle store
# ---------------------------------------------------------------------------

class CandleStore:
    """
    Thread-safe in-memory ring buffer that holds the last ``max_candles``
    OHLCV candles **per symbol**.

    Layout:  { "BTCUSD": deque([Candle, ...], maxlen=200), ... }
    """

    def __init__(self, symbols: list[str], max_candles: int) -> None:
        self._max = max_candles
        self._buffers: dict[str, deque[Candle]] = {
            sym: deque(maxlen=max_candles) for sym in symbols
        }
        # Callbacks notified on every candle upsert  (symbol, candle)
        self._listeners: list[Callable[[str, Candle], Any]] = []

    # -- public API ----------------------------------------------------------

    def get_candles(self, symbol: str) -> list[Candle]:
        """Return a *copy* of the candle list for ``symbol``."""
        buf = self._buffers.get(symbol)
        if buf is None:
            return []
        return list(buf)

    def get_symbols(self) -> list[str]:
        """Return the list of tracked symbols."""
        return list(self._buffers.keys())

    def add_listener(self, callback: Callable[[str, Candle], Any]) -> None:
        """Register a callback that fires on every candle upsert."""
        self._listeners.append(callback)

    def remove_listener(self, callback: Callable[[str, Candle], Any]) -> None:
        """Unregister a previously added listener."""
        try:
            self._listeners.remove(callback)
        except ValueError:
            pass

    # -- internal ------------------------------------------------------------

    def seed(self, symbol: str, candles: list[Candle]) -> None:
        """
        Populate the buffer for ``symbol`` with historical candles.
        Called once at startup from the REST API fetch.
        """
        buf = self._buffers.get(symbol)
        if buf is None:
            return
        buf.clear()
        for c in candles[-self._max :]:
            buf.append(c)
        logger.info("Seeded %s with %d historical candles", symbol, len(buf))

    def upsert(self, symbol: str, candle: Candle) -> None:
        """
        Insert or update the latest candle for ``symbol``.

        If the incoming candle's timestamp matches the last candle in the
        buffer we *update* it (same bar, new tick). Otherwise we *append*
        a brand-new bar.
        """
        buf = self._buffers.get(symbol)
        if buf is None:
            return

    def upsert(self, symbol: str, candle: Candle) -> None:
        """
        Insert or update the latest candle for ``symbol``.

        If the incoming candle's timestamp matches the last candle in the
        buffer, update it in place (preserve original open price, expand
        high/low, update close). Otherwise append a new bar.
        """
        buf = self._buffers.get(symbol)
        if buf is None:
            return

        if buf and buf[-1].time == candle.time:
            # Same bar — update in place: preserve original open, expand high/low
            prev = buf[-1]
            buf[-1] = Candle(
                time=candle.time,
                open=prev.open,
                high=max(prev.high, candle.high, candle.close),
                low=min(prev.low, candle.low, candle.close),
                close=candle.close,
                volume=max(prev.volume, candle.volume),
            )
        elif not buf or candle.time > buf[-1].time:
            buf.append(candle)

        # Notify listeners
        for cb in self._listeners:
            try:
                cb(symbol, buf[-1])
            except Exception:
                logger.exception("Listener error")


# ---------------------------------------------------------------------------
# REST: seed historical candles
# ---------------------------------------------------------------------------

async def _fetch_history(
    client: httpx.AsyncClient,
    symbol: str,
    resolution: str,
    count: int,
) -> list[Candle]:
    """
    Fetch the last ``count`` historical candles for ``symbol`` from
    Delta Exchange India REST API.

    Endpoint: GET /v2/history/candles?resolution=&symbol=&start=&end=
    Response: { "success": true, "result": [ {time, open, high, low, close, volume}, ... ] }
    """
    now = int(time.time())

    # Map resolution string to seconds to compute start time
    resolution_seconds = _resolution_to_seconds(resolution)
    start = now - (count * resolution_seconds)

    url = f"{settings.delta_rest_url}{settings.history_candles_path}"
    params = {
        "resolution": resolution,
        "symbol": symbol,
        "start": str(start),
        "end": str(now),
    }

    try:
        resp = await client.get(url, params=params, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()

        if not data.get("success"):
            logger.warning("History fetch for %s unsuccessful: %s", symbol, data)
            return []

        raw_candles = data.get("result", [])
        res_sec = _resolution_to_seconds(resolution)
        candles = []
        for c in raw_candles:
            t = int(c["time"])
            if t > 1e14:
                t //= 1_000_000
            elif t > 1e11:
                t //= 1_000
            t_bucket = (t // res_sec) * res_sec
            candles.append(
                Candle(
                    time=t_bucket,
                    open=float(c["open"]),
                    high=float(c["high"]),
                    low=float(c["low"]),
                    close=float(c["close"]),
                    volume=float(c.get("volume", 0)),
                )
            )
        # API returns newest-first sometimes; ensure ascending order
        candles.sort(key=lambda c: c.time)
        return candles[-count:]

    except Exception:
        logger.exception("Failed to fetch history for %s", symbol)
        return []


def _resolution_to_seconds(res: str) -> int:
    """Convert a resolution string like '1m', '5m', '1h', '1d' to seconds."""
    mapping = {
        "1m": 60,
        "3m": 180,
        "5m": 300,
        "15m": 900,
        "30m": 1800,
        "1h": 3600,
        "2h": 7200,
        "4h": 14400,
        "6h": 21600,
        "12h": 43200,
        "1d": 86400,
        "1w": 604800,
    }
    return mapping.get(res, 60)


# ---------------------------------------------------------------------------
# WebSocket: live candle stream
# ---------------------------------------------------------------------------

class DeltaWSClient:
    """
    Async WebSocket client that:

    1. On startup, seeds the CandleStore with historical data via REST.
    2. Connects to ``wss://public-socket.india.delta.exchange``.
    3. Enables heartbeat to keep the connection alive.
    4. Subscribes to ``candlestick_{resolution}`` for all symbols.
    5. Parses incoming candle ticks and upserts them into CandleStore.
    6. Auto-reconnects with exponential backoff on disconnection.
    """

    def __init__(
        self,
        store: CandleStore,
        symbols: list[str] | None = None,
        resolution: str | None = None,
    ) -> None:
        self.store = store
        self.symbols = symbols or settings.default_symbols
        self.resolution = resolution or settings.default_resolution
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._running = False
        self._task: asyncio.Task | None = None

    # -- lifecycle -----------------------------------------------------------

    async def start(self) -> None:
        """Seed history, then launch the WebSocket loop as a background task."""
        self._running = True

        # 1. Seed historical candles via REST
        await self._seed_all()

        # 2. Start the persistent WS connection
        self._task = asyncio.create_task(self._run_forever())
        logger.info("DeltaWSClient started for %s @ %s", self.symbols, self.resolution)

    async def stop(self) -> None:
        """Gracefully shut down the WebSocket connection."""
        self._running = False
        if self._ws:
            await self._ws.close()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("DeltaWSClient stopped")

    # -- REST seeding --------------------------------------------------------

    async def _seed_all(self) -> None:
        """Fetch historical candles for every symbol and populate the store."""
        async with httpx.AsyncClient() as client:
            tasks = [
                _fetch_history(client, sym, self.resolution, settings.max_candles)
                for sym in self.symbols
            ]
            results = await asyncio.gather(*tasks)
            for sym, candles in zip(self.symbols, results):
                self.store.seed(sym, candles)

    # -- WebSocket loop ------------------------------------------------------

    async def _run_forever(self) -> None:
        """
        Connect → subscribe → consume loop with auto-reconnect.
        Uses exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s.
        """
        backoff = 1.0
        max_backoff = 30.0

        while self._running:
            try:
                logger.info("Connecting to %s ...", settings.delta_ws_url)
                async with websockets.connect(
                    settings.delta_ws_url,
                    ping_interval=25,   # library-level pings as safety net
                    ping_timeout=10,
                    close_timeout=5,
                ) as ws:
                    self._ws = ws
                    backoff = 1.0  # reset on successful connect

                    # Enable server-side heartbeat (every 30 s)
                    await self._enable_heartbeat(ws)

                    # Subscribe to candlestick channel
                    await self._subscribe(ws)

                    # Consume messages
                    await self._consume(ws)

            except websockets.exceptions.ConnectionClosedError as e:
                logger.warning("Connection closed: %s", e)
            except asyncio.CancelledError:
                logger.info("WS task cancelled")
                return
            except Exception:
                logger.exception("WebSocket error")

            if not self._running:
                break

            logger.info("Reconnecting in %.1fs ...", backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)

    async def _enable_heartbeat(self, ws: websockets.WebSocketClientProtocol) -> None:
        """Send enable_heartbeat so the server pings us every 30s."""
        msg = json.dumps({"type": "enable_heartbeat"})
        await ws.send(msg)
        logger.debug("Heartbeat enabled")

    async def _subscribe(self, ws: websockets.WebSocketClientProtocol) -> None:
        """
        Subscribe to ``candlestick_{resolution}`` for all symbols.

        Delta Exchange subscribe payload:
        {
          "type": "subscribe",
          "payload": {
            "channels": [
              { "name": "candlestick_1m", "symbols": ["BTCUSD", "ETHUSD", ...] }
            ]
          }
        }
        """
        channel_name = f"candlestick_{self.resolution}"
        payload = {
            "type": "subscribe",
            "payload": {
                "channels": [
                    {
                        "name": channel_name,
                        "symbols": self.symbols,
                    }
                ]
            },
        }
        await ws.send(json.dumps(payload))
        logger.info("Subscribed to %s for %s", channel_name, self.symbols)

    async def _consume(self, ws: websockets.WebSocketClientProtocol) -> None:
        """
        Read messages from the WebSocket and route them.

        Candlestick update format from Delta Exchange:
        {
          "c": 71748.0,       // close
          "h": 71751.5,       // high
          "l": 71737.0,       // low
          "o": 71737.0,       // open
          "res": "1m",        // resolution
          "sy": "BTCUSD",     // symbol
          "ts": 1775814834503627,  // timestamp (microseconds)
          "type": "candlestick_1m",
          "v": 2826.0         // volume (absent for mark-price candles)
        }
        """
        channel_prefix = f"candlestick_{self.resolution}"

        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            # Heartbeat — just log at debug, no action needed
            if msg_type == "heartbeat":
                logger.debug("Heartbeat received")
                continue

            # Subscription confirmation
            if msg_type == "subscriptions":
                logger.info("Subscription confirmed: %s", msg.get("channels"))
                continue

            # Candlestick update
            if msg_type == channel_prefix:
                self._handle_candle(msg)
                continue

            # Anything else (errors, etc.)
            logger.debug("Unhandled message type: %s", msg_type)

    def _handle_candle(self, msg: dict[str, Any]) -> None:
        """Parse a raw candlestick message and upsert into the store."""
        try:
            symbol = msg["sy"]
            ts = msg["ts"]

            if ts > 1e14:        # microseconds
                ts_sec = ts // 1_000_000
            elif ts > 1e11:      # milliseconds
                ts_sec = ts // 1_000
            else:
                ts_sec = ts

            # Bucket timestamp to resolution window (e.g. 60s for 1m)
            res_sec = _resolution_to_seconds(self.resolution)
            candle_time = (int(ts_sec) // res_sec) * res_sec

            candle = Candle(
                time=candle_time,
                open=float(msg["o"]),
                high=float(msg["h"]),
                low=float(msg["l"]),
                close=float(msg["c"]),
                volume=float(msg.get("v", 0)),
            )
            self.store.upsert(symbol, candle)
        except (KeyError, ValueError, TypeError):
            logger.exception("Failed to parse candle message: %s", msg)


# ---------------------------------------------------------------------------
# Module-level singleton instances
# ---------------------------------------------------------------------------

# The candle store is a singleton shared across the app
candle_store = CandleStore(
    symbols=settings.default_symbols,
    max_candles=settings.max_candles,
)

# The WS client is also a singleton; started/stopped by FastAPI lifespan
delta_client = DeltaWSClient(store=candle_store)
