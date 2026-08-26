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

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize Lightweight Chart v5
    const chart = createChart(chartContainerRef.current, {
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

    // Format, deduplicate and sort data for lightweight-charts (timestamps must be strictly ascending)
    const candleMap = new Map<number, CandleData>();
    data.forEach((c) => {
      if (c && c.time && !isNaN(c.time)) {
        candleMap.set(c.time, c);
      }
    });
    const sortedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);

    const formattedCandles = sortedCandles.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
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
      value: c.volume,
      color: c.close >= c.open ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 23, 68, 0.25)',
    }));

    volumeSeries.setData(formattedVolume);

    // Render Target Lines (Entry, TP, SL)
    if (entryPrice) {
      candlestickSeries.createPriceLine({
        price: entryPrice,
        color: '#38bdf8',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `ENTRY $${entryPrice.toLocaleString()}`,
      });
    }

    if (takeProfitPrice) {
      candlestickSeries.createPriceLine({
        price: takeProfitPrice,
        color: '#00e676',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP $${takeProfitPrice.toLocaleString()}`,
      });
    }

    if (stopLossPrice) {
      candlestickSeries.createPriceLine({
        price: stopLossPrice,
        color: '#ff1744',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL $${stopLossPrice.toLocaleString()}`,
      });
    }

    chart.timeScale().fitContent();

    // Responsive resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, entryPrice, stopLossPrice, takeProfitPrice, symbol]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#090d16] rounded-xl border border-[#1e2638] overflow-hidden">
      {/* Chart Top Header Overlay */}
      <div className="absolute top-3 left-4 z-10 flex items-center space-x-4 pointer-events-none">
        <div className="flex items-center space-x-2 bg-[#121824]/90 backdrop-blur border border-[#253046] px-3 py-1 rounded-lg">
          <span className="font-bold text-white text-sm">{symbol}</span>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            1M
          </span>
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
