"""
signal_engine.py — APEX Trading Signal Engine
===============================================

Computes a LONG / SHORT / WAIT signal from the last 200 OHLCV candles using
three independent indicators:

  1. RSI(14)          — momentum filter
  2. EMA(9/20)        — trend crossover
  3. Breakout         — close > 20-period rolling high, volume > 1.5× avg

Entry / risk levels:
  • Entry      : current close price
  • Stop-Loss  : entry ± 1.5 × ATR(14)   (below for LONG, above for SHORT)
  • Take-Profit: entry ± 2 × |entry - stop|  (2 : 1 reward-to-risk)

The engine scores each indicator on a [-1, 0, +1] scale and emits:
  • LONG   if aggregate score ≥ +2  (at least 2 of 3 indicators bullish)
  • SHORT  if aggregate score ≤ -2  (at least 2 of 3 indicators bearish)
  • WAIT   otherwise

Usage
-----
    from app.services.delta_ws import candle_store
    from app.services.signal_engine import SignalEngine

    engine = SignalEngine()
    result = engine.compute(candle_store.get_candles("BTCUSD"))
    print(result)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

import pandas as pd
import pandas_ta as ta

from app.models.schemas import Candle

logger = logging.getLogger("apex.signal_engine")

# ---------------------------------------------------------------------------
# Configurable parameters (override via subclass or constructor kwargs)
# ---------------------------------------------------------------------------

DEFAULTS = dict(
    rsi_period=14,
    rsi_overbought=60,       # RSI above this → bullish
    rsi_oversold=40,         # RSI below this → bearish
    ema_fast=9,
    ema_slow=20,
    breakout_lookback=20,    # rolling window for high / volume average
    breakout_volume_mult=1.5,
    atr_period=14,
    atr_multiplier=1.5,      # stop = entry ± atr_multiplier × ATR
    rr_ratio=2.0,            # take-profit = rr_ratio × risk
    min_candles=30,          # minimum candles required to compute signal
)


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class SignalResult:
    """Output of the signal engine for a single symbol / candle batch."""

    direction: Literal["LONG", "SHORT", "WAIT"]
    entry: float
    stop_loss: float
    take_profit: float
    confidence: float           # 0.0 – 1.0  (proportion of indicators aligned)
    score: int                  # raw aggregate score  (-3 … +3)

    # Indicator breakdown (for debugging / display)
    rsi: float
    rsi_signal: int             # -1 / 0 / +1
    ema_fast: float
    ema_slow: float
    ema_signal: int             # -1 / 0 / +1
    breakout_signal: int        # -1 / 0 / +1
    atr: float

    def __str__(self) -> str:
        sign = "▲" if self.direction == "LONG" else ("▼" if self.direction == "SHORT" else "–")
        return (
            f"{sign} {self.direction}  "
            f"entry={self.entry:.4f}  "
            f"sl={self.stop_loss:.4f}  "
            f"tp={self.take_profit:.4f}  "
            f"conf={self.confidence:.0%}  "
            f"[RSI={self.rsi:.1f} EMA={self.ema_signal:+d} BRK={self.breakout_signal:+d}]"
        )


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class SignalEngine:
    """
    Stateless signal engine — call ``compute()`` with a list of Candle objects
    and get back a ``SignalResult``.

    Parameters
    ----------
    **kwargs
        Override any of the values in ``DEFAULTS``.
    """

    def __init__(self, **kwargs: float | int) -> None:
        self.cfg = {**DEFAULTS, **kwargs}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compute(self, candles: list[Candle]) -> SignalResult:
        """
        Compute a signal from a list of Candle objects.

        Returns a ``SignalResult`` with ``direction="WAIT"`` and zeroed
        levels if there are not enough candles to be statistically meaningful.
        """
        cfg = self.cfg

        if len(candles) < cfg["min_candles"]:
            logger.warning(
                "Only %d candles available; need at least %d. Returning WAIT.",
                len(candles),
                cfg["min_candles"],
            )
            return self._wait_result(entry=candles[-1].close if candles else 0.0)

        # 1. Build DataFrame
        df = self._to_dataframe(candles)

        # 2. Compute indicators
        df = self._add_indicators(df)

        # 3. Score latest row
        last = df.iloc[-1]

        rsi_sig = self._score_rsi(last)
        ema_sig = self._score_ema(last)
        brk_sig = self._score_breakout(last)
        score   = rsi_sig + ema_sig + brk_sig

        # 4. Determine direction
        if score >= 2:
            direction: Literal["LONG", "SHORT", "WAIT"] = "LONG"
        elif score <= -2:
            direction = "SHORT"
        else:
            direction = "WAIT"

        # 5. Compute price levels
        entry       = float(last["close"])
        atr         = float(last["atr"])
        stop_dist   = cfg["atr_multiplier"] * atr

        if direction == "LONG":
            stop_loss   = entry - stop_dist
            take_profit = entry + cfg["rr_ratio"] * stop_dist
        elif direction == "SHORT":
            stop_loss   = entry + stop_dist
            take_profit = entry - cfg["rr_ratio"] * stop_dist
        else:
            # WAIT — still provide indicative levels so the UI can render lines
            stop_loss   = entry - stop_dist
            take_profit = entry + cfg["rr_ratio"] * stop_dist

        # 6. Confidence = proportion of max possible score that is aligned
        max_score   = 3
        confidence  = abs(score) / max_score

        result = SignalResult(
            direction=direction,
            entry=round(entry, 4),
            stop_loss=round(stop_loss, 4),
            take_profit=round(take_profit, 4),
            confidence=round(confidence, 4),
            score=score,
            rsi=round(float(last["rsi"]), 2),
            rsi_signal=rsi_sig,
            ema_fast=round(float(last["ema_fast"]), 4),
            ema_slow=round(float(last["ema_slow"]), 4),
            ema_signal=ema_sig,
            breakout_signal=brk_sig,
            atr=round(atr, 4),
        )
        logger.info("%s", result)
        return result

    # ------------------------------------------------------------------
    # DataFrame helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_dataframe(candles: list[Candle]) -> pd.DataFrame:
        """Convert a list of Candle objects into an OHLCV DataFrame."""
        rows = [
            {
                "time":   c.time,
                "open":   c.open,
                "high":   c.high,
                "low":    c.low,
                "close":  c.close,
                "volume": c.volume,
            }
            for c in candles
        ]
        df = pd.DataFrame(rows)
        df["time"] = pd.to_datetime(df["time"], unit="s", utc=True)
        df.set_index("time", inplace=True)
        df = df.astype(float)
        return df

    def _add_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Append RSI, EMA, ATR, breakout columns to the DataFrame."""
        cfg = self.cfg

        # --- RSI ----------------------------------------------------------
        df["rsi"] = ta.rsi(df["close"], length=int(cfg["rsi_period"]))

        # --- EMAs ---------------------------------------------------------
        df["ema_fast"] = ta.ema(df["close"], length=int(cfg["ema_fast"]))
        df["ema_slow"] = ta.ema(df["close"], length=int(cfg["ema_slow"]))

        # --- ATR ----------------------------------------------------------
        df["atr"] = ta.atr(
            df["high"], df["low"], df["close"],
            length=int(cfg["atr_period"]),
        )

        # --- Breakout columns ---------------------------------------------
        lb = int(cfg["breakout_lookback"])

        # Rolling 20-period high of the *previous* bars (shift by 1 to avoid
        # look-ahead bias — today's close must exceed yesterday's 20-bar high)
        df["roll_high"] = df["high"].shift(1).rolling(lb).max()

        # Rolling 20-period low (used for bearish breakout / breakdown)
        df["roll_low"]  = df["low"].shift(1).rolling(lb).min()

        # Volume: 20-period simple moving average
        df["vol_avg"]   = df["volume"].rolling(lb).mean()

        return df

    # ------------------------------------------------------------------
    # Indicator scorers  (-1 / 0 / +1)
    # ------------------------------------------------------------------

    def _score_rsi(self, row: pd.Series) -> int:
        """
        +1  RSI > rsi_overbought  (momentum strongly bullish)
        -1  RSI < rsi_oversold    (momentum strongly bearish)
         0  neutral zone
        """
        rsi = row["rsi"]
        if pd.isna(rsi):
            return 0
        if rsi > self.cfg["rsi_overbought"]:
            return 1
        if rsi < self.cfg["rsi_oversold"]:
            return -1
        return 0

    def _score_ema(self, row: pd.Series) -> int:
        """
        +1  EMA(9) > EMA(20)  — fast above slow (bullish crossover)
        -1  EMA(9) < EMA(20)  — fast below slow (bearish crossover)
         0  equal or NaN
        """
        fast = row["ema_fast"]
        slow = row["ema_slow"]
        if pd.isna(fast) or pd.isna(slow):
            return 0
        if fast > slow:
            return 1
        if fast < slow:
            return -1
        return 0

    def _score_breakout(self, row: pd.Series) -> int:
        """
        Bullish breakout (+1):
            close > 20-period rolling high  AND  volume > vol_avg × multiplier

        Bearish breakout / breakdown (-1):
            close < 20-period rolling low   AND  volume > vol_avg × multiplier

        0 otherwise.
        """
        close    = row["close"]
        roll_hi  = row["roll_high"]
        roll_lo  = row["roll_low"]
        volume   = row["volume"]
        vol_avg  = row["vol_avg"]
        mult     = self.cfg["breakout_volume_mult"]

        if pd.isna(roll_hi) or pd.isna(vol_avg):
            return 0

        volume_spike = (vol_avg > 0) and (volume >= mult * vol_avg)

        if close > roll_hi and volume_spike:
            return 1
        if close < roll_lo and volume_spike:
            return -1
        return 0

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _wait_result(entry: float) -> SignalResult:
        return SignalResult(
            direction="WAIT",
            entry=entry,
            stop_loss=0.0,
            take_profit=0.0,
            confidence=0.0,
            score=0,
            rsi=float("nan"),
            rsi_signal=0,
            ema_fast=float("nan"),
            ema_slow=float("nan"),
            ema_signal=0,
            breakout_signal=0,
            atr=0.0,
        )


# ---------------------------------------------------------------------------
# Convenience module-level singleton
# ---------------------------------------------------------------------------

# One shared engine with default parameters; importers can instantiate their
# own if they need custom periods.
default_engine = SignalEngine()
