import React, { useState } from 'react';
import { Newspaper, ChevronUp, ChevronDown } from 'lucide-react';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  url: string;
}

interface AlertsNewsFeedProps {
  news: NewsItem[];
}

export const AlertsNewsFeed: React.FC<AlertsNewsFeedProps> = ({ news }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="bg-[#0b0f19] border-t border-[#1e2638] select-none">
      {/* Header Bar */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs hover:bg-[#121824] transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Newspaper className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
            Live Market Radar & Intelligence Feed
          </span>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono">
            {news.length} Headlines
          </span>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span className="text-[10px]">{isCollapsed ? 'Expand' : 'Collapse'}</span>
          {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Feed Content */}
      {!isCollapsed && (
        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3 max-h-36 overflow-y-auto no-scrollbar">
          {news.map((item) => {
            const isBullish = item.sentiment === 'BULLISH';
            const isBearish = item.sentiment === 'BEARISH';

            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="bg-[#121722] hover:bg-[#182030] border border-[#1f283a] p-2.5 rounded-lg flex flex-col justify-between transition-colors group"
              >
                <div className="text-xs text-slate-200 font-medium group-hover:text-cyan-300 transition-colors line-clamp-2 mb-2">
                  {item.title}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-300">{item.source}</span>
                    <span>• {item.timeAgo}</span>
                  </div>

                  <span
                    className={`font-mono font-semibold px-1.5 py-0.5 rounded text-[9px] ${
                      isBullish
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : isBearish
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-slate-700/30 text-slate-400'
                    }`}
                  >
                    {item.sentiment}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};
