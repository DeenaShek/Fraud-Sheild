import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Radar, 
  SearchCode, 
  ShieldCheck, 
  Settings2, 
  Lock, 
  Layers, 
  Activity, 
  Users, 
  FileText,
  Send,
  Wallet
} from 'lucide-react';

export function Sidebar({ activeView, setActiveView }) {
  const { user, isAdmin } = useAuth();

  const navItems = [
    {
      id: 'detection',
      label: 'Detection Center',
      sublabel: 'Real-time telemetry & alerts',
      icon: Radar,
      color: 'text-cyan-400',
      badge: 'Live',
      allowed: true
    },
    {
      id: 'sender',
      label: 'Live Sender View',
      sublabel: 'Judge interactive transfer & anomaly flags',
      icon: Send,
      color: 'text-cyan-300',
      badge: 'Judge Demo',
      allowed: true
    },
    {
      id: 'receiver',
      label: 'Live Receiver Ledger',
      sublabel: 'Instant balance & fraud hold interceptor',
      icon: Wallet,
      color: 'text-emerald-400',
      badge: 'Live P2P',
      allowed: true
    },
    {
      id: 'investigation',
      label: 'Investigation Workspace',
      sublabel: '360° forensic dossier & SHAP explainability',
      icon: SearchCode,
      color: 'text-amber-400',
      allowed: true
    },
    {
      id: 'admin',
      label: 'Admin Portal',
      sublabel: 'Rule config, thresholds, ML',
      icon: Settings2,
      color: 'text-purple-400',
      requiresAdmin: true,
      allowed: isAdmin
    }
  ];

  return (
    <aside className="w-64 shrink-0 bg-slate-950 border-r border-slate-800/80 p-4 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-65px)]">
      <div>
        
        {/* Section Header */}
        <div className="px-3 pb-3 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
          Navigation Portals
        </div>

        {/* Navigation Items */}
        <div className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const isLocked = item.requiresAdmin && !isAdmin;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isLocked) setActiveView(item.id);
                }}
                disabled={isLocked}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-slate-900 border border-slate-700 shadow-md text-white'
                    : isLocked
                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div className={`p-2 rounded-lg ${isActive ? 'bg-slate-800' : 'bg-slate-900/80'} ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-200'}`}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                        {item.badge}
                      </span>
                    )}
                    {isLocked && (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {item.sublabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Engine Specs Card */}
        <div className="mt-8 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200 mb-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Deterministic Core</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-400 font-mono">
            <div className="flex justify-between">
              <span>Rule Max Points:</span>
              <span className="text-cyan-400 font-bold">100 pts</span>
            </div>
            <div className="flex justify-between">
              <span>Explainable Rules:</span>
              <span className="text-slate-300">6 Active</span>
            </div>
            <div className="flex justify-between">
              <span>ML Probability:</span>
              <span className="text-purple-400">Random Forest</span>
            </div>
            <div className="flex justify-between">
              <span>RAG Grounding:</span>
              <span className="text-emerald-400">7 Policies</span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Role Indicator */}
      <div className="pt-4 border-t border-slate-800/80">
        <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
          <span>Active Role:</span>
          <span className="text-slate-300 font-semibold">{user?.role}</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between mt-1">
          <span>Security Badge:</span>
          <span className="text-slate-400">{user?.badgeId}</span>
        </div>
      </div>
    </aside>
  );
}
