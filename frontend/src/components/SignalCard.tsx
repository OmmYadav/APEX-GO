import React, { useState } from 'react';
import { ShieldCheck, Target, AlertTriangle, ArrowUpRight, ArrowDownRight, Zap, CheckCircle2 } from 'lucide-react';

export interface SignalData {
  direction: 'LONG' | 'SHORT' | 'WAIT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  indicators: {
    rsi: number;
    rsiSignal: number;
    emaFast: number;
    emaSlow: number;
    emaSignal: number;
    breakoutSignal: number;
  };
}

interface SignalCardProps {
  symbol: string;
  signal: SignalData;
  onExecuteTrade: () => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ symbol, signal, onExecuteTrade }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState(false);

  const isLong = signal.direction === 'LONG';
  const isShort = signal.direction === 'SHORT';
  const isWait = signal.direction === 'WAIT';

  const handleTradeClick = () => {
    setIsExecuting(true);
    setTradeSuccess(false);
    setTimeout(() => {
      setIsExecuting(false);
      setTradeSuccess(true);
      onExecuteTrade();
      setTimeout(() => setTradeSuccess(false), 4000);
    }, 1200);
  };

  return (
    <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden select-none">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
              Live Signal Radar
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-[#161d2d] px-2 py-0.5 rounded border border-[#253046]">
            {symbol}
          </span>
        </div>

        {/* Direction Badge */}
        <div
          className={`rounded-xl p-3.5 border flex items-center justify-between mb-4 transition-all ${
            isLong
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10'
              : isShort
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-lg shadow-rose-500/10'
              : 'bg-slate-800/40 border-slate-700/40 text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                isLong
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                  : isShort
                  ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/30'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {isLong ? <ArrowUpRight className="w-6 h-6 stroke-[3]" /> : isShort ? <ArrowDownRight className="w-6 h-6 stroke-[3]" /> : '–'}
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-wide uppercase font-mono">{signal.direction}</div>
              <div className="text-[11px] opacity-80 font-medium">
                {isLong ? 'Bullish Trend Alignment' : isShort ? 'Bearish Breakout Active' : 'Consolidating — Await Trigger'}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Confidence</div>
            <div className="text-lg font-mono font-bold">{Math.round(signal.confidence * 100)}%</div>
          </div>
        </div>

        {/* Targets & Levels Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4 font-mono">
          <div className="bg-[#141b2b] border border-[#212b40] p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>Entry</span>
            </div>
            <div className="text-sm font-bold text-cyan-400">${signal.entry.toLocaleString()}</div>
          </div>

          <div className="bg-[#141b2b] border border-[#212b40] p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <Target className="w-3 h-3 text-emerald-400" />
              <span>Target (2:1)</span>
            </div>
            <div className="text-sm font-bold text-emerald-400">
              {signal.takeProfit > 0 ? `$${signal.takeProfit.toLocaleString()}` : '—'}
            </div>
          </div>

          <div className="bg-[#141b2b] border border-[#212b40] p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Stop Loss</span>
            </div>
            <div className="text-sm font-bold text-rose-400">
              {signal.stopLoss > 0 ? `$${signal.stopLoss.toLocaleString()}` : '—'}
            </div>
          </div>
        </div>

        {/* Indicator Breakdown Chips */}
        <div className="space-y-1.5 text-xs bg-[#121826] border border-[#1e273a] p-3 rounded-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Technical Indicators</div>
          <div className="flex items-center justify-between text-slate-300">
            <span>RSI (14)</span>
            <span className={`font-mono font-semibold ${signal.indicators.rsi > 60 ? 'text-emerald-400' : signal.indicators.rsi < 40 ? 'text-rose-400' : 'text-slate-400'}`}>
              {signal.indicators.rsi} ({signal.indicators.rsi > 60 ? 'Bullish' : signal.indicators.rsi < 40 ? 'Bearish' : 'Neutral'})
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>EMA (9/20) Crossover</span>
            <span className="font-mono font-semibold text-emerald-400">
              {signal.indicators.emaFast > signal.indicators.emaSlow ? 'Golden Cross' : 'Death Cross'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Volume Spike</span>
            <span className="font-mono font-semibold text-cyan-400">1.8x Avg Volume</span>
          </div>
        </div>
      </div>

      {/* Trade Execution Button */}
      <div className="mt-4">
        {tradeSuccess && (
          <div className="mb-2 p-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Bracket Order submitted to Delta Testnet!</span>
          </div>
        )}

        <button
          onClick={handleTradeClick}
          disabled={isWait || isExecuting}
          className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg ${
            isWait
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : isLong
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 active:scale-[0.98]'
              : 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-rose-500/25 active:scale-[0.98]'
          }`}
        >
          {isExecuting ? (
            <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Execute {signal.direction} Bracket Order (Delta Testnet)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
