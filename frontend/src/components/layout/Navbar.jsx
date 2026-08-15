import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../services/api';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Play, 
  Pause, 
  Zap, 
  Flame, 
  Radio, 
  LogOut, 
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

export function Navbar({ activeView, setActiveView, onSelectTransaction }) {
  const { user, logout, isAdmin } = useAuth();
  const { isConnected, simulatorStatus } = useSocket();
  const [isSimLoading, setIsSimLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const showToast = (msg, type = 'success') => {
    setFeedbackMsg({ text: msg, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleToggleSimulator = async () => {
    try {
      setIsSimLoading(true);
      if (simulatorStatus.isRunning) {
        await api.stopSimulator();
        showToast('Stream simulator paused.', 'info');
      } else {
        await api.startSimulator();
        showToast('Live transaction stream started.', 'success');
      }
    } catch (err) {
      showToast('Simulator action failed.', 'error');
    } finally {
      setIsSimLoading(false);
    }
  };

  const handleSpeedChange = async (speedMs) => {
    try {
      await api.setSimulatorSpeed(speedMs);
      showToast(`Stream rate set to 1 txn / ${speedMs / 1000}s`, 'info');
    } catch (err) {
      showToast('Failed to update stream speed.', 'error');
    }
  };

  const handleInjectWorkedExample = async () => {
    try {
      setIsSimLoading(true);
      const res = await api.injectWorkedExample();
      showToast('Worked Example (₹85k Dubai D999) injected!', 'critical');
      if (res?.result?.transaction) {
        onSelectTransaction(res.result.transaction.transactionId);
        setActiveView('investigation');
      }
    } catch (err) {
      showToast('Failed to inject worked example.', 'error');
    } finally {
      setIsSimLoading(false);
    }
  };

  const handleInjectMerchantAnomaly = async () => {
    try {
      setIsSimLoading(true);
      const res = await api.injectMerchantAnomaly();
      showToast('Merchant Anomaly (+10 pts, Clean Walkthrough) injected!', 'info');
      if (res?.result?.transaction) {
        onSelectTransaction(res.result.transaction.transactionId);
        setActiveView('investigation');
      }
    } catch (err) {
      showToast('Failed to inject merchant anomaly scenario.', 'error');
    } finally {
      setIsSimLoading(false);
    }
  };

  const handleInjectAttackWave = async () => {
    try {
      setIsSimLoading(true);
      const res = await api.injectAttackWave();
      showToast(`Injected attack wave (${res.count || 3} fraudulent bursts)!`, 'critical');
    } catch (err) {
      showToast('Failed to inject attack wave.', 'error');
    } finally {
      setIsSimLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="flex items-center justify-between gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-xl tracking-tight text-white">
                Fraud<span className="text-cyan-400">Shield</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800/60 rounded-md">
                v2.4 RT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Deterministic Engine & AI Investigation Platform
            </p>
          </div>
        </div>

        {/* Live Simulator Toolbar */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
          
          {/* Socket Indicator */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500 live-dot' : 'bg-rose-500'}`} />
            <span className="text-[11px] font-mono font-medium text-slate-300 hidden md:inline">
              {isConnected ? 'LIVE FEED' : 'OFFLINE'}
            </span>
          </div>

          {/* Play / Pause Toggle */}
          <button
            onClick={handleToggleSimulator}
            disabled={isSimLoading}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
              simulatorStatus.isRunning 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
            title={simulatorStatus.isRunning ? 'Pause Transaction Stream' : 'Start Transaction Stream'}
          >
            {simulatorStatus.isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Stream</span>
              </>
            )}
          </button>

          {/* Speed Selector */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 pl-1">
            <button
              onClick={() => handleSpeedChange(1000)}
              className={`px-1.5 py-0.5 rounded font-mono ${simulatorStatus.intervalMs === 1000 ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'hover:text-white'}`}
            >
              1s
            </button>
            <button
              onClick={() => handleSpeedChange(3000)}
              className={`px-1.5 py-0.5 rounded font-mono ${simulatorStatus.intervalMs === 3000 ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'hover:text-white'}`}
            >
              3s
            </button>
            <button
              onClick={() => handleSpeedChange(5000)}
              className={`px-1.5 py-0.5 rounded font-mono ${simulatorStatus.intervalMs === 5000 ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'hover:text-white'}`}
            >
              5s
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Clean Walkthrough Scenario: Merchant Anomaly Only (+10 pts) */}
          <button
            onClick={handleInjectMerchantAnomaly}
            disabled={isSimLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
            title="Inject Clean Single-Rule Case: Merchant Anomaly Only (+10 pts, LOW / ALLOW)"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Merchant Anomaly (+10 pts)</span>
          </button>

          {/* Worked Example Action Button (100 pts) */}
          <button
            onClick={handleInjectWorkedExample}
            disabled={isSimLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/50 hover:to-amber-600/50 text-red-200 border border-red-500/40 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
            title="Inject the official benchmark ₹85k Dubai D999 transaction (100 pts - Critical / Block)"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="hidden sm:inline">Inject</span> Worked Example (100 pts)
          </button>

          {/* Attack Wave Burst */}
          <button
            onClick={handleInjectAttackWave}
            disabled={isSimLoading}
            className="hidden 2xl:flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-all"
            title="Inject a burst wave of 3 multi-vector attacks"
          >
            <Flame className="w-3 h-3 text-orange-400" />
            <span>Attack Wave</span>
          </button>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={user?.name}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-cyan-500/40"
            />
            <div className="text-left">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>{user?.name}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isAdmin ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                }`}>
                  {user?.role}
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">{user?.badgeId || 'OP-408'}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/60 rounded-xl transition-all"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Floating Toast Notification */}
      {feedbackMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium shadow-2xl backdrop-blur-md transition-all animate-bounce ${
          feedbackMsg.type === 'critical' ? 'bg-rose-950/90 text-rose-200 border-rose-500/60 shadow-rose-950/50' :
          feedbackMsg.type === 'error' ? 'bg-rose-900/90 text-rose-200 border-rose-700' :
          'bg-slate-900/95 text-slate-100 border-cyan-500/50 shadow-cyan-950/40'
        }`}>
          {feedbackMsg.type === 'critical' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}
    </header>
  );
}
