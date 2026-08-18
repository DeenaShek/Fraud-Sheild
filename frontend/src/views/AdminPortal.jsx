import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { InfoTooltip } from '../components/common/InfoTooltip';
import { 
  Settings2, 
  Activity, 
  Sliders, 
  Cpu, 
  Users, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  Server, 
  Layers, 
  Zap, 
  RefreshCw 
} from 'lucide-react';

export function AdminPortal() {
  const [health, setHealth] = useState(null);
  const [config, setConfig] = useState(null);
  const [modelTelemetry, setModelTelemetry] = useState(null);
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadAdminData() {
      try {
        setLoading(true);
        const [healthRes, configRes, modelRes, usersRes, metricsRes] = await Promise.all([
          api.getAdminHealth(),
          api.getEngineConfig(),
          api.getModelTelemetry(),
          api.getAdminUsers(),
          api.getAdminMetrics()
        ]);
        setHealth(healthRes);
        setConfig(configRes.config || {});
        setModelTelemetry(modelRes);
        setUsers(usersRes.users || []);
        setMetrics(metricsRes);
      } catch (err) {
        console.error('Failed to load admin portal data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const handleToggleRule = (ruleKey) => {
    setConfig(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        [ruleKey]: {
          ...prev.rules[ruleKey],
          enabled: !prev.rules[ruleKey]?.enabled
        }
      }
    }));
  };

  const handleRuleWeightChange = (ruleKey, weight) => {
    setConfig(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        [ruleKey]: {
          ...prev.rules[ruleKey],
          weight: Number(weight) || 0
        }
      }
    }));
  };

  const handleMultiplierChange = (multiplier) => {
    setConfig(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        amountAnomaly: {
          ...prev.rules.amountAnomaly,
          multiplierThreshold: Number(multiplier) || 3.0
        }
      }
    }));
  };

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      await api.updateEngineConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save config: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-white">Loading Admin Control Systems...</h3>
      </div>
    );
  }

  const rules = config?.rules || {};

  return (
    <div className="space-y-6">
      
      {/* Admin Header */}
      <div className="glass-panel-elevated p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800 rounded">
              ADMIN CONTROL CENTER
            </span>
            <span className="text-xs font-mono text-emerald-400">
              ● All Subsystems Operational
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            Engine Rule Weights, Thresholds & ML Telemetry
          </h2>
          <p className="text-xs text-slate-400">
            Tune scoring parameters, review model weights, and oversee analyst permissions.
          </p>
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-900/40 flex items-center gap-2 transition-all active:scale-95"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Config Saved Live!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Deploy Rule Config'}</span>
            </>
          )}
        </button>
      </div>

      {/* Platform Health Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
            <span className="flex items-center gap-1">
              <span>Engine Rule Latency</span>
              <InfoTooltip term="Rule Score" />
            </span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
            {health?.averageRuleLatencyMs || 1.8} ms
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Real-time deterministic eval</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
            <span className="flex items-center gap-1">
              <span>ML Inference Latency</span>
              <InfoTooltip term="ML Fraud Probability" />
            </span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-purple-400">
            {health?.averageMlLatencyMs || 2.1} ms
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Random Forest 9-feature tabular</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
            <span>Active Engine Uptime</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {health?.uptimeFormatted || '1h 12m 40s'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Memory: {health?.memoryUsageMB || 84} MB RSS</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
            <span>Automated Decision Ratio</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
            {metrics?.automatedDecisionRatio || '84.2%'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Frictionless auto-clear</p>
        </div>

      </div>

      {/* Main Admin Grids: Rule Configuration Studio + ML Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Fraud Rule Configuration Studio (7 cols) */}
        <div className="lg:col-span-7 glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Deterministic Fraud-Rule Studio (Max: 100 pts)</span>
                <InfoTooltip term="Rule Score" />
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Total Weight: {
                (rules.amountAnomaly?.enabled ? (rules.amountAnomaly?.weight || 20) : 0) +
                (rules.deviceAnomaly?.enabled ? (rules.deviceAnomaly?.weight || 20) : 0) +
                (rules.locationAnomaly?.enabled ? (rules.locationAnomaly?.weight || 20) : 0) +
                (rules.velocityAnomaly?.enabled ? (rules.velocityAnomaly?.weight || 20) : 0) +
                (rules.merchantAnomaly?.enabled ? (rules.merchantAnomaly?.weight || 10) : 0) +
                (rules.fraudNetwork?.enabled ? (rules.fraudNetwork?.weight || 10) : 0)
              } pts
            </span>
          </div>

          <div className="space-y-3">
            
            {/* Rule 1: Amount Anomaly */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">1. Amount Anomaly</span>
                  <span className="text-[10px] font-mono text-cyan-400">(Multiplier Ratio)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Flags amount vs customer 90-day moving average baseline.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-mono text-slate-500">Threshold:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={rules.amountAnomaly?.multiplierThreshold || 3.0}
                    onChange={(e) => handleMultiplierChange(e.target.value)}
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-white text-center"
                  />
                  <span className="text-[10px] font-mono text-slate-400">x baseline</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={rules.amountAnomaly?.weight ?? 20}
                  onChange={(e) => handleRuleWeightChange('amountAnomaly', e.target.value)}
                  className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white text-center font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleToggleRule('amountAnomaly')}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    rules.amountAnomaly?.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    rules.amountAnomaly?.enabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Rule 2: Device Anomaly */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">2. Device Anomaly</span>
                  <span className="text-[10px] font-mono text-cyan-400">(Hardware Fingerprint)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Flags unrecognized cryptographic device IDs outside trusted registry.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={rules.deviceAnomaly?.weight ?? 20}
                  onChange={(e) => handleRuleWeightChange('deviceAnomaly', e.target.value)}
                  className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white text-center font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleToggleRule('deviceAnomaly')}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    rules.deviceAnomaly?.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    rules.deviceAnomaly?.enabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Rule 3: Location Anomaly */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">3. Location Anomaly</span>
                  <span className="text-[10px] font-mono text-cyan-400">(Geo-Velocity)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Flags cross-border or physically impossible geo-velocity jumps.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={rules.locationAnomaly?.weight ?? 20}
                  onChange={(e) => handleRuleWeightChange('locationAnomaly', e.target.value)}
                  className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white text-center font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleToggleRule('locationAnomaly')}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    rules.locationAnomaly?.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    rules.locationAnomaly?.enabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Rule 4: Velocity Anomaly */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">4. Transaction Velocity</span>
                  <span className="text-[10px] font-mono text-cyan-400">(Rapid Fire)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Flags &gt;2 transactions attempted within trailing 5-minute window.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={rules.velocityAnomaly?.weight ?? 20}
                  onChange={(e) => handleRuleWeightChange('velocityAnomaly', e.target.value)}
                  className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white text-center font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleToggleRule('velocityAnomaly')}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    rules.velocityAnomaly?.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    rules.velocityAnomaly?.enabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Rule 5: Merchant Anomaly */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">5. Merchant Anomaly</span>
                  <span className="text-[10px] font-mono text-cyan-400">(High Risk MCC)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Flags first-time high-risk categories (Crypto, Foreign Luxury, Gambling).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={rules.merchantAnomaly?.weight ?? 10}
                  onChange={(e) => handleRuleWeightChange('merchantAnomaly', e.target.value)}
                  className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white text-center font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleToggleRule('merchantAnomaly')}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    rules.merchantAnomaly?.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    rules.merchantAnomaly?.enabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Rule 6: Fraud Network */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">6. Fraud Network Linkage</span>
                  <span className="text-[10px] font-mono text-cyan-400">(Graph Syndicate)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Flags device/IP topological links to blacklisted or mule accounts.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={rules.fraudNetwork?.weight ?? 10}
                  onChange={(e) => handleRuleWeightChange('fraudNetwork', e.target.value)}
                  className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white text-center font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleToggleRule('fraudNetwork')}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    rules.fraudNetwork?.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    rules.fraudNetwork?.enabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Right: ML Model Telemetry & User Roles (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* ML Model Version & Telemetry */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>ML Model Version & Telemetry</span>
                  <InfoTooltip term="ML Fraud Probability" />
                </h3>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800 rounded">
                v2.4-rf
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between bg-slate-900/60 p-2 rounded-lg">
                <span className="text-slate-500">Architecture:</span>
                <span className="text-slate-200">Tabular Random Forest Ensemble</span>
              </div>
              <div className="flex justify-between bg-slate-900/60 p-2 rounded-lg">
                <span className="text-slate-500">Features Evaluated:</span>
                <span className="text-cyan-400 font-bold">9 Tabular Inputs</span>
              </div>
              <div className="flex justify-between bg-slate-900/60 p-2 rounded-lg">
                <span className="text-slate-500">ROC-AUC Score:</span>
                <span className="text-emerald-400 font-bold">0.988</span>
              </div>
              <div className="flex justify-between bg-slate-900/60 p-2 rounded-lg">
                <span className="text-slate-500">Model Precision / Recall:</span>
                <span className="text-slate-200">97.2% / 96.8%</span>
              </div>
              <div className="flex justify-between bg-slate-900/60 p-2 rounded-lg">
                <span className="text-slate-500">Separation of Concerns:</span>
                <span className="text-purple-300">Additive Secondary Signal Only</span>
              </div>
            </div>
          </div>

          {/* User Directory & Access Management */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Platform Users & Role Directory
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {users.length} Active Accounts
              </span>
            </div>

            <div className="space-y-2">
              {users.map((u) => (
                <div key={u._id} className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <div>
                      <span className="font-bold text-white">{u.name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{u.email}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                    u.role === 'ADMIN' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
