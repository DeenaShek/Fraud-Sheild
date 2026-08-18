import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, X, Sparkles, Shield } from 'lucide-react';

export function HowItWorksLegend({ defaultOpen = true, title = "How this works" }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => {
            setIsDismissed(false);
            setIsOpen(true);
          }}
          className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Show "How to Read Scores" Legend</span>
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel-elevated rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3.5 sm:p-4 shadow-lg transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span>{title}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Quick Guide
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Every transaction gets a risk score out of 100, based on <strong>6 checks</strong> (amount, device, location, speed, merchant, network).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            title={isOpen ? "Collapse legend" : "Expand legend"}
            aria-label={isOpen ? "Collapse legend" : "Expand legend"}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition-colors"
            title="Dismiss legend banner"
            aria-label="Dismiss legend banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
          
          {/* Low / Safe */}
          <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/50" />
            <div>
              <div className="font-bold text-emerald-400">0–30 pts • LOW</div>
              <div className="text-[11px] text-slate-400">Safe — Auto-settles instantly</div>
            </div>
          </div>

          {/* Medium / Watch */}
          <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0 shadow-sm shadow-amber-400/50" />
            <div>
              <div className="font-bold text-amber-400">31–60 pts • MEDIUM</div>
              <div className="text-[11px] text-slate-400">Watch — Telemetry monitored</div>
            </div>
          </div>

          {/* High / Needs Verification */}
          <div className="p-2 rounded-xl bg-orange-950/40 border border-orange-800/50 flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-orange-400 shrink-0 shadow-sm shadow-orange-400/50" />
            <div>
              <div className="font-bold text-orange-400">61–80 pts • HIGH</div>
              <div className="text-[11px] text-slate-400">Needs Verification — Step-up OTP</div>
            </div>
          </div>

          {/* Critical / Blocked */}
          <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-400 shrink-0 shadow-sm shadow-rose-400/50" />
            <div>
              <div className="font-bold text-rose-400">81–100 pts • CRITICAL</div>
              <div className="text-[11px] text-slate-400">Blocked — Intercepted before loss</div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
