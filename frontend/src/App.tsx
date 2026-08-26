import { useState } from 'react';
import { Header } from './components/Header';
import { WatchlistStrip, type WatchlistItem } from './components/WatchlistStrip';
import { CandlestickChart, type CandleData } from './components/CandlestickChart';
import { SignalCard, type SignalData } from './components/SignalCard';
import { StrategyInputBox, type BacktestResults } from './components/StrategyInputBox';
import { AlertsNewsFeed, type NewsItem } from './components/AlertsNewsFeed';

// Mock Watchlist Data
const MOCK_WATCHLIST: WatchlistItem[] = [
  { symbol: 'BTCUSD', name: 'Bitcoin', price: 80729.5, change24h: 2.45, volume24h: '$34.2B' },
  { symbol: 'ETHUSD', name: 'Ethereum', price: 3145.8, change24h: -1.12, volume24h: '$18.6B' },
  { symbol: 'SOLUSD', name: 'Solana', price: 188.4, change24h: 5.64, volume24h: '$6.8B' },
  { symbol: 'XRPUSD', name: 'Ripple', price: 0.624, change24h: 1.85, volume24h: '$2.1B' },
  { symbol: 'DOGEUSD', name: 'Dogecoin', price: 0.142, change24h: -0.45, volume24h: '$1.4B' },
  { symbol: 'AVAXUSD', name: 'Avalanche', price: 28.95, change24h: 3.18, volume24h: '$840M' },
  { symbol: 'LINKUSD', name: 'Chainlink', price: 14.82, change24h: 0.92, volume24h: '$520M' },
];

// Helper to generate 80 realistic OHLCV candles
const generateMockCandles = (basePrice: number): CandleData[] => {
  const candles: CandleData[] = [];
  let currentPrice = basePrice * 0.96;
  const nowSec = Math.floor(Date.now() / 1000);
  const intervalSec = 60; // 1m candles

  for (let i = 80; i >= 0; i--) {
    const time = nowSec - i * intervalSec;
    const volatility = currentPrice * 0.004;
    const change = (Math.random() - 0.47) * volatility;
    const open = currentPrice;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.6;
    const low = Math.min(open, close) - Math.random() * volatility * 0.6;
    const volume = Math.floor(Math.random() * 5000 + 1200);

    candles.push({ time, open, high, low, close, volume });
    currentPrice = close;
  }
  return candles;
};

// Initial Mock Signals per Symbol
const MOCK_SIGNALS: Record<string, SignalData> = {
  BTCUSD: {
    direction: 'LONG',
    entry: 80729.5,
    stopLoss: 80645.0,
    takeProfit: 80898.4,
    confidence: 0.78,
    indicators: {
      rsi: 64.2,
      rsiSignal: 1,
      emaFast: 80720.0,
      emaSlow: 80680.0,
      emaSignal: 1,
      breakoutSignal: 1,
    },
  },
  ETHUSD: {
    direction: 'SHORT',
    entry: 3145.8,
    stopLoss: 3175.0,
    takeProfit: 3087.4,
    confidence: 0.64,
    indicators: {
      rsi: 38.5,
      rsiSignal: -1,
      emaFast: 3140.0,
      emaSlow: 3152.0,
      emaSignal: -1,
      breakoutSignal: 0,
    },
  },
  SOLUSD: {
    direction: 'LONG',
    entry: 188.4,
    stopLoss: 184.2,
    takeProfit: 196.8,
    confidence: 0.86,
    indicators: {
      rsi: 71.4,
      rsiSignal: 1,
      emaFast: 188.0,
      emaSlow: 182.5,
      emaSignal: 1,
      breakoutSignal: 1,
    },
  },
};

// Default fallback signal for other symbols
const DEFAULT_SIGNAL: SignalData = {
  direction: 'WAIT',
  entry: 100.0,
  stopLoss: 95.0,
  takeProfit: 110.0,
  confidence: 0.33,
  indicators: {
    rsi: 50.0,
    rsiSignal: 0,
    emaFast: 100.0,
    emaSlow: 100.0,
    emaSignal: 0,
    breakoutSignal: 0,
  },
};

// Mock News Feed Data
const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Bitcoin Surges Past $80k as Institutional Inflows Hit 6-Month High',
    source: 'CoinDesk',
    timeAgo: '4m ago',
    sentiment: 'BULLISH',
    url: 'https://coindesk.com',
  },
  {
    id: '2',
    title: 'Delta Exchange India Volume Crosses $1.2B Futures Daily Run-rate',
    source: 'CryptoPanic',
    timeAgo: '18m ago',
    sentiment: 'BULLISH',
    url: 'https://cryptopanic.com',
  },
  {
    id: '3',
    title: 'Ethereum Gas Fees Drop Below 8 Gwei Following Dencun Scaling Upgrades',
    source: 'CoinTelegraph',
    timeAgo: '35m ago',
    sentiment: 'NEUTRAL',
    url: 'https://cointelegraph.com',
  },
];

export function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');

  const selectedWatchlistItem =
    MOCK_WATCHLIST.find((w) => w.symbol === selectedSymbol) || MOCK_WATCHLIST[0];

  const candleData = generateMockCandles(selectedWatchlistItem.price);
  const currentSignal = MOCK_SIGNALS[selectedSymbol] || {
    ...DEFAULT_SIGNAL,
    entry: selectedWatchlistItem.price,
    stopLoss: selectedWatchlistItem.price * 0.985,
    takeProfit: selectedWatchlistItem.price * 1.03,
  };

  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>({
    parsedRule: 'RSI < 30 AND PRICE > EMA(200)',
    winRate: 68.4,
    totalReturn: 42.8,
    totalTrades: 38,
    profitFactor: 2.14,
    maxDrawdown: 6.2,
  });

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
    console.log('Testnet trade executed for', selectedSymbol);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080a0f] text-slate-200 overflow-hidden font-sans">
      {/* 1. Header */}
      <Header
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
        symbols={MOCK_WATCHLIST.map((w) => w.symbol)}
        currentPrice={selectedWatchlistItem.price}
        priceChange24h={selectedWatchlistItem.change24h}
      />

      {/* 2. Watchlist Ticker Strip */}
      <WatchlistStrip
        items={MOCK_WATCHLIST}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />

      {/* 3. Main Dashboard Workspace (Chart + Right Panel) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left / Center: Candlestick Chart View */}
        <div className="lg:col-span-8 h-full flex flex-col min-h-[440px]">
          <CandlestickChart
            symbol={selectedSymbol}
            data={candleData}
            entryPrice={currentSignal.entry}
            takeProfitPrice={currentSignal.takeProfit}
            stopLossPrice={currentSignal.stopLoss}
            direction={currentSignal.direction}
          />
        </div>

        {/* Right Panel: Signal Card & Strategy Input */}
        <div className="lg:col-span-4 h-full flex flex-col space-y-3 overflow-y-auto no-scrollbar">
          {/* Signal Radar */}
          <SignalCard
            symbol={selectedSymbol}
            signal={currentSignal}
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
      <AlertsNewsFeed news={MOCK_NEWS} />
    </div>
  );
}

export default App;
