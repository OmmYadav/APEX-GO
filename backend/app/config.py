"""
Configuration for the APEX backend.
Loads settings from environment variables / .env file.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, populated from env vars or .env file."""

    # Delta Exchange India endpoints
    delta_ws_url: str = "wss://public-socket.india.delta.exchange"
    delta_rest_url: str = "https://api.india.delta.exchange"

    # Trading pairs to subscribe to (Delta Exchange symbols)
    # Delta uses "BTCUSD", "ETHUSD" etc. for perpetual futures
    default_symbols: list[str] = [
        "BTCUSD",
        "ETHUSD",
        "SOLUSD",
        "XRPUSD",
        "DOGEUSD",
        "AVAXUSD",
        "LINKUSD",
    ]

    # Default candlestick resolution
    default_resolution: str = "1m"

    # How many candles to keep in the in-memory ring buffer per symbol
    max_candles: int = 200

    # Historical candles REST endpoint path
    history_candles_path: str = "/v2/history/candles"

    model_config = {"env_prefix": "APEX_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
