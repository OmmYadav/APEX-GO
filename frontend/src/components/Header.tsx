import React from 'react';
import { Activity, ChevronDown, Cpu } from 'lucide-react';

interface HeaderProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  symbols: string[];
  currentPrice: number;
  priceChange24h: number;
}

export const Header: React.FC<HeaderProps> = ({
  selectedSymbol,
  onSelectSymbol,
  symbols,
  currentPrice,
  priceChange24h,
}) => {
  const isPositive = priceChange24h >= 0;

  return (
    <header className="h-14 bg-[#0d1117] border-b border-[#1e2638] px-4 flex items-center justify-between text-xs select-none">
      {/* Brand & Market Selector */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-[#090d14] rounded-[7px] flex items-center justify-center">
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold tracking-wider text-sm bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                APEX
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                AI 2.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 -mt-0.5">Quant Trading Engine</p>
          </div>
        </div>

        {/* Pair Selector Dropdown */}
        <div className="relative group">
          <button className="flex items-center space-x-2 bg-[#161b26] hover:bg-[#1f2738] border border-[#2a3449] px-3 py-1.5 rounded-md transition-colors text-white font-medium">
            <span className="text-emerald-400 font-semibold">{selectedSymbol}</span>
            <span className="text-slate-400 text-[10px]">PERP</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform group-hover:rotate-180" />
          </button>
          
          <div className="absolute left-0 mt-1 w-44 bg-[#161b26] border border-[#2a3449] rounded-md shadow-xl py-1 hidden group-hover:block z-50">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-[#2a3449]">
              Delta Exchange India
            </div>
            {symbols.map((sym) => (
              <button
                key={sym}
                onClick={() => onSelectSymbol(sym)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#212a3d] transition-colors ${
                  sym === selectedSymbol ? 'text-emerald-400 font-semibold bg-[#1a2336]' : 'text-slate-300'
                }`}
              >
                <span>{sym}</span>
                <span className="text-[10px] text-slate-500">USDT</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ticker Price Header Data */}
        <div className="hidden md:flex items-center space-x-6 border-l border-[#1e2638] pl-6">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Mark Price</div>
            <div className="text-sm font-mono font-bold text-white">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">24h Change</div>
            <div className={`text-xs font-mono font-semibold flex items-center space-x-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span>{isPositive ? '+' : ''}{priceChange24h.toFixed(2)}%</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">24h High / Low</div>
            <div className="text-xs font-mono text-slate-300">
              ${(currentPrice * 1.023).toFixed(1)} / ${(currentPrice * 0.978).toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-[11px] font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Delta Testnet Live</span>
        </div>

        <button className="flex items-center space-x-1.5 bg-[#1a2233] hover:bg-[#253047] border border-[#2a3449] px-2.5 py-1 rounded text-slate-300 transition-colors">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Latency: 24ms</span>
        </button>
      </div>
    </header>
  );
};
