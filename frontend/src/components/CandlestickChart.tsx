import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
} from 'lightweight-charts';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  symbol: string;
  data: CandleData[];
  entryPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  direction?: 'LONG' | 'SHORT' | 'WAIT';
}

function getBasePriceForSymbol(symbol: string): number {
  const cleanSymbol = symbol.toUpperCase();
  if (cleanSymbol.startsWith('BTC')) return 80700;
  if (cleanSymbol.startsWith('ETH')) return 3145;
  if (cleanSymbol.startsWith('SOL')) return 188;
  if (cleanSymbol.startsWith('XRP')) return 0.62;
  if (cleanSymbol.startsWith('DOGE')) return 0.14;
  if (cleanSymbol.startsWith('AVAX')) return 28.9;
  if (cleanSymbol.startsWith('LINK')) return 14.8;
  return 100;
}

function generateMockCandles(symbol: string): CandleData[] {
  const list: CandleData[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const basePrice = getBasePriceForSymbol(symbol);
  
  let price = basePrice;
  // Generate 200 historical 1m candles
  for (let i = 199; i >= 0; i--) {
    const time = nowSec - i * 60;
    const bucketedTime = Math.floor(time / 60) * 60;
    
    const change = (Math.random() - 0.5) * (price * 0.004);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * (price * 0.0015);
    const low = Math.min(open, close) - Math.random() * (price * 0.0015);
    const volume = Math.floor(Math.random() * 500 + 50);
    
    list.push({
      time: bucketedTime,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Number(volume.toFixed(2)),
    });
    
    price = close;
  }
  return list;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol,
  data,
  entryPrice,
  stopLossPrice,
  takeProfitPrice,
  direction = 'LONG',
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Check if we have valid backend data
  const isLiveData = data && data.length > 0;
  const activeData = isLiveData ? data : generateMockCandles(symbol);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    let chart: IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const initChart = () => {
      if (chart) return; // Already initialized

      const width = container.clientWidth;
      const height = container.clientHeight || 420;

      if (width === 0 || height === 0) return;

      chart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: '#090d16' },
          textColor: '#8b949e',
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        },
        grid: {
          vertLines: { color: '#161d2b' },
          horzLines: { color: '#161d2b' },
        },
        crosshair: {
          vertLine: { color: '#38bdf8', width: 1, style: LineStyle.Dashed },
          horzLine: { color: '#38bdf8', width: 1, style: LineStyle.Dashed },
        },
        rightPriceScale: {
          borderColor: '#1e2638',
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        timeScale: {
          borderColor: '#1e2638',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;

      // Add Candlestick Series (v5 API)
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00e676',
        downColor: '#ff1744',
        borderVisible: false,
        wickUpColor: '#00e676',
        wickDownColor: '#ff1744',
      });

      // Deduplicate and sort data
      const candleMap = new Map<number, CandleData>();
      activeData.forEach((c) => {
        if (c && c.time && !isNaN(c.time)) {
          candleMap.set(c.time, c);
        }
      });
      const sortedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);

      const formattedCandles = sortedCandles.map((c) => ({
        time: c.time as any,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));

      candlestickSeries.setData(formattedCandles);

      // Add Volume Histogram Series (v5 API)
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      const formattedVolume = sortedCandles.map((c) => ({
        time: c.time as any,
        value: Number(c.volume),
        color: c.close >= c.open ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 23, 68, 0.25)',
      }));

      volumeSeries.setData(formattedVolume);

      // Render Target Lines (Entry, TP, SL)
      if (entryPrice) {
        candlestickSeries.createPriceLine({
          price: Number(entryPrice),
          color: '#38bdf8',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `ENTRY $${entryPrice.toLocaleString()}`,
        });
      }

      if (takeProfitPrice) {
        candlestickSeries.createPriceLine({
          price: Number(takeProfitPrice),
          color: '#00e676',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP $${takeProfitPrice.toLocaleString()}`,
        });
      }

      if (stopLossPrice) {
        candlestickSeries.createPriceLine({
          price: Number(stopLossPrice),
          color: '#ff1744',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL $${stopLossPrice.toLocaleString()}`,
        });
      }

      chart.timeScale().fitContent();
    };

    // Try starting immediately
    initChart();

    // Set up ResizeObserver to handle element layout changes & defer initialization if dimensions start at 0
    resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;

      if (width > 0 && height > 0) {
        if (!chart) {
          initChart();
        } else {
          chart.applyOptions({ width, height });
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chart) {
        chart.remove();
        chartRef.current = null;
      }
    };
  }, [activeData, entryPrice, stopLossPrice, takeProfitPrice, symbol]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#090d16] rounded-xl border border-[#1e2638] overflow-hidden">
      {/* Chart Top Header Overlay */}
      <div className="absolute top-3 left-4 z-10 flex items-center space-x-3 pointer-events-none">
        <div className="flex items-center space-x-2 bg-[#121824]/90 backdrop-blur border border-[#253046] px-3 py-1 rounded-lg">
          <span className="font-bold text-white text-sm">{symbol}</span>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            1M
          </span>
          {/* Status Label badge */}
          {isLiveData ? (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
              Live data
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
              Demo candles
            </span>
          )}
        </div>

        {direction !== 'WAIT' && (
          <div className="hidden sm:flex items-center space-x-3 text-[11px] font-mono bg-[#121824]/90 backdrop-blur border border-[#253046] px-3 py-1 rounded-lg">
            <span className="text-cyan-400 font-semibold">
              ENTRY: ${entryPrice?.toLocaleString()}
            </span>
            <span className="text-emerald-400 font-semibold">
              TP: ${takeProfitPrice?.toLocaleString()}
            </span>
            <span className="text-rose-400 font-semibold">
              SL: ${stopLossPrice?.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Canvas Mount Container */}
      <div ref={chartContainerRef} className="w-full h-full min-h-[420px]" />
    </div>
  );
};

