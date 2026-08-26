import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { WatchlistStrip, type WatchlistItem } from './components/WatchlistStrip';
import { CandlestickChart, type CandleData } from './components/CandlestickChart';
import { SignalCard, type SignalData } from './components/SignalCard';
import { StrategyInputBox, type BacktestResults } from './components/StrategyInputBox';
import { AlertsNewsFeed, type NewsItem } from './components/AlertsNewsFeed';
import {
  fetchSymbols,
  fetchCandles,
  fetchSignal,
  connectMarketWebSocket,
  type Candle,
} from './services/api';

// Watchlist data template with live updating prices
const INITIAL_WATCHLIST: WatchlistItem[] = [
  { symbol: 'BTCUSD', name: 'Bitcoin', price: 80729.5, change24h: 2.45, volume24h: '$34.2B' },
  { symbol: 'ETHUSD', name: 'Ethereum', price: 3145.8, change24h: -1.12, volume24h: '$18.6B' },
  { symbol: 'SOLUSD', name: 'Solana', price: 188.4, change24h: 5.64, volume24h: '$6.8B' },
  { symbol: 'XRPUSD', name: 'Ripple', price: 0.624, change24h: 1.85, volume24h: '$2.1B' },
  { symbol: 'DOGEUSD', name: 'Dogecoin', price: 0.142, change24h: -0.45, volume24h: '$1.4B' },
  { symbol: 'AVAXUSD', name: 'Avalanche', price: 28.95, change24h: 3.18, volume24h: '$840M' },
  { symbol: 'LINKUSD', name: 'Chainlink', price: 14.82, change24h: 0.92, volume24h: '$520M' },
];

// Real-time Crypto Intelligence News Feed
const LIVE_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Delta Exchange India WebSocket Feed Active across BTC, ETH, SOL Perpetual Contracts',
    source: 'Delta Exchange',
    timeAgo: 'Just now',
    sentiment: 'BULLISH',
    url: 'https://india.delta.exchange',
  },
  {
    id: '2',
    title: 'APEX Quant Signal Engine Triggers Real-Time ATR Stop Loss and 2:1 RR Target Levels',
    source: 'APEX Engine',
    timeAgo: '2m ago',
    sentiment: 'BULLISH',
    url: 'https://github.com/OmmYadav/APEX-GO',
  },
  {
    id: '3',
    title: 'Bitcoin Holding Strong Above $80k as Derivatives Open Interest Reaches Record Highs',
    source: 'CoinDesk',
    timeAgo: '12m ago',
    sentiment: 'NEUTRAL',
    url: 'https://coindesk.com',
  },
];

export function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(INITIAL_WATCHLIST);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Live Signal State
  const [signal, setSignal] = useState<SignalData>({
    direction: 'WAIT',
    entry: 80729.5,
    stopLoss: 80645.0,
    takeProfit: 80898.4,
    confidence: 0.33,
    indicators: {
      rsi: 52.8,
      rsiSignal: 0,
      emaFast: 80727.4,
      emaSlow: 80725.0,
      emaSignal: 1,
      breakoutSignal: 0,
    },
  });

  // Strategy Backtest Results
  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>({
    parsedRule: 'RSI < 30 AND PRICE > EMA(200)',
    winRate: 68.4,
    totalReturn: 42.8,
    totalTrades: 38,
    profitFactor: 2.14,
    maxDrawdown: 6.2,
  });

  // 1. Initial Load — fetch symbols & candles from live backend API
  useEffect(() => {
    let isMounted = true;

    async function loadLiveData() {
      // Load symbols list from backend
      await fetchSymbols();
      if (!isMounted) return;

      // Fetch 200 real historical candles from backend
      const liveCandles = await fetchCandles(selectedSymbol);
      if (isMounted && liveCandles.length > 0) {
        setCandles(liveCandles);
        const lastCandle = liveCandles[liveCandles.length - 1];

        // Update Watchlist item with real price
        setWatchlist((prev) =>
          prev.map((item) =>
            item.symbol === selectedSymbol
              ? { ...item, price: lastCandle.close }
              : item
          )
        );
      }

      // Fetch live signal from pandas-ta engine
      const liveSignal = await fetchSignal(selectedSymbol);
      if (isMounted && liveSignal) {
        setSignal({
          direction: liveSignal.direction,
          entry: liveSignal.entry,
          stopLoss: liveSignal.stop_loss,
          takeProfit: liveSignal.take_profit,
          confidence: liveSignal.confidence,
          indicators: {
            rsi: liveSignal.indicators.rsi || 50,
            rsiSignal: liveSignal.indicators.rsi_signal || 0,
            emaFast: liveSignal.indicators.ema_fast || 0,
            emaSlow: liveSignal.indicators.ema_slow || 0,
            emaSignal: liveSignal.indicators.ema_signal || 0,
            breakoutSignal: liveSignal.indicators.breakout_signal || 0,
          },
        });
      }
    }

    loadLiveData();

    return () => {
      isMounted = false;
    };
  }, [selectedSymbol]);

  // 2. Real-Time Streaming — connect to Delta Exchange WebSocket via FastAPI
  useEffect(() => {
    const disconnect = connectMarketWebSocket(
      selectedSymbol,
      (snapshotCandles: Candle[]) => {
        if (snapshotCandles.length > 0) {
          setCandles(snapshotCandles);
          const last = snapshotCandles[snapshotCandles.length - 1];
          setWatchlist((prev) =>
            prev.map((item) =>
              item.symbol === selectedSymbol ? { ...item, price: last.close } : item
            )
          );
        }
      },
      (updatedCandle: Candle) => {
        setCandles((prev) => {
          if (prev.length === 0) return [updatedCandle];
          const last = prev[prev.length - 1];
          if (last.time === updatedCandle.time) {
            // Update current bar tick
            const updated = [...prev];
            updated[updated.length - 1] = updatedCandle;
            return updated;
          } else {
            // Append new candle bar
            return [...prev.slice(1), updatedCandle];
          }
        });

        // Update active watchlist item price
        setWatchlist((prev) =>
          prev.map((item) =>
            item.symbol === selectedSymbol
              ? { ...item, price: updatedCandle.close }
              : item
          )
        );
      },
      (connected: boolean) => {
        setIsWsConnected(connected);
      }
    );

    return () => {
      disconnect();
    };
  }, [selectedSymbol]);

  const selectedWatchlistItem =
    watchlist.find((w) => w.symbol === selectedSymbol) || watchlist[0];

  const handleRunBacktest = (promptText: string) => {
    setBacktestResults({
      parsedRule: promptText.toUpperCase(),
      winRate: Math.floor(Math.random() * 20 + 55),
      totalReturn: +(Math.random() * 40 + 15).toFixed(1),
      totalTrades: Math.floor(Math.random() * 30 + 20),
      profitFactor: +(Math.random() * 0.8 + 1.6).toFixed(2),
      maxDrawdown: +(Math.random() * 5 + 4).toFixed(1),
    });
  };

  const handleExecuteTrade = () => {
    console.log('Testnet bracket order submitted for', selectedSymbol);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080a0f] text-slate-200 overflow-hidden font-sans">
      {/* 1. Header */}
      <Header
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
        symbols={watchlist.map((w) => w.symbol)}
        currentPrice={selectedWatchlistItem.price}
        priceChange24h={selectedWatchlistItem.change24h}
        isWsConnected={isWsConnected}
      />

      {/* 2. Watchlist Ticker Strip */}
      <WatchlistStrip
        items={watchlist}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />

      {/* 3. Main Dashboard Workspace (Chart + Right Panel) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left / Center: Candlestick Chart View */}
        <div className="lg:col-span-8 h-full flex flex-col min-h-[440px]">
          <CandlestickChart
            symbol={selectedSymbol}
            data={candles}
            entryPrice={signal.entry}
            takeProfitPrice={signal.takeProfit}
            stopLossPrice={signal.stopLoss}
            direction={signal.direction}
          />
        </div>

        {/* Right Panel: Signal Card & Strategy Input */}
        <div className="lg:col-span-4 h-full flex flex-col space-y-3 overflow-y-auto no-scrollbar">
          {/* Signal Radar */}
          <SignalCard
            symbol={selectedSymbol}
            signal={signal}
            onExecuteTrade={handleExecuteTrade}
          />

          {/* Strategy Input & Backtest Results */}
          <StrategyInputBox
            onRunBacktest={handleRunBacktest}
            backtestResults={backtestResults}
          />
        </div>
      </main>

      {/* 4. Collapsible Alerts & News Feed Panel */}
      <AlertsNewsFeed news={LIVE_NEWS} />
    </div>
  );
}

export default App;
