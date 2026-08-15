import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Lock, User, Key, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('analyst');
  const [password, setPassword] = useState('analyst123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username || !password) return;

    try {
      setLoading(true);
      setError(null);
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoUser, demoPass) => {
    setUsername(demoUser);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-panel-elevated p-8 rounded-3xl border border-slate-800 relative z-10 shadow-2xl space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 ring-1 ring-white/20 mx-auto">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-white">
            Fraud<span className="text-cyan-400">Shield</span>
          </h1>
          <p className="text-xs text-slate-400">
            Enterprise Payment Fraud Detection & Investigation Platform
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-mono font-medium text-slate-300 block mb-1.5">
              Operator Username / ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                placeholder="Enter username (e.g. analyst or admin)"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono font-medium text-slate-300 block mb-1.5">
              Security Key / Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Authenticate Session</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Fill Buttons */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider text-center">
            Instant Demo Credentials
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoFill('analyst', 'analyst123')}
              className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300">Fraud Analyst</span>
                <Zap className="w-3 h-3 text-cyan-400 opacity-60 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">analyst / analyst123</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoFill('admin', 'admin123')}
              className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300">Admin Portal</span>
                <ShieldCheck className="w-3 h-3 text-purple-400 opacity-60 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">admin / admin123</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
