import React, { useState } from 'react';
import { Terminal, Play, Sparkles, BarChart3 } from 'lucide-react';

export interface BacktestResults {
  parsedRule: string;
  winRate: number;
  totalReturn: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdown: number;
}

interface StrategyInputBoxProps {
  onRunBacktest: (promptText: string) => void;
  backtestResults: BacktestResults | null;
}

const PRESET_RULES = [
  'buy when RSI under 30 and price above 200 EMA',
  'sell when RSI above 70 and EMA 9 drops below EMA 20',
  'buy on breakout above 20 period high with 1.5x volume',
];

export const StrategyInputBox: React.FC<StrategyInputBoxProps> = ({
  onRunBacktest,
  backtestResults,
}) => {
  const [prompt, setPrompt] = useState('buy when RSI under 30 and price above 200 EMA');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRun = () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onRunBacktest(prompt);
    }, 800);
  };

  return (
    <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-4 flex flex-col justify-between shadow-xl select-none">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
              Plain-English Strategy Engine
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            NLP Parser
          </span>
        </div>

        {/* Text Input */}
        <div className="relative mb-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Type your trading rule, e.g. 'buy when RSI under 30 and price above 200 EMA'..."
            className="w-full bg-[#0a0e17] border border-[#212b40] focus:border-cyan-500 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-500 outline-none resize-none transition-colors"
          />
          <button
            onClick={handleRun}
            disabled={isProcessing}
            className="absolute bottom-2.5 right-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-md shadow-cyan-500/20"
          >
            {isProcessing ? (
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Backtest</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Preset Strategies</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_RULES.map((rule, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(rule)}
                className="text-[10px] font-mono bg-[#141c2c] hover:bg-[#1c273e] text-slate-300 border border-[#222f47] px-2 py-1 rounded transition-colors"
              >
                "{rule}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Backtest Results Card */}
      {backtestResults && (
        <div className="bg-[#090d16] border border-[#1b2436] rounded-lg p-3 text-xs">
          <div className="flex items-center justify-between mb-2 text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
            <span className="flex items-center space-x-1">
              <BarChart3 className="w-3 h-3 text-emerald-400" />
              <span>Backtest Performance (200 Candles)</span>
            </span>
            <span className="text-emerald-400 font-mono font-bold">100% Simulated</span>
          </div>

          <div className="grid grid-cols-4 gap-2 font-mono text-center">
            <div className="bg-[#121927] p-2 rounded border border-[#1e293d]">
              <div className="text-[9px] text-slate-400 uppercase">Win Rate</div>
              <div className="text-xs font-bold text-emerald-400">{backtestResults.winRate}%</div>
            </div>
            <div className="bg-[#121927] p-2 rounded border border-[#1e293d]">
              <div className="text-[9px] text-slate-400 uppercase">Total Return</div>
              <div className="text-xs font-bold text-cyan-400">+{backtestResults.totalReturn}%</div>
            </div>
            <div className="bg-[#121927] p-2 rounded border border-[#1e293d]">
              <div className="text-[9px] text-slate-400 uppercase">Profit Factor</div>
              <div className="text-xs font-bold text-slate-200">{backtestResults.profitFactor}</div>
            </div>
            <div className="bg-[#121927] p-2 rounded border border-[#1e293d]">
              <div className="text-[9px] text-slate-400 uppercase">Max DD</div>
              <div className="text-xs font-bold text-rose-400">-{backtestResults.maxDrawdown}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
