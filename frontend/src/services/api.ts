/**
 * APEX Backend API & WebSocket Service
 * Connects frontend to the FastAPI live market feeds and signal engine.
 */

// Base API and WS URLs from env or default to localhost:8000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8000';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalResponse {
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'WAIT';
  entry: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  score: number;
  indicators: {
    rsi: number;
    rsi_signal: number;
    ema_fast: number;
    ema_slow: number;
    ema_signal: number;
    breakout_signal: number;
    atr: number;
  };
}

/**
 * Fetch tracked symbols list from FastAPI backend
 */
export async function fetchSymbols(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/market/symbols`);
    if (!res.ok) throw new Error('Failed to fetch symbols');
    const data = await res.json();
    return data.symbols || ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'AVAXUSD', 'LINKUSD'];
  } catch (err) {
    console.warn('Backend unavailable, falling back to default symbols:', err);
    return ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'AVAXUSD', 'LINKUSD'];
  }
}

/**
 * Fetch initial 200 candles from FastAPI backend
 */
export async function fetchCandles(symbol: string): Promise<Candle[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/market/candles?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) throw new Error('Failed to fetch candles');
    const data = await res.json();
    return data.candles || [];
  } catch (err) {
    console.warn(`Backend fetch failed for ${symbol}, using live fallback`, err);
    return [];
  }
}

/**
 * Fetch live computed signal from pandas-ta signal engine
 */
export async function fetchSignal(symbol: string): Promise<SignalResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/market/signal?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) throw new Error('Failed to fetch signal');
    return await res.json();
  } catch (err) {
    console.warn(`Signal fetch failed for ${symbol}`, err);
    return null;
  }
}

/**
 * Connect to live WebSocket candle stream from Delta Exchange India via FastAPI
 */
export function connectMarketWebSocket(
  symbol: string,
  onSnapshot: (candles: Candle[]) => void,
  onUpdate: (candle: Candle) => void,
  onStatusChange?: (connected: boolean) => void
): () => void {
  let ws: WebSocket | null = null;
  let isClosedIntentionally = false;
  let reconnectTimer: any = null;

  function connect() {
    const wsUrl = `${WS_BASE_URL}/api/market/ws/market?symbol=${encodeURIComponent(symbol)}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      onStatusChange?.(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'snapshot' && Array.isArray(msg.candles)) {
          onSnapshot(msg.candles);
        } else if (msg.type === 'update' && msg.candle) {
          onUpdate(msg.candle);
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error:', err);
      onStatusChange?.(false);
    };

    ws.onclose = () => {
      onStatusChange?.(false);
      if (!isClosedIntentionally) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };
  }

  connect();

  // Return cleanup function to disconnect
  return () => {
    isClosedIntentionally = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
  };
}
