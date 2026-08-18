import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { InfoTooltip } from '../components/common/InfoTooltip';
import { 
  Send, 
  Smartphone, 
  MapPin, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles, 
  User, 
  ArrowRight, 
  TrendingUp, 
  Clock, 
  CreditCard, 
  ExternalLink,
  Zap,
  Sliders
} from 'lucide-react';
import confetti from 'canvas-confetti';

export function SenderView({ onSelectTransaction }) {
  const { socket } = useSocket();
  const [customers, setCustomers] = useState([]);
  const [senderId, setSenderId] = useState('CUST-8021'); // Default: Ramesh Kumar
  const [receiverId, setReceiverId] = useState('CUST-3310'); // Default: Ananya Deshmukh
  const [amount, setAmount] = useState('3200');
  
  // Interactive Anomaly Toggles for Judges
  const [simulateNewDevice, setSimulateNewDevice] = useState(false);
  const [simulateNewLocation, setSimulateNewLocation] = useState(false);
  const [simulateNewMerchant, setSimulateNewMerchant] = useState(false);

  const [loading, setLoading] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState(null);
  const [recentTransfers, setRecentTransfers] = useState([]);

  // Fetch customers on load
  useEffect(() => {
    async function loadCustomers() {
      try {
        const data = await api.getCustomers();
        if (data.customers && data.customers.length > 0) {
          setCustomers(data.customers);
        }
      } catch (err) {
        console.error('Failed to load customers:', err);
      }
    }
    loadCustomers();
  }, []);

  const currentSender = customers.find(c => c.customerId === senderId) || {
    name: 'Ramesh Kumar',
    baselineAmount: 3200,
    homeLocation: 'Chennai, India',
    knownDevices: ['D101'],
    walletBalance: 65400
  };

  // Preset receivers including suspicious wallets
  const receiverOptions = [
    ...customers.filter(c => c.customerId !== senderId).map(c => ({
      id: c.customerId,
      name: `${c.name} (${c.homeLocation})`,
      category: 'Verified Customer Contact',
      isSuspicious: false
    })),
    {
      id: 'PEER-ANONYMOUS',
      name: 'Unknown Anonymous P2P Wallet (Crypto Gateway)',
      category: 'Unverified Entity',
      isSuspicious: true
    }
  ];

  // Set default amount to baseline when sender changes
  const handleSenderChange = (e) => {
    const newId = e.target.value;
    setSenderId(newId);
    const s = customers.find(c => c.customerId === newId);
    if (s) {
      setAmount(String(s.baselineAmount));
    }
  };

  // Submit payment
  const handleSendPayment = async (e) => {
    if (e) e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    try {
      setLoading(true);
      const payload = {
        senderId,
        receiverId,
        amount: Number(amount),
        simulateNewDevice,
        simulateNewLocation,
        simulateNewMerchant
      };

      const res = await api.sendPayment(payload);
      setLastSubmissionResult(res);

      // Add to local recent transfers list
      setRecentTransfers(prev => [
        {
          transactionId: res.transactionId,
          amount: Number(amount),
          receiverId,
          receiverName: receiverOptions.find(r => r.id === receiverId)?.name || receiverId,
          riskBand: res.result?.ruleEvaluation?.riskBand || 'LOW',
          score: res.result?.ruleEvaluation?.totalScore || 0,
          action: res.result?.ruleEvaluation?.action || 'ALLOW',
          status: res.result?.ruleEvaluation?.riskBand === 'CRITICAL' || res.result?.ruleEvaluation?.riskBand === 'HIGH' ? 'HELD_FOR_REVIEW' : 'SETTLED',
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 4)
      ]);

      if (res.result?.ruleEvaluation?.riskBand === 'LOW') {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
      }
    } catch (err) {
      alert('Payment submission failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header Banner with Change 5 plain-language instruction */}
      <div className="glass-panel-elevated p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              <span>LIVE SENDER TERMINAL</span>
            </span>
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
              <span>Kafka-Ready Event Bus</span>
              <InfoTooltip term="Event Bus / Kafka-Ready" />
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">
            Initiate Interactive Payment
          </h1>
          <p className="text-sm font-medium text-cyan-300 mt-1">
            Send a payment, then watch it get scored in real time. Try the toggles below to simulate a suspicious payment.
          </p>
        </div>

        {/* Sender Profile Badge */}
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-xs font-mono shrink-0">
          <div className="text-slate-500 text-[10px] uppercase">Active Sender Account</div>
          <div className="font-bold text-white text-sm mt-0.5 flex items-center gap-1.5">
            <User className="w-4 h-4 text-cyan-400" />
            <span>{currentSender.name}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
            <span>Avg: <strong className="text-emerald-400">₹{currentSender.baselineAmount?.toLocaleString('en-IN')}</strong></span>
            <span>•</span>
            <span>City: <strong>{currentSender.homeLocation}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form (7 cols) + Live Feedback (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form & Prominent Toggles */}
        <div className="lg:col-span-7 space-y-5">
          
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Send className="w-4 h-4 text-cyan-400" />
              <span>Payment Details</span>
            </h3>

            {/* Sender Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Sender Account</label>
              <select
                value={senderId}
                onChange={handleSenderChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              >
                {customers.map(c => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.name} — Baseline: ₹{c.baselineAmount?.toLocaleString('en-IN')} ({c.homeLocation})
                  </option>
                ))}
              </select>
            </div>

            {/* Receiver Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Select Beneficiary / Recipient</label>
              <select
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              >
                {receiverOptions.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.isSuspicious ? '⚠️ [High-Risk Anomaly]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input & Preset Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-400">Transfer Amount (INR ₹)</label>
                <span className="text-[11px] font-mono text-slate-500">
                  Ratio: <strong className={Number(amount) / (currentSender.baselineAmount || 1) >= 3 ? 'text-rose-400' : 'text-emerald-400'}>
                    {(Number(amount) / (currentSender.baselineAmount || 1)).toFixed(1)}x
                  </strong> baseline
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono text-sm font-bold">₹</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-cyan-500"
                  placeholder="Enter amount"
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setAmount(String(currentSender.baselineAmount))}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  1x Normal (₹{currentSender.baselineAmount?.toLocaleString('en-IN')})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(String(currentSender.baselineAmount * 3.5))}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 transition-all"
                >
                  3.5x Ratio (Rule 1 Trigger)
                </button>
                <button
                  type="button"
                  onClick={() => setAmount('85000')}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 transition-all"
                >
                  ₹85,000 (High-Ticket Anomaly)
                </button>
              </div>
            </div>

            {/* Interactive Judge Anomaly Toggles - Prominent Styling (Change 5) */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-2 border-cyan-500/40 shadow-lg space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    Live Anomaly Simulation Toggles
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Interactive Demo
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Toggle these controls to inject fraud signals and immediately observe how the engine calculates the score:
              </p>

              {/* Toggle 1: New Device */}
              <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                simulateNewDevice ? 'bg-rose-950/40 border-rose-600/80 shadow-md shadow-rose-950/40' : 'bg-slate-900/90 border-slate-800 hover:bg-slate-850'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${simulateNewDevice ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Simulate Unrecognized Device</span>
                      {simulateNewDevice && <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-950 text-rose-300 border border-rose-800 font-bold">+20 pts</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {simulateNewDevice ? 'Using new device DEV-JUDGE-999 (Rule 2: Device Anomaly)' : `Using trusted device ${currentSender.knownDevices[0]} (0 pts)`}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={simulateNewDevice}
                  onChange={(e) => setSimulateNewDevice(e.target.checked)}
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </label>

              {/* Toggle 2: New Location */}
              <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                simulateNewLocation ? 'bg-rose-950/40 border-rose-600/80 shadow-md shadow-rose-950/40' : 'bg-slate-900/90 border-slate-800 hover:bg-slate-850'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${simulateNewLocation ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Simulate Geolocation Anomaly / Foreign Leap</span>
                      {simulateNewLocation && <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-950 text-rose-300 border border-rose-800 font-bold">+20 pts</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {simulateNewLocation ? 'Origin: Lagos, Nigeria (Rule 3: Location Anomaly)' : `Origin: ${currentSender.homeLocation} (0 pts)`}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={simulateNewLocation}
                  onChange={(e) => setSimulateNewLocation(e.target.checked)}
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </label>

              {/* Toggle 3: New Merchant */}
              <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                simulateNewMerchant ? 'bg-amber-950/40 border-amber-600/80 shadow-md shadow-amber-950/40' : 'bg-slate-900/90 border-slate-800 hover:bg-slate-850'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${simulateNewMerchant ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Simulate Unfamiliar Beneficiary Category</span>
                      {simulateNewMerchant && <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-950 text-amber-300 border border-amber-800 font-bold">+10 pts</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {simulateNewMerchant ? 'Unrecognized Category (Rule 5: Merchant Anomaly)' : 'Standard peer transfer'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={simulateNewMerchant}
                  onChange={(e) => setSimulateNewMerchant(e.target.checked)}
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendPayment}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Broadcast & Authorize Live Payment</span>
            </button>

          </div>

        </div>

        {/* Right Column: Live Pipeline Scoring Result */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Real-Time Result Card */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>Pipeline Decision Engine</span>
                <InfoTooltip term="Rule Score" />
              </span>
              <span className="text-[10px] font-mono text-cyan-400">Instant Evaluation</span>
            </h3>

            {lastSubmissionResult ? (
              <div className="space-y-4 animate-fadeIn">
                
                {/* Status Banner */}
                <div className={`p-4 rounded-xl border ${
                  lastSubmissionResult.result?.ruleEvaluation?.riskBand === 'CRITICAL' ? 'bg-rose-950/70 border-rose-800 text-rose-300' :
                  lastSubmissionResult.result?.ruleEvaluation?.riskBand === 'HIGH' ? 'bg-orange-950/70 border-orange-800 text-orange-300' :
                  lastSubmissionResult.result?.ruleEvaluation?.riskBand === 'MEDIUM' ? 'bg-amber-950/70 border-amber-800 text-amber-300' :
                  'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {lastSubmissionResult.result?.ruleEvaluation?.riskBand === 'CRITICAL' ? <ShieldAlert className="w-5 h-5 text-rose-400" /> : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                      <span className="font-bold text-sm">
                        {lastSubmissionResult.result?.ruleEvaluation?.action} ({lastSubmissionResult.result?.ruleEvaluation?.riskBand})
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold">
                      {lastSubmissionResult.result?.ruleEvaluation?.totalScore} / 100 pts
                    </span>
                  </div>
                  <p className="text-[11px] mt-1.5 opacity-90">
                    {lastSubmissionResult.result?.ruleEvaluation?.actionDescription}
                  </p>
                </div>

                {/* Score & ML Dual Metric */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <span>Deterministic Rules</span>
                      <InfoTooltip term="Rule Score" />
                    </span>
                    <span className="text-base font-bold text-white">
                      {lastSubmissionResult.result?.ruleEvaluation?.triggeredRulesCount} / 6 Triggered
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-purple-400 block flex items-center gap-1">
                      <span>ML Fraud Prob</span>
                      <InfoTooltip term="ML Fraud Probability" />
                    </span>
                    <span className="text-base font-bold text-purple-300">
                      {lastSubmissionResult.result?.mlEvaluation?.probabilityDisplay || '5%'}
                    </span>
                  </div>
                </div>

                {/* Triggered Rules Breakdown */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Triggered Anomaly Reasons:</span>
                  {(lastSubmissionResult.result?.ruleEvaluation?.reasons || [])
                    .filter(r => r.triggered)
                    .map((r, i) => (
                      <div key={i} className="p-2 rounded bg-slate-900/90 border border-rose-900/40 text-[11px] font-mono flex items-center justify-between text-slate-300">
                        <span>{r.title}</span>
                        <span className="text-rose-400 font-bold">+{r.points} pts</span>
                      </div>
                    ))}
                  {(lastSubmissionResult.result?.ruleEvaluation?.reasons || []).filter(r => r.triggered).length === 0 && (
                    <div className="p-2 rounded bg-slate-900/60 text-[11px] font-mono text-emerald-400">
                      ✓ All 6 deterministic security rules passed cleanly.
                    </div>
                  )}
                </div>

                {/* Action Link to Workspace */}
                {onSelectTransaction && (
                  <button
                    onClick={() => onSelectTransaction(lastSubmissionResult.transactionId)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 hover:text-cyan-300 font-mono text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Open 360° Forensic Case Dossier</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 space-y-2 font-mono text-xs">
                <Clock className="w-8 h-8 mx-auto text-slate-600" />
                <p>No active submission yet.</p>
                <p className="text-[10px] text-slate-600">Select parameters on the left and click "Broadcast Live Payment".</p>
              </div>
            )}

          </div>

          {/* Recent Judge Transfers */}
          {recentTransfers.length > 0 && (
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Session Transfer History
              </span>
              <div className="space-y-1.5">
                {recentTransfers.map((tx, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-white">₹{tx.amount.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-400">{tx.receiverName} • {tx.timestamp}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                      tx.riskBand === 'CRITICAL' ? 'badge-crit' :
                      tx.riskBand === 'HIGH' ? 'badge-high' :
                      tx.riskBand === 'MEDIUM' ? 'badge-med' : 'badge-low'
                    }`}>
                      {tx.action} ({tx.score} pts)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
