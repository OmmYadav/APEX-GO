import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: string;
}

interface WatchlistStripProps {
  items: WatchlistItem[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const WatchlistStrip: React.FC<WatchlistStripProps> = ({
  items,
  selectedSymbol,
  onSelectSymbol,
}) => {
  return (
    <div className="bg-[#0b0f19] border-b border-[#1e2638] px-3 py-1.5 flex items-center space-x-3 overflow-x-auto no-scrollbar select-none">
      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex-shrink-0 pr-2 border-r border-[#1e2638]">
        Watchlist
      </span>
      {items.map((item) => {
        const isSelected = item.symbol === selectedSymbol;
        const isUp = item.change24h >= 0;

        return (
          <button
            key={item.symbol}
            onClick={() => onSelectSymbol(item.symbol)}
            className={`flex-shrink-0 flex items-center space-x-3 px-3 py-1 rounded-md transition-all text-xs border ${
              isSelected
                ? 'bg-[#162032] border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'bg-[#101522] border-[#1d2638] hover:border-[#2b3850]'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-200">{item.symbol}</span>
              <span className="text-[10px] text-slate-500">/USDT</span>
            </div>

            <div className="font-mono text-slate-300 font-medium">
              ${item.price < 1 ? item.price.toFixed(4) : item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>

            <div className={`flex items-center space-x-0.5 font-mono text-[11px] font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{isUp ? '+' : ''}{item.change24h.toFixed(2)}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
